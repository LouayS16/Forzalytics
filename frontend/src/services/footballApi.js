import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Fallback offline competitions & teams in case the backend server is not running
const FALLBACK_COMPETITIONS = [
  { id: "la liga", name: "La Liga" },
  { id: "premier league", name: "Premier League" },
  { id: "serie a", name: "Serie A" },
  { id: "bundesliga", name: "Bundesliga" },
  { id: "ligue 1", name: "Ligue 1" },
];

const FALLBACK_TEAMS = {
  "la liga": [
    { id: "Barcelona", name: "Barcelona" },
    { id: "Betis", name: "Betis" },
    { id: "Real Madryt", name: "Real Madrid" },
    { id: "Atl. Madryt", name: "Atlético Madrid" },
    { id: "Sevilla", name: "Sevilla" },
    { id: "Valencia", name: "Valencia" },
    { id: "Ath. Bilbao", name: "Athletic Bilbao" },
    { id: "Villarreal", name: "Villarreal" },
    { id: "Real Sociedad", name: "Real Sociedad" },
  ],
  "premier league": [
    { id: "Arsenal", name: "Arsenal" },
    { id: "Chelsea", name: "Chelsea" },
    { id: "Liverpool", name: "Liverpool" },
    { id: "Man City", name: "Manchester City" },
    { id: "Man United", name: "Manchester United" },
    { id: "Tottenham", name: "Tottenham" },
  ],
};

/**
 * Check if the backend prediction server is reachable
 */
export const checkBackendHealth = async () => {
  try {
    const res = await apiClient.get("/health");
    return { online: true, data: res.data };
  } catch (err) {
    return { online: false, error: err.message };
  }
};

/**
 * Get available competitions/leagues
 */
export const fetchCompetitions = async () => {
  try {
    const res = await apiClient.get("/competitions");
    return { data: res.data.competitions, isMock: false };
  } catch {
    console.warn("Backend offline or unreachable, using offline fallback competitions list.");
    return { data: FALLBACK_COMPETITIONS, isMock: true };
  }
};

/**
 * Get teams in a competition
 */
export const fetchTeams = async (league) => {
  try {
    const res = await apiClient.get("/teams", {
      params: { league: league ? league.toLowerCase() : "" },
    });
    return { data: res.data.teams, isMock: false };
  } catch {
    console.warn("Backend offline or unreachable, using offline fallback teams list.");
    const leagueKey = league ? league.toLowerCase() : "la liga";
    const teams = FALLBACK_TEAMS[leagueKey] || FALLBACK_TEAMS["la liga"];
    return { data: teams, isMock: true };
  }
};

/**
 * Get team's last 5 completed matches and aggregated statistics
 */
export const fetchTeamHistory = async (team, beforeDate) => {
  try {
    const res = await apiClient.get("/team-history", {
      params: { team, before_date: beforeDate },
    });
    return { data: res.data, isMock: false };
  } catch {
    console.warn(`Backend offline or unreachable for team ${team}, generating representative sample.`);
    // Honest offline demonstration fallback
    return {
      data: {
        team,
        matches: [],
        statistics: null,
      },
      isMock: true,
      error: "Connect to local Python backend (`python server.py`) for live database statistics.",
    };
  }
};

export default {
  checkBackendHealth,
  fetchCompetitions,
  fetchTeams,
  fetchTeamHistory,
};
