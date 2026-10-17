import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const fetchCompetitions = async () => {
  try {
    const res = await apiClient.get("/competitions");
    return res.data.competitions || [];
  } catch (err) {
    console.warn("Failed fetching competitions from backend:", err);
    return [
      { id: "laliga", name: "La Liga", country: "Spain" },
      { id: "premier-league", name: "Premier League", country: "England" },
      { id: "serie-a", name: "Serie A", country: "Italy" },
      { id: "bundesliga", name: "Bundesliga", country: "Germany" },
      { id: "ligue-1", name: "Ligue 1", country: "France" },
    ];
  }
};

export const fetchUpcomingFixtures = async ({
  competition = "all",
  search = "",
  round = "",
  date = "",
  limit = 250,
} = {}) => {
  try {
    const res = await apiClient.get("/fixtures/upcoming", {
      params: {
        competition: competition && competition !== "all" ? competition : undefined,
        search: search || undefined,
        round: round && round !== "all" ? round : undefined,
        date: date && date !== "all" ? date : undefined,
        limit: limit || 250,
      },
    });
    return res.data.fixtures || [];
  } catch (err) {
    console.warn("Failed fetching fixtures from backend:", err);
    throw err;
  }
};

export const fetchFixtureDetails = async (fixtureId) => {
  try {
    const res = await apiClient.get(`/fixtures/${fixtureId}`);
    return res.data.fixture;
  } catch (err) {
    console.warn(`Failed fetching fixture ${fixtureId}:`, err);
    throw err;
  }
};

export const fetchFixtureHistory = async (fixtureId) => {
  try {
    const res = await apiClient.get(`/fixtures/${fixtureId}/history`);
    return res.data;
  } catch (err) {
    console.warn(`Failed fetching history for fixture ${fixtureId}:`, err);
    throw err;
  }
};

export default {
  fetchCompetitions,
  fetchUpcomingFixtures,
  fetchFixtureDetails,
  fetchFixtureHistory,
};
