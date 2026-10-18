import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
  headers: {
    "Content-Type": "application/json",
  },
});

const LOCAL_STORAGE_HISTORY_KEY = "matchpredict_fixture_history";

export const predictFixture = async (fixtureId, fallbackPayload = {}) => {
  if (!fixtureId && (!fallbackPayload.homeTeam || !fallbackPayload.awayTeam)) {
    throw new Error("A valid fixture ID or team pair is required.");
  }

  try {
    const payload = fixtureId
      ? { fixtureId }
      : {
          home_team: fallbackPayload.homeTeam,
          away_team: fallbackPayload.awayTeam,
          match_date: fallbackPayload.matchDate,
          league: fallbackPayload.league,
        };

    const res = await apiClient.post("/predictions", payload);
    const result = res.data;
    saveToLocalHistory(result);
    return result;
  } catch (err) {
    if (err.response && err.response.data && err.response.data.error) {
      throw new Error(err.response.data.error);
    }
    throw new Error(err.message || "Failed to communicate with prediction model service.");
  }
};

export const fetchPredictionHistory = async () => {
  try {
    const res = await apiClient.get("/history");
    if (res.data && res.data.history && res.data.history.length > 0) {
      return res.data.history;
    }
  } catch {
    // fallback to localStorage
  }

  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveToLocalHistory = (entry) => {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
    let list = stored ? JSON.parse(stored) : [];
    list.unshift({
      id: Date.now().toString(),
      match: entry.match,
      home_team: entry.home_team || entry.fixture?.homeTeam?.name || "",
      away_team: entry.away_team || entry.fixture?.awayTeam?.name || "",
      home_logo: entry.fixture?.homeTeam?.logo || "",
      away_logo: entry.fixture?.awayTeam?.logo || "",
      competition: entry.competition || entry.fixture?.competitionName || "League",
      predicted_outcome: entry.predicted_outcome,
      probabilities: entry.probabilities,
      fixture: entry.fixture,
      timestamp: entry.timestamp || new Date().toISOString(),
    });
    list = list.slice(0, 30);
    localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
};

export default {
  predictFixture,
  fetchPredictionHistory,
};
