"""
player_photo_service.py
Looks up player portraits on Wikipedia (free, hotlink-friendly Wikimedia images).

Only pages whose title matches the player's name and whose description mentions football
are accepted, so a wrong person's photo is never shown. Wikipedia rate-limits anonymous
clients, so search results are resolved in ONE batched request (up to 50 titles), network
calls are serialized, and every answer is cached on disk.
"""
import json
import re
import threading
import unicodedata
from pathlib import Path

import requests

WIKI_API = "https://en.wikipedia.org/w/api.php"
HEADERS = {"User-Agent": "Forzalytics/1.0 (football analytics student project)"}
CACHE_FILE = Path(__file__).resolve().parents[2] / "player_photos_cache.json"
THUMB_SIZE = 300
BATCH_NAMES = 25  # 2 titles per name -> 50 titles, the API maximum

_CACHE_LOCK = threading.Lock()
_NET_LOCK = threading.Lock()
_CACHE = None
NOT_FOUND = {"imageUrl": None, "pageUrl": None, "source": None}


def _normalize(text):
    text = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode()
    return " ".join(text.lower().split())


def _base_title(title):
    """'Messias (footballer)' -> 'messias'."""
    return _normalize(re.sub(r"\s*\(.*?\)\s*", " ", title))


def _cache():
    global _CACHE
    if _CACHE is None:
        try:
            _CACHE = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError):
            _CACHE = {}
    return _CACHE


def _store(results):
    with _CACHE_LOCK:
        _cache().update(results)
        try:
            CACHE_FILE.write_text(json.dumps(_CACHE, ensure_ascii=False, indent=1), encoding="utf-8")
        except OSError:
            pass


def _usable(page):
    return bool(page and page.get("thumbnail") and "football" in page.get("description", "").lower())


def _to_result(page):
    return {
        "imageUrl": page["thumbnail"]["source"],
        "pageUrl": f"https://en.wikipedia.org/wiki/{page['title'].replace(' ', '_')}",
        "source": "Wikipedia",
    }


def _query(params):
    base = {"action": "query", "format": "json", "redirects": 1, "formatversion": 2,
            "prop": "pageimages|description", "piprop": "thumbnail", "pithumbsize": THUMB_SIZE}
    with _NET_LOCK:
        res = requests.get(WIKI_API, params={**base, **params}, headers=HEADERS, timeout=8)
    res.raise_for_status()
    return res.json().get("query", {})


def _lookup_titles(names):
    """One request for many players: tries 'Name (footballer)' then 'Name'. Returns {name: result}."""
    titles = [t for n in names for t in (f"{n} (footballer)", n)]
    q = _query({"titles": "|".join(titles)})
    # Follow title normalization and redirects to the final page
    hops = {x["from"]: x["to"] for x in q.get("normalized", []) + q.get("redirects", [])}
    pages = {p["title"]: p for p in q.get("pages", []) if not p.get("missing")}

    def resolve(title):
        for _ in range(3):
            if title in pages:
                return pages[title]
            title = hops.get(title, title)
        return pages.get(title)

    found = {}
    for n in names:
        for title in (f"{n} (footballer)", n):
            page = resolve(title)
            if _usable(page):
                found[n] = _to_result(page)
                break
    return found


def _lookup_search(name):
    """Fallback for a single player: full-text search, strict title match."""
    key = _normalize(name)
    q = _query({"generator": "search", "gsrsearch": f"{name} footballer", "gsrlimit": 8})
    for page in sorted(q.get("pages", []), key=lambda p: p.get("index", 99)):
        if _usable(page) and _base_title(page["title"]) == key:
            return _to_result(page)
    return None


def get_player_photos(names):
    """Batch lookup used by search results (no search fallback, to stay within rate limits)."""
    names = list(dict.fromkeys(n for n in names if n))
    with _CACHE_LOCK:
        cache = _cache()
        out = {n: cache[n] for n in names if n in cache}
    missing = [n for n in names if n not in out]
    for i in range(0, len(missing), BATCH_NAMES):
        chunk = missing[i:i + BATCH_NAMES]
        try:
            found = _lookup_titles(chunk)
        except requests.RequestException:
            break  # rate-limited or offline: leave the rest uncached, retried next time
        _store(found)
        out.update(found)
    return {n: out.get(n, NOT_FOUND) for n in names}


def get_player_photo(name):
    """Single lookup used by the player page: title lookup, then search fallback. Caches misses too."""
    with _CACHE_LOCK:
        if name in _cache():
            return {"name": name, **_cache()[name]}
    try:
        result = _lookup_titles([name]).get(name) or _lookup_search(name) or NOT_FOUND
    except requests.RequestException:
        return {"name": name, **NOT_FOUND}
    _store({name: result})
    return {"name": name, **result}
