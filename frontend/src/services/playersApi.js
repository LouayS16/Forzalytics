import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

const toError = (err, fallback) => {
  if (err.response && err.response.data && err.response.data.error) {
    return new Error(err.response.data.error);
  }
  return new Error(err.message || fallback);
};

export const searchPlayers = async (query) => {
  try {
    const res = await apiClient.get("/players/search", { params: { q: query } });
    return res.data.players || [];
  } catch (err) {
    throw toError(err, "Player search failed.");
  }
};

export const fetchPlayerInjuryRisk = async (name, month) => {
  try {
    const res = await apiClient.get("/players/injury-risk", {
      params: month ? { name, month } : { name },
    });
    return res.data;
  } catch (err) {
    throw toError(err, "Failed to load the injury risk for this player.");
  }
};

// Photos are cached for the whole session: { name: imageUrl | null }
const photoCache = new Map();

export const fetchPlayerPhotos = async (names) => {
  const missing = names.filter((n) => !photoCache.has(n));
  if (missing.length) {
    try {
      const res = await apiClient.get("/players/photos", { params: { names: missing.join("|") } });
      Object.entries(res.data.photos || {}).forEach(([name, p]) => {
        if (p.imageUrl) photoCache.set(name, p);
      });
    } catch {
      // photos are optional: the page falls back to an avatar icon
    }
  }
  return Object.fromEntries(names.map((n) => [n, photoCache.get(n)?.imageUrl || null]));
};

export const fetchPlayerPhoto = async (name) => {
  if (photoCache.has(name)) return photoCache.get(name);
  try {
    const res = await apiClient.get("/players/photo", { params: { name } });
    photoCache.set(name, res.data);
    return res.data;
  } catch {
    return { name, imageUrl: null };
  }
};

export default {
  searchPlayers,
  fetchPlayerInjuryRisk,
  fetchPlayerPhotos,
  fetchPlayerPhoto,
};
