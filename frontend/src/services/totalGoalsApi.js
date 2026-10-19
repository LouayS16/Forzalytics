/**
 * totalGoalsApi.js
 * Dedicated API client for Linear Regression Expected Total Goals (xG).
 * Standalone file - does not modify colleague's existing API clients.
 */

const TOTAL_GOALS_API_BASE = "http://127.0.0.1:5001/api/total-goals";

export const totalGoalsApi = {
  /**
   * Health check for Total Goals microservice
   */
  async checkHealth() {
    try {
      const res = await fetch(`${TOTAL_GOALS_API_BASE}/health`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn("Total Goals server not responding on port 5001:", err);
      return { status: "offline", error: err.message };
    }
  },

  /**
   * Predict Expected Total Goals for a match
   */
  async predictMatch(homeTeam, awayTeam) {
    try {
      const url = `${TOTAL_GOALS_API_BASE}/predict?home=${encodeURIComponent(homeTeam)}&away=${encodeURIComponent(awayTeam)}`;
      const res = await fetch(url);
      const data = await res.json();
      return data;
    } catch (err) {
      console.error("Failed to predict total goals:", err);
      return { success: false, error: err.message };
    }
  }
};

export default totalGoalsApi;
