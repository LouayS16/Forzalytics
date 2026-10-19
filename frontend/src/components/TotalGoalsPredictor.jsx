import React, { useState, useEffect } from "react";
import totalGoalsApi from "../services/totalGoalsApi";

export default function TotalGoalsPredictor({ defaultHome = "Real Madrid", defaultAway = "Barcelona" }) {
  const [homeTeam, setHomeTeam] = useState(defaultHome);
  const [awayTeam, setAwayTeam] = useState(defaultAway);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [serverHealth, setServerHealth] = useState(null);

  useEffect(() => {
    totalGoalsApi.checkHealth().then(setServerHealth);
    handlePredict(defaultHome, defaultAway);
  }, []);

  const handlePredict = async (home = homeTeam, away = awayTeam) => {
    if (!home || !away) return;
    setLoading(true);
    setError(null);
    try {
      const data = await totalGoalsApi.predictMatch(home, away);
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || "Failed to calculate prediction.");
        setResult(null);
      }
    } catch (err) {
      setError("Cannot reach Total Goals server on http://127.0.0.1:5001");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
      borderRadius: "16px",
      padding: "24px",
      color: "#f8fafc",
      fontFamily: "system-ui, -apple-system, sans-serif",
      boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
      border: "1px solid rgba(255,255,255,0.08)",
      maxWidth: "750px",
      margin: "20px auto"
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "16px", marginBottom: "20px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px" }}>⚽</span>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", background: "linear-gradient(90deg, #38bdf8, #818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Expected Total Goals (xG Total)
            </h2>
          </div>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#94a3b8" }}>
            Linear Regression Model trained on 95,000+ European matches (Anti-leakage shift(1))
          </p>
        </div>
        <span style={{
          fontSize: "12px",
          padding: "4px 10px",
          borderRadius: "999px",
          background: serverHealth?.status === "healthy" ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
          color: serverHealth?.status === "healthy" ? "#4ade80" : "#f87171",
          border: `1px solid ${serverHealth?.status === "healthy" ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)"}`
        }}>
          {serverHealth?.status === "healthy" ? "● Port 5001 Online" : "○ Server Offline"}
        </span>
      </div>

      {/* Selectors */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "12px", marginBottom: "20px" }}>
        <div>
          <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "6px" }}>Home Team</label>
          <input
            type="text"
            value={homeTeam}
            onChange={(e) => setHomeTeam(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", background: "#1e293b", border: "1px solid #334155", color: "#fff", fontSize: "14px", boxSizing: "border-box" }}
            placeholder="e.g. Real Madrid"
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "6px" }}>Away Team</label>
          <input
            type="text"
            value={awayTeam}
            onChange={(e) => setAwayTeam(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", background: "#1e293b", border: "1px solid #334155", color: "#fff", fontSize: "14px", boxSizing: "border-box" }}
            placeholder="e.g. Barcelona"
          />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button
            onClick={() => handlePredict()}
            disabled={loading}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #3b82f6, #6366f1)",
              color: "#fff",
              border: "none",
              fontWeight: "600",
              cursor: loading ? "wait" : "pointer",
              transition: "transform 0.1s ease",
              boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)"
            }}
          >
            {loading ? "Calculating..." : "Predict"}
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div style={{ padding: "12px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", fontSize: "13px", marginBottom: "16px" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div>
          {/* Main Card */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1.8fr",
            gap: "16px",
            background: "rgba(30, 41, 59, 0.5)",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            marginBottom: "16px"
          }}>
            {/* Metric Display */}
            <div style={{ textAlign: "center", borderRight: "1px solid rgba(255, 255, 255, 0.08)", paddingRight: "16px" }}>
              <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "#94a3b8" }}>Expected Total Goals</span>
              <div style={{ fontSize: "48px", fontWeight: "800", color: "#38bdf8", margin: "8px 0" }}>
                {result.expected_total_goals}
              </div>
              <span style={{
                display: "inline-block",
                padding: "6px 14px",
                borderRadius: "999px",
                fontSize: "13px",
                fontWeight: "700",
                background: result.expected_total_goals >= 2.5 ? "rgba(34, 197, 94, 0.2)" : "rgba(245, 158, 11, 0.2)",
                color: result.expected_total_goals >= 2.5 ? "#4ade80" : "#fbbf24",
                border: `1px solid ${result.expected_total_goals >= 2.5 ? "rgba(34, 197, 94, 0.4)" : "rgba(245, 158, 11, 0.4)"}`
              }}>
                {result.recommendation}
              </span>
            </div>

            {/* Over / Under Probabilities */}
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "10px" }}>
              <span style={{ fontSize: "12px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px" }}>Poisson Probabilities</span>
              
              {/* Over 1.5 */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                  <span>Over 1.5 Goals</span>
                  <span style={{ fontWeight: "700", color: "#38bdf8" }}>{result.probabilities.over_1_5}%</span>
                </div>
                <div style={{ height: "6px", background: "#334155", borderRadius: "999px", overflow: "hidden" }}>
                  <div style={{ width: `${result.probabilities.over_1_5}%`, height: "100%", background: "#38bdf8" }} />
                </div>
              </div>

              {/* Over 2.5 */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                  <span style={{ fontWeight: "600", color: "#f8fafc" }}>Over 2.5 Goals (Key Line)</span>
                  <span style={{ fontWeight: "700", color: "#4ade80" }}>{result.probabilities.over_2_5}%</span>
                </div>
                <div style={{ height: "8px", background: "#334155", borderRadius: "999px", overflow: "hidden" }}>
                  <div style={{ width: `${result.probabilities.over_2_5}%`, height: "100%", background: "#4ade80" }} />
                </div>
              </div>

              {/* Over 3.5 */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                  <span>Over 3.5 Goals</span>
                  <span style={{ fontWeight: "700", color: "#a855f7" }}>{result.probabilities.over_3_5}%</span>
                </div>
                <div style={{ height: "6px", background: "#334155", borderRadius: "999px", overflow: "hidden" }}>
                  <div style={{ width: `${result.probabilities.over_3_5}%`, height: "100%", background: "#a855f7" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Teams Form Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "12px" }}>
            <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontWeight: "700", color: "#93c5fd", marginBottom: "6px" }}>{result.team_metrics.home.name} (Home)</div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#cbd5e1" }}>
                <span>Scored avg: <b>{result.team_metrics.home.avg_scored}</b></span>
                <span>Conceded avg: <b>{result.team_metrics.home.avg_conceded}</b></span>
              </div>
            </div>
            <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontWeight: "700", color: "#cbd5e1", marginBottom: "6px" }}>{result.team_metrics.away.name} (Away)</div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#cbd5e1" }}>
                <span>Scored avg: <b>{result.team_metrics.away.avg_scored}</b></span>
                <span>Conceded avg: <b>{result.team_metrics.away.avg_conceded}</b></span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
