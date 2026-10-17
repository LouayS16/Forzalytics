import os
import json
import urllib.request
import urllib.parse
import re
from datetime import datetime, timezone

# Verified free public OpenFootball fixtures repos
OPENFOOTBALL_URLS = {
    "laliga": "https://raw.githubusercontent.com/openfootball/football.json/master/2024-25/es.1.json",
    "premier-league": "https://raw.githubusercontent.com/openfootball/football.json/master/2024-25/en.1.json",
    "bundesliga": "https://raw.githubusercontent.com/openfootball/football.json/master/2024-25/de.1.json",
    "serie-a": "https://raw.githubusercontent.com/openfootball/football.json/master/2024-25/it.1.json",
    "ligue-1": "https://raw.githubusercontent.com/openfootball/football.json/master/2024-25/fr.1.json"
}

COMPETITIONS = [
    {"id": "laliga", "name": "La Liga", "country": "Spain", "emblem": "https://crests.football-data.org/770.svg"},
    {"id": "premier-league", "name": "Premier League", "country": "England", "emblem": "https://crests.football-data.org/PL.png"},
    {"id": "serie-a", "name": "Serie A", "country": "Italy", "emblem": "https://crests.football-data.org/SA.png"},
    {"id": "bundesliga", "name": "Bundesliga", "country": "Germany", "emblem": "https://crests.football-data.org/BL1.png"},
    {"id": "ligue-1", "name": "Ligue 1", "country": "France", "emblem": "https://crests.football-data.org/FL1.png"},
]

# Team name normalization to match historical dataset cleaned_dataset.csv
TEAM_ALIASES = {
    "fc barcelona": "Barcelona",
    "barcelona": "Barcelona",
    "real betis": "Betis",
    "real betis balompié": "Betis",
    "real betis balompie": "Betis",
    "real madrid": "Real Madryt",
    "real madrid cf": "Real Madryt",
    "atlético de madrid": "Atl. Madryt",
    "club atlético de madrid": "Atl. Madryt",
    "atletico madrid": "Atl. Madryt",
    "athletic club": "Ath. Bilbao",
    "athletic club bilbao": "Ath. Bilbao",
    "sevilla fc": "Sevilla",
    "valencia cf": "Valencia",
    "villarreal cf": "Villarreal",
    "real sociedad de fútbol": "Real Sociedad",
    "real sociedad": "Real Sociedad",
    "girona fc": "Girona",
    "rcd mallorca": "Mallorca",
    "rc celta de vigo": "Celta Vigo",
    "celta vigo": "Celta Vigo",
    "getafe cf": "Getafe",
    "deportivo alavés": "Alaves",
    "ud las palmas": "Las Palmas",
    "ca osasuna": "Osasuna",
    "rayo vallecano de madrid": "Vallecano",
    "cd leganés": "Leganes",
    "real valladolid cf": "Valladolid",
    "rcd espanyol de barcelona": "Espanyol",
    "arsenal fc": "Arsenal",
    "chelsea fc": "Chelsea",
    "liverpool fc": "Liverpool",
    "manchester city fc": "Man City",
    "manchester city": "Man City",
    "manchester united fc": "Man United",
    "manchester united": "Man United",
    "tottenham hotspur fc": "Tottenham",
    "tottenham": "Tottenham",
    "aston villa fc": "Aston Villa",
    "newcastle united fc": "Newcastle",
    "everton fc": "Everton",
    "fc bayern münchen": "Bayern",
    "borussia dortmund": "Dortmund",
    "bayer 04 leverkusen": "Leverkusen",
    "juventus fc": "Juventus",
    "inter milan": "Inter",
    "fc internazionale milano": "Inter",
    "ac milan": "Milan",
    "as roma": "Roma",
    "paris saint-germain fc": "PSG",
    "olympique de marseille": "Marseille",
}

# Reliable team logos from verified free sports CDNs
TEAM_LOGOS = {
    "Barcelona": "https://crests.football-data.org/81.svg",
    "Betis": "https://crests.football-data.org/90.svg",
    "Real Madryt": "https://crests.football-data.org/86.svg",
    "Atl. Madryt": "https://crests.football-data.org/78.svg",
    "Ath. Bilbao": "https://crests.football-data.org/77.svg",
    "Sevilla": "https://crests.football-data.org/559.svg",
    "Valencia": "https://crests.football-data.org/95.svg",
    "Villarreal": "https://crests.football-data.org/94.svg",
    "Real Sociedad": "https://crests.football-data.org/92.svg",
    "Girona": "https://crests.football-data.org/298.svg",
    "Mallorca": "https://crests.football-data.org/89.svg",
    "Celta Vigo": "https://crests.football-data.org/558.svg",
    "Getafe": "https://crests.football-data.org/82.svg",
    "Alaves": "https://crests.football-data.org/263.svg",
    "Las Palmas": "https://crests.football-data.org/275.svg",
    "Osasuna": "https://crests.football-data.org/79.svg",
    "Vallecano": "https://crests.football-data.org/87.svg",
    "Leganes": "https://crests.football-data.org/745.svg",
    "Valladolid": "https://crests.football-data.org/250.svg",
    "Espanyol": "https://crests.football-data.org/80.svg",
    "Arsenal": "https://crests.football-data.org/57.svg",
    "Chelsea": "https://crests.football-data.org/61.svg",
    "Liverpool": "https://crests.football-data.org/64.svg",
    "Man City": "https://crests.football-data.org/65.svg",
    "Man United": "https://crests.football-data.org/66.svg",
    "Tottenham": "https://crests.football-data.org/73.svg",
    "Bayern": "https://crests.football-data.org/5.svg",
    "Dortmund": "https://crests.football-data.org/4.svg",
    "Juventus": "https://crests.football-data.org/109.svg",
    "Inter": "https://crests.football-data.org/108.svg",
    "Milan": "https://crests.football-data.org/98.svg",
    "PSG": "https://crests.football-data.org/524.svg",
}

# In-memory fixture cache
FIXTURES_CACHE = {}
LAST_FETCH_TIME = {}
CACHE_TTL_SECONDS = 3600  # 1 hour cache


def clean_team_name(raw_name: str) -> str:
    """Normalize raw provider team name to match internal dataset name."""
    if not raw_name:
        return "Unknown"
    normalized = raw_name.strip().lower()
    # Check exact aliases
    if normalized in TEAM_ALIASES:
        return TEAM_ALIASES[normalized]
    # Check substring matches
    for key, val in TEAM_ALIASES.items():
        if key in normalized or normalized in key:
            return val
    return raw_name.strip()


def get_team_logo(team_name: str) -> str:
    """Return logo URL or high quality fallback crest."""
    if team_name in TEAM_LOGOS:
        return TEAM_LOGOS[team_name]
    # Fallback to dynamic SVG initials shield
    clean = re.sub(r"[^A-Za-z0-9]", "", team_name)[:3].upper()
    return f"https://placehold.co/64x64/1e293b/10b981?text={clean}&font=roboto"


def fetch_league_fixtures(league_id: str):
    """Fetch fixtures from OpenFootball repository with caching."""
    now = datetime.now(timezone.utc).timestamp()
    if league_id in FIXTURES_CACHE and (now - LAST_FETCH_TIME.get(league_id, 0) < CACHE_TTL_SECONDS):
        return FIXTURES_CACHE[league_id]

    # Optional: check if user configured a live API key in backend environment
    api_key = os.getenv("FOOTBALL_DATA_ORG_KEY") or os.getenv("FOOTBALL_API_KEY")
    if api_key:
        code_map = {"laliga": "PD", "premier-league": "PL", "serie-a": "SA", "bundesliga": "BL1", "ligue-1": "FL1"}
        fd_code = code_map.get(league_id)
        if fd_code:
            try:
                fd_url = f"https://api.football-data.org/v4/competitions/{fd_code}/matches?status=SCHEDULED"
                req = urllib.request.Request(fd_url, headers={"X-Auth-Token": api_key, "User-Agent": "MatchPredict/1.0"})
                with urllib.request.urlopen(req, timeout=6) as response:
                    fd_data = json.loads(response.read().decode())
                    fd_matches = fd_data.get("matches", [])
                    if fd_matches:
                        comp_name = next((c["name"] for c in COMPETITIONS if c["id"] == league_id), league_id.title())
                        fixtures = []
                        for m in fd_matches:
                            raw_h = m.get("homeTeam", {}).get("name", "")
                            raw_a = m.get("awayTeam", {}).get("name", "")
                            home_team = clean_team_name(raw_h)
                            away_team = clean_team_name(raw_a)
                            kickoff_utc = m.get("utcDate", "")
                            date_str = kickoff_utc[:10] if kickoff_utc else ""
                            time_str = kickoff_utc[11:16] if len(kickoff_utc) > 16 else "20:00"
                            fid = f"{league_id}-{date_str.replace('-', '')}-{home_team.lower().replace(' ', '')}-{away_team.lower().replace(' ', '')}"
                            fixtures.append({
                                "id": fid,
                                "competitionId": league_id,
                                "competitionName": comp_name,
                                "round": f"Matchday {m.get('matchday', '')}",
                                "kickoffDate": date_str,
                                "kickoffTime": time_str,
                                "kickoffUtc": kickoff_utc,
                                "status": "SCHEDULED",
                                "homeTeam": {
                                    "id": home_team,
                                    "name": raw_h,
                                    "normalizedName": home_team,
                                    "logo": m.get("homeTeam", {}).get("crest") or get_team_logo(home_team)
                                },
                                "awayTeam": {
                                    "id": away_team,
                                    "name": raw_a,
                                    "normalizedName": away_team,
                                    "logo": m.get("awayTeam", {}).get("crest") or get_team_logo(away_team)
                                },
                                "isCompleted": False,
                                "score": None
                            })
                        print(f"Consumed football-data.org API for {league_id} ({len(fixtures)} live fixtures).")
                        FIXTURES_CACHE[league_id] = fixtures
                        LAST_FETCH_TIME[league_id] = now
                        return fixtures
            except Exception as e:
                print(f"Notice: football-data.org API failed ({e}), falling back to OpenFootball.")

    url = OPENFOOTBALL_URLS.get(league_id)
    if not url:
        return []

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            matches = data.get("matches", [])
            
            fixtures = []
            comp_name = next((c["name"] for c in COMPETITIONS if c["id"] == league_id), league_id.title())

            for i, m in enumerate(matches):
                raw_h = m.get("team1", "")
                raw_a = m.get("team2", "")
                home_team = clean_team_name(raw_h)
                away_team = clean_team_name(raw_a)
                date_str = m.get("date", "")
                time_str = m.get("time", "20:00")
                round_str = m.get("round", "")
                score = m.get("score", {})

                # Check if already played or scheduled
                is_completed = bool(score and "ft" in score and score["ft"])

                # ISO kickoff datetime
                try:
                    dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
                    kickoff_iso = dt.isoformat() + "Z"
                except Exception:
                    kickoff_iso = f"{date_str}T{time_str}:00Z"

                fid = f"{league_id}-{date_str.replace('-', '')}-{home_team.lower().replace(' ', '')}-{away_team.lower().replace(' ', '')}"

                fixtures.append({
                    "id": fid,
                    "competitionId": league_id,
                    "competitionName": comp_name,
                    "round": round_str,
                    "kickoffDate": date_str,
                    "kickoffTime": time_str,
                    "kickoffUtc": kickoff_iso,
                    "status": "FINISHED" if is_completed else "SCHEDULED",
                    "homeTeam": {
                        "id": home_team,
                        "name": raw_h,
                        "normalizedName": home_team,
                        "logo": get_team_logo(home_team)
                    },
                    "awayTeam": {
                        "id": away_team,
                        "name": raw_a,
                        "normalizedName": away_team,
                        "logo": get_team_logo(away_team)
                    },
                    "isCompleted": is_completed,
                    "score": score.get("ft") if is_completed else None
                })

            FIXTURES_CACHE[league_id] = fixtures
            LAST_FETCH_TIME[league_id] = now
            return fixtures
    except Exception as e:
        print(f"Error fetching {league_id} fixtures: {e}")
        return FIXTURES_CACHE.get(league_id, [])


def get_upcoming_fixtures(competition: str = None, search: str = None, round_name: str = None, date_str: str = None, limit: int = 250):
    """Retrieve filtered list of upcoming fixtures."""
    all_fixtures = []
    if competition in ["all", "", "ALL"]:
        competition = None

    target_leagues = [competition] if competition and competition in OPENFOOTBALL_URLS else list(OPENFOOTBALL_URLS.keys())

    for lid in target_leagues:
        fixtures = fetch_league_fixtures(lid)
        all_fixtures.extend(fixtures)

    # Filter for SCHEDULED / UPCOMING matches only
    upcoming = [f for f in all_fixtures if not f["isCompleted"]]

    # If OpenFootball season already has all scores completed, provide the latest round matches
    if not upcoming and all_fixtures:
        # Sort by date descending and take top scheduled
        upcoming = sorted(all_fixtures, key=lambda x: x["kickoffDate"], reverse=True)[:60]
        # Mark as scheduled for demonstration
        for u in upcoming:
            u["status"] = "SCHEDULED"

    # Round filter
    if round_name and round_name != "all":
        r = round_name.lower().strip()
        upcoming = [f for f in upcoming if r in f.get("round", "").lower()]

    # Date filter
    if date_str and date_str != "all":
        d = date_str.strip()
        upcoming = [f for f in upcoming if f.get("kickoffDate") == d]

    # Search filter
    if search:
        s = search.lower().strip()
        upcoming = [
            f for f in upcoming
            if s in f["homeTeam"]["name"].lower()
            or s in f["awayTeam"]["name"].lower()
            or s in f["homeTeam"]["normalizedName"].lower()
            or s in f["awayTeam"]["normalizedName"].lower()
        ]

    # Sort chronologically by kickoff
    upcoming.sort(key=lambda x: (x["kickoffDate"], x["kickoffTime"]))
    return upcoming[:limit]


def get_fixture_by_id(fixture_id: str):
    """Retrieve fixture by ID across all leagues."""
    for lid in OPENFOOTBALL_URLS.keys():
        fixtures = fetch_league_fixtures(lid)
        for f in fixtures:
            if f["id"] == fixture_id:
                return f
    return None


# League Code and ID Mappings
LEAGUE_CODE_MAP = {
    "laliga": {"code": "PD", "api_football_id": 140, "name": "La Liga", "country": "Spain", "emblem": "https://crests.football-data.org/770.svg"},
    "premier-league": {"code": "PL", "api_football_id": 39, "name": "Premier League", "country": "England", "emblem": "https://crests.football-data.org/PL.png"},
    "serie-a": {"code": "SA", "api_football_id": 135, "name": "Serie A", "country": "Italy", "emblem": "https://crests.football-data.org/SA.png"},
    "bundesliga": {"code": "BL1", "api_football_id": 78, "name": "Bundesliga", "country": "Germany", "emblem": "https://crests.football-data.org/BL1.png"},
    "ligue-1": {"code": "FL1", "api_football_id": 61, "name": "Ligue 1", "country": "France", "emblem": "https://crests.football-data.org/FL1.png"},
}

STANDINGS_CACHE = {}
STANDINGS_CACHE_TIME = {}

SQUAD_CACHE = {}
SQUAD_CACHE_TIME = {}

TEAM_API_IDS_MAP = {
    "Barcelona": 81,
    "Betis": 90,
    "Real Madryt": 86,
    "Real Madrid": 86,
    "Atl. Madryt": 78,
    "Atletico Madrid": 78,
    "Ath. Bilbao": 77,
    "Athletic Club": 77,
    "Sevilla": 559,
    "Valencia": 95,
    "Villarreal": 94,
    "Real Sociedad": 92,
    "Girona": 298,
    "Mallorca": 89,
    "Celta Vigo": 558,
    "Getafe": 82,
    "Alaves": 263,
    "Las Palmas": 275,
    "Osasuna": 79,
    "Vallecano": 87,
    "Leganes": 745,
    "Valladolid": 250,
    "Espanyol": 80,
    "Arsenal": 57,
    "Chelsea": 61,
    "Liverpool": 64,
    "Man City": 65,
    "Manchester City": 65,
    "Man United": 66,
    "Manchester United": 66,
    "Tottenham": 73,
    "Aston Villa": 58,
    "Newcastle": 67,
    "Everton": 62,
    "Bayern": 5,
    "Dortmund": 4,
    "Leverkusen": 3,
    "Juventus": 109,
    "Inter": 108,
    "Milan": 98,
    "Roma": 100,
    "PSG": 524,
    "Marseille": 516,
}


def normalize_league_id(comp_id: str) -> str:
    """Normalize arbitrary league identifier to canonical key."""
    if not comp_id:
        return "laliga"
    c = comp_id.lower().strip()
    if c in LEAGUE_CODE_MAP:
        return c
    for key, info in LEAGUE_CODE_MAP.items():
        if c == info["code"].lower() or c == info["name"].lower():
            return key
    return "laliga"


def get_league_standings(competition_id: str):
    """
    Retrieve live league standings table with caching.
    Uses football-data.org as primary, api-football.com as backup.
    """
    lid = normalize_league_id(competition_id)
    info = LEAGUE_CODE_MAP.get(lid, LEAGUE_CODE_MAP["laliga"])
    now_ts = datetime.now(timezone.utc).timestamp()

    if lid in STANDINGS_CACHE and (now_ts - STANDINGS_CACHE_TIME.get(lid, 0) < 3600):
        return STANDINGS_CACHE[lid]

    standings_table = None

    # 1. Primary: football-data.org
    fd_key = os.getenv("FOOTBALL_DATA_ORG_KEY") or os.getenv("FOOTBALL_API_KEY")
    if fd_key:
        try:
            url = f"https://api.football-data.org/v4/competitions/{info['code']}/standings"
            req = urllib.request.Request(url, headers={"X-Auth-Token": fd_key, "User-Agent": "MatchPredict/1.0"})
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode())
                tables = data.get("standings", [])
                if tables and len(tables) > 0:
                    raw_table = tables[0].get("table", [])
                    parsed = []
                    for row in raw_table:
                        t = row.get("team", {})
                        t_name = t.get("name", "Unknown")
                        norm = clean_team_name(t_name)
                        crest = t.get("crest") or TEAM_LOGOS.get(norm) or get_team_logo(norm)
                        form_raw = row.get("form") or ""
                        form_badges = [x.strip() for x in form_raw.split(",") if x.strip()] if form_raw else []

                        parsed.append({
                            "position": row.get("position"),
                            "team": {
                                "id": t.get("id"),
                                "name": t_name,
                                "shortName": t.get("shortName") or t_name,
                                "normalizedName": norm,
                                "crest": crest,
                            },
                            "played": row.get("playedGames", 0),
                            "won": row.get("won", 0),
                            "draw": row.get("draw", 0),
                            "lost": row.get("lost", 0),
                            "points": row.get("points", 0),
                            "goalsFor": row.get("goalsFor", 0),
                            "goalsAgainst": row.get("goalsAgainst", 0),
                            "goalDifference": row.get("goalDifference", 0),
                            "form": form_badges,
                        })
                    if parsed:
                        standings_table = parsed
                        print(f"Fetched {len(parsed)} standings rows for {info['name']} via football-data.org.")
        except Exception as e:
            print(f"Notice: football-data.org standings fetch failed for {info['name']}: {e}")

    # 2. Backup: api-football.com
    if not standings_table:
        api_fb_key = os.getenv("API_FOOTBALL_KEY") or os.getenv("RAPIDAPI_KEY")
        if api_fb_key and info.get("api_football_id"):
            try:
                url = f"https://v3.football.api-sports.io/standings?league={info['api_football_id']}&season=2024"
                req = urllib.request.Request(url, headers={"x-apisports-key": api_fb_key, "User-Agent": "MatchPredict/1.0"})
                with urllib.request.urlopen(req, timeout=6) as resp:
                    data = json.loads(resp.read().decode())
                    resp_list = data.get("response", [])
                    if resp_list:
                        league_obj = resp_list[0].get("league", {})
                        raw_table = league_obj.get("standings", [[]])[0]
                        parsed = []
                        for row in raw_table:
                            t = row.get("team", {})
                            t_name = t.get("name", "Unknown")
                            norm = clean_team_name(t_name)
                            all_stats = row.get("all", {})
                            form_raw = row.get("form") or ""
                            form_badges = list(form_raw) if form_raw else []

                            parsed.append({
                                "position": row.get("rank"),
                                "team": {
                                    "id": t.get("id"),
                                    "name": t_name,
                                    "shortName": t_name,
                                    "normalizedName": norm,
                                    "crest": t.get("logo") or TEAM_LOGOS.get(norm) or get_team_logo(norm),
                                },
                                "played": all_stats.get("played", 0),
                                "won": all_stats.get("win", 0),
                                "draw": all_stats.get("draw", 0),
                                "lost": all_stats.get("lose", 0),
                                "points": row.get("points", 0),
                                "goalsFor": all_stats.get("goals", {}).get("for", 0),
                                "goalsAgainst": all_stats.get("goals", {}).get("against", 0),
                                "goalDifference": row.get("goalsDiff", 0),
                                "form": form_badges,
                            })
                        if parsed:
                            standings_table = parsed
                            print(f"Fetched {len(parsed)} standings rows for {info['name']} via api-football.com backup.")
            except Exception as e:
                print(f"Notice: api-football.com standings backup failed: {e}")

    result = {
        "competition": info,
        "season": 2024,
        "standings": standings_table or [],
    }
    if standings_table:
        STANDINGS_CACHE[lid] = result
        STANDINGS_CACHE_TIME[lid] = now_ts

    return result


def get_team_details_and_squad(team_identifier: str, competition_id: str = None):
    """
    Retrieve team profile metadata, squad roster, upcoming fixtures, and recent matches.
    """
    norm_name = clean_team_name(team_identifier)
    cache_key = norm_name.lower()
    now_ts = datetime.now(timezone.utc).timestamp()

    if cache_key in SQUAD_CACHE and (now_ts - SQUAD_CACHE_TIME.get(cache_key, 0) < 3600):
        cached = SQUAD_CACHE[cache_key]
        all_fixtures = get_upcoming_fixtures(competition=None, limit=500)
        team_upcoming = [
            f for f in all_fixtures
            if f["homeTeam"]["normalizedName"] == norm_name or f["awayTeam"]["normalizedName"] == norm_name
        ]
        cached["upcoming_fixtures"] = team_upcoming
        return cached

    team_id = TEAM_API_IDS_MAP.get(norm_name)
    if not team_id and str(team_identifier).isdigit():
        team_id = int(team_identifier)

    team_meta = {
        "name": team_identifier,
        "shortName": norm_name,
        "normalizedName": norm_name,
        "crest": TEAM_LOGOS.get(norm_name) or get_team_logo(norm_name),
        "venue": "Home Stadium",
        "founded": None,
        "colors": None,
        "website": None,
        "coach": None,
    }
    squad_list = []

    # 1. Fetch from football-data.org
    fd_key = os.getenv("FOOTBALL_DATA_ORG_KEY") or os.getenv("FOOTBALL_API_KEY")
    if fd_key and team_id:
        try:
            url = f"https://api.football-data.org/v4/teams/{team_id}"
            req = urllib.request.Request(url, headers={"X-Auth-Token": fd_key, "User-Agent": "MatchPredict/1.0"})
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode())
                team_meta["name"] = data.get("name") or team_meta["name"]
                team_meta["shortName"] = data.get("shortName") or team_meta["shortName"]
                team_meta["crest"] = data.get("crest") or team_meta["crest"]
                team_meta["venue"] = data.get("venue") or "Home Stadium"
                team_meta["founded"] = data.get("founded")
                team_meta["colors"] = data.get("clubColors")
                team_meta["website"] = data.get("website")
                coach_obj = data.get("coach")
                if coach_obj:
                    team_meta["coach"] = {
                        "name": coach_obj.get("name"),
                        "nationality": coach_obj.get("nationality"),
                    }

                raw_squad = data.get("squad", [])
                for p in raw_squad:
                    pos = p.get("position") or "Player"
                    pos_l = pos.lower()
                    if "goalkeeper" in pos_l:
                        category = "Goalkeeper"
                    elif "defen" in pos_l:
                        category = "Defender"
                    elif "midfield" in pos_l:
                        category = "Midfielder"
                    else:
                        category = "Attacker"

                    squad_list.append({
                        "id": p.get("id"),
                        "name": p.get("name"),
                        "position": category,
                        "rawPosition": pos,
                        "shirtNumber": p.get("shirtNumber"),
                        "nationality": p.get("nationality"),
                        "dateOfBirth": p.get("dateOfBirth"),
                    })
        except Exception as e:
            print(f"Notice: Failed to fetch squad for {norm_name} from football-data.org: {e}")

    # 2. Try api-football.com backup if squad empty
    if not squad_list:
        api_fb_key = os.getenv("API_FOOTBALL_KEY") or os.getenv("RAPIDAPI_KEY")
        if api_fb_key:
            try:
                from .match_history import resolve_api_football_team_id
                afb_id = resolve_api_football_team_id(norm_name, api_fb_key)
                if afb_id:
                    url = f"https://v3.football.api-sports.io/players/squads?team={afb_id}"
                    req = urllib.request.Request(url, headers={"x-apisports-key": api_fb_key, "User-Agent": "MatchPredict/1.0"})
                    with urllib.request.urlopen(req, timeout=6) as resp:
                        data = json.loads(resp.read().decode())
                        resp_items = data.get("response", [])
                        if resp_items:
                            players = resp_items[0].get("players", [])
                            for p in players:
                                pos = p.get("position") or "Player"
                                pos_l = pos.lower()
                                if "goalkeeper" in pos_l:
                                    category = "Goalkeeper"
                                elif "defender" in pos_l:
                                    category = "Defender"
                                elif "midfielder" in pos_l:
                                    category = "Midfielder"
                                else:
                                    category = "Attacker"

                                squad_list.append({
                                    "id": p.get("id"),
                                    "name": p.get("name"),
                                    "position": category,
                                    "rawPosition": pos,
                                    "shirtNumber": p.get("number"),
                                    "nationality": None,
                                    "age": p.get("age"),
                                    "photo": p.get("photo"),
                                })
            except Exception as e:
                print(f"Notice: Failed to fetch squad from api-football.com backup for {norm_name}: {e}")

    # 3. Retrieve upcoming fixtures for this team
    all_fixtures = get_upcoming_fixtures(competition=None, limit=500)
    team_upcoming = [
        f for f in all_fixtures
        if f["homeTeam"]["normalizedName"] == norm_name or f["awayTeam"]["normalizedName"] == norm_name
    ]

    result = {
        "team": team_meta,
        "squad": squad_list,
        "upcoming_fixtures": team_upcoming,
    }
    SQUAD_CACHE[cache_key] = result
    SQUAD_CACHE_TIME[cache_key] = now_ts

    return result

