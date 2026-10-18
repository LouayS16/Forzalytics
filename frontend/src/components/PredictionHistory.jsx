import React, { useState } from "react";
import { History, Clock, Trophy, HelpCircle, Shield, ChevronRight, Sparkles, Search } from "lucide-react";
import TeamLogo from "./TeamLogo";

export default function PredictionHistory({ history = [], onSelectHistoryItem, onNavigateHome }) {
  const [searchFilter, setSearchFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("all");

  const parseTeams = (item) => {
    let home = item.home_team || item.fixture?.homeTeam?.name;
    let away = item.away_team || item.fixture?.awayTeam?.name;
    if (!home || !away) {
      if (item.match && item.match.includes(" vs ")) {
        const parts = item.match.split(" vs ");
        home = home || parts[0]?.trim();
        away = away || parts[1]?.trim();
      }
    }
    return {
      homeTeam: home || "Home Team",
      awayTeam: away || "Away Team",
      homeLogo: item.home_logo || item.fixture?.homeTeam?.logo,
      awayLogo: item.away_logo || item.fixture?.awayTeam?.logo,
    };
  };

  const formatTimestamp = (ts) => {
    if (!ts) return "Recent";
    try {
      const d = new Date(ts);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) + " • " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return ts;
    }
  };

  const filteredHistory = history.filter((item) => {
    const { homeTeam, awayTeam } = parseTeams(item);
    const q = searchFilter.toLowerCase().trim();
    const matchSearch =
      !q ||
      homeTeam.toLowerCase().includes(q) ||
      awayTeam.toLowerCase().includes(q) ||
      (item.competition && item.competition.toLowerCase().includes(q)) ||
      (item.match && item.match.toLowerCase().includes(q));

    const matchOutcome =
      outcomeFilter === "all" ||
      item.predicted_outcome === outcomeFilter;

    return matchSearch && matchOutcome;
  });

  return (
    <div className="history-page-wrapper" style={{ width: "100%" }}>
      {/* Search & Filter Toolbar */}
      <div
        className="history-toolbar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
          padding: "1rem 1.25rem",
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <div style={{ position: "relative", minWidth: "260px", flex: "1 1 260px" }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }}
          />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search teams or competition in history..."
            style={{
              width: "100%",
              padding: "0.65rem 1rem 0.65rem 2.5rem",
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-full)",
              color: "var(--text-primary)",
              fontSize: "0.85rem",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {["all", "Home Win", "Draw", "Away Win"].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setOutcomeFilter(cat)}
              style={{
                background:
                  outcomeFilter === cat
                    ? "rgba(0, 255, 135, 0.15)"
                    : "rgba(255, 255, 255, 0.04)",
                border:
                  outcomeFilter === cat
                    ? "1px solid var(--brand-emerald)"
                    : "1px solid var(--border-subtle)",
                color:
                  outcomeFilter === cat
                    ? "var(--brand-emerald)"
                    : "var(--text-secondary)",
                padding: "0.45rem 0.9rem",
                borderRadius: "var(--radius-full)",
                fontSize: "0.78rem",
                fontWeight: "700",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {cat === "all" ? "All Outcomes" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* History Records List */}
      {filteredHistory.length === 0 ? (
        <div
          style={{
            padding: "4rem 2rem",
            textAlign: "center",
            background: "rgba(255, 255, 255, 0.015)",
            border: "1px dashed var(--border-subtle)",
            borderRadius: "var(--radius-xl)",
          }}
        >
          <History size={42} style={{ color: "var(--text-muted)", margin: "0 auto 1rem" }} />
          <h4 style={{ color: "var(--text-primary)", fontSize: "1.1rem", marginBottom: "0.5rem" }}>
            {history.length === 0 ? "No Predictions in History Yet" : "No Matching History Entries"}
          </h4>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", maxWidth: "460px", margin: "0 auto 1.5rem" }}>
            {history.length === 0
              ? "Select any match from the live upcoming fixtures feed to generate a real-time LightGBM 3-way outcome prediction."
              : "Try adjusting your search keyword or outcome filter to locate past prediction records."}
          </p>
          {onNavigateHome && (
            <button
              type="button"
              className="btn-primary"
              onClick={onNavigateHome}
              style={{ padding: "0.6rem 1.4rem", fontSize: "0.85rem" }}
            >
              <Sparkles size={14} />
              <span>Explore Upcoming Matches</span>
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {filteredHistory.map((item) => {
            const { homeTeam, awayTeam, homeLogo, awayLogo } = parseTeams(item);

            const pHome = item.probabilities ? Math.round((item.probabilities.home_win || 0) * 100) : null;
            const pDraw = item.probabilities ? Math.round((item.probabilities.draw || 0) * 100) : null;
            const pAway = item.probabilities ? Math.round((item.probabilities.away_win || 0) * 100) : null;

            const isHomeWin = item.predicted_outcome === "Home Win";
            const isDraw = item.predicted_outcome === "Draw";
            const isAwayWin = item.predicted_outcome === "Away Win";

            const outcomeBadgeClass = isHomeWin ? "badge-win" : isDraw ? "badge-draw" : "badge-loss";

            return (
              <div
                key={item.id}
                className="history-entry-card"
                onClick={() => onSelectHistoryItem && onSelectHistoryItem(item)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                  padding: "1.15rem 1.35rem",
                  background: "rgba(30, 41, 59, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.07)",
                  borderRadius: "var(--radius-lg)",
                  cursor: onSelectHistoryItem ? "pointer" : "default",
                  transition: "all 0.25s ease",
                }}
              >
                {/* Meta Row: Competition & Timestamp */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span
                      style={{
                        background: "rgba(255, 255, 255, 0.06)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "var(--text-secondary)",
                        padding: "0.2rem 0.65rem",
                        borderRadius: "var(--radius-full)",
                        fontSize: "0.72rem",
                        fontWeight: "700",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {item.competition || "League"}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Clock size={12} />
                      <span>{formatTimestamp(item.timestamp)}</span>
                    </span>
                  </div>

                  <span className={`form-pill ${outcomeBadgeClass}`} style={{ width: "auto", padding: "0.25rem 0.75rem", fontSize: "0.75rem" }}>
                    {isHomeWin && <Trophy size={13} style={{ marginRight: "4px" }} />}
                    {isDraw && <HelpCircle size={13} style={{ marginRight: "4px" }} />}
                    {isAwayWin && <Shield size={13} style={{ marginRight: "4px" }} />}
                    <span>{item.predicted_outcome}</span>
                  </span>
                </div>

                {/* Teams Row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "1rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.85rem",
                      fontSize: "1.05rem",
                      fontWeight: 800,
                      color: "var(--text-primary)",
                      flex: "1 1 auto",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <TeamLogo name={homeTeam} logo={homeLogo} size={28} />
                      <span style={{ color: isHomeWin ? "var(--brand-emerald)" : "var(--text-primary)" }}>
                        {homeTeam}
                      </span>
                    </div>

                    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 800 }}>VS</span>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <TeamLogo name={awayTeam} logo={awayLogo} size={28} />
                      <span style={{ color: isAwayWin ? "#60a5fa" : "var(--text-primary)" }}>
                        {awayTeam}
                      </span>
                    </div>
                  </div>

                  {onSelectHistoryItem && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        color: "var(--brand-emerald)",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                      }}
                    >
                      <span>Inspect Match</span>
                      <ChevronRight size={14} />
                    </div>
                  )}
                </div>

                {/* Probabilities Distribution Bar */}
                {pHome !== null && pDraw !== null && pAway !== null && (
                  <div style={{ marginTop: "0.25rem" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.72rem",
                        color: "var(--text-muted)",
                        fontWeight: "600",
                        marginBottom: "0.35rem",
                      }}
                    >
                      <span style={{ color: "var(--brand-emerald)" }}>Home Win: {pHome}%</span>
                      <span style={{ color: "#f59e0b" }}>Draw: {pDraw}%</span>
                      <span style={{ color: "#60a5fa" }}>Away Win: {pAway}%</span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        height: "6px",
                        borderRadius: "3px",
                        overflow: "hidden",
                        background: "rgba(255, 255, 255, 0.05)",
                      }}
                    >
                      <div style={{ width: `${pHome}%`, background: "var(--brand-emerald)" }} />
                      <div style={{ width: `${pDraw}%`, background: "#f59e0b" }} />
                      <div style={{ width: `${pAway}%`, background: "#60a5fa" }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
