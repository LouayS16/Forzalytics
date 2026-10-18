import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const LEAGUES_LIST = [
  {
    id: "laliga",
    code: "PD",
    name: "La Liga",
    country: "Spain",
    emblem: "https://crests.football-data.org/770.svg",
  },
  {
    id: "premier-league",
    code: "PL",
    name: "Premier League",
    country: "England",
    emblem: "https://crests.football-data.org/PL.png",
  },
  {
    id: "serie-a",
    code: "SA",
    name: "Serie A",
    country: "Italy",
    emblem: "https://crests.football-data.org/SA.png",
  },
  {
    id: "bundesliga",
    code: "BL1",
    name: "Bundesliga",
    country: "Germany",
    emblem: "https://crests.football-data.org/BL1.png",
  },
  {
    id: "ligue-1",
    code: "FL1",
    name: "Ligue 1",
    country: "France",
    emblem: "https://crests.football-data.org/FL1.png",
  },
];

/**
 * Fetch standings table for a selected competition
 * @param {string} competitionId - e.g. "laliga", "premier-league", "PD"
 */
export const fetchLeagueStandings = async (competitionId = "laliga") => {
  try {
    const res = await apiClient.get(`/competitions/${competitionId}/standings`);
    return res.data;
  } catch (err) {
    console.error(`Failed to fetch standings for ${competitionId}:`, err);
    throw err;
  }
};

/**
 * Fetch detailed team metadata, squad, upcoming fixtures, and recent matches
 * @param {string} teamIdentifier - Team name or ID (e.g. "Barcelona", "Arsenal")
 * @param {string} competitionId - optional league context
 */
export const fetchTeamDetails = async (teamIdentifier, competitionId) => {
  try {
    const res = await apiClient.get(`/teams/${encodeURIComponent(teamIdentifier)}`, {
      params: competitionId ? { competition: competitionId } : {},
    });
    return res.data;
  } catch (err) {
    console.error(`Failed to fetch team details for ${teamIdentifier}:`, err);
    throw err;
  }
};
