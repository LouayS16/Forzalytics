import React, { useState, useEffect } from "react";
import { Trophy, HelpCircle, Calendar, TrendingUp, Info, Database } from "lucide-react";
import TeamLogo from "./TeamLogo";
import useScrollReveal from "../hooks/useScrollReveal";

export default function PredictionResult({ prediction }) {
  const [boxRef, isBoxVisible] = useScrollReveal({ threshold: 0.1 });
  const [animateBars, setAnimateBars] = useState(false);

  // Trigger smooth expanding animation when prediction loads or enters view
  useEffect(() => {
    if (!prediction) return;
    setAnimateBars(false);
    const timer = setTimeout(() => setAnimateBars(true), 100);
    return () => clearTimeout(timer);
  }, [prediction?.predicted_outcome, prediction?.match, isBoxVisible]);

  if (!prediction) return null;

  const {
    fixture,
    home_team,
    away_team,
    competition,
    kickoff_utc,
    predicted_outcome,
    probabilities = {},
    key_drivers = [],
    home_summary,
    away_summary,
    data_source,
    disclaimer,
  } = prediction;

  const pHome = Number(probabilities.home_win ?? 0);
  const pDraw = Number(probabilities.draw ?? 0);
  const pAway = Number(probabilities.away_win ?? 0);

  const pctHome = (pHome * 100).toFixed(1);
  const pctDraw = (pDraw * 100).toFixed(1);
  const pctAway = (pAway * 100).toFixed(1);

  const homeLogo = fixture?.homeTeam?.logo;
  const awayLogo = fixture?.awayTeam?.logo;

  const formatLocalDate = (isoStr) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  const getOutcomeBadgeClass = () => {
    if (predicted_outcome === "Home Win") return "home-win";
    if (predicted_outcome === "Draw") return "draw";
    if (predicted_outcome === "Away Win") return "away-win";
    return "home-win";
  };

  const getOutcomeIcon = () => {
    if (predicted_outcome === "Home Win") return <Trophy size={26} color="#10b981" />;
    if (predicted_outcome === "Draw") return <HelpCircle size={26} color="#f59e0b" />;
    return <Trophy size={26} color="#38bdf8" />;
  };

  const homeMatchesAnalyzed = home_summary?.sample_size ?? 5;
  const awayMatchesAnalyzed = away_summary?.sample_size ?? 5;

  return (
    <div
      ref={boxRef}
      className={`prediction-box scroll-reveal-container fade-up ${
        isBoxVisible ? "is-revealed" : ""
      }`}
    >
      {/* Header Info */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.825rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "5px" }}>
          <Calendar size={14} color="#94a3b8" /> Kickoff: <strong>{formatLocalDate(kickoff_utc)}</strong> • <span style={{ color: "var(--text-secondary)" }}>{competition}</span>
        </span>
        <span style={{ fontSize: "0.775rem", color: "#10b981", display: "flex", alignItems: "center", gap: "5px", background: "rgba(16, 185, 129, 0.1)", padding: "0.25rem 0.75rem", borderRadius: "var(--radius-full)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
          <Database size={12} /> Pre-kickoff data: {homeMatchesAnalyzed} matches for {home_team} & {awayMatchesAnalyzed} for {away_team}
        </span>
      </div>

      {/* Hero Match Display with Crests */}
      <div className="prediction-hero">
        <div className="hero-matchup-row">
          <div className="hero-team-side home">
            <TeamLogo name={home_team} logo={homeLogo} size={64} className="hero-crest" />
            <div className="hero-team-details">
              <span className="hero-team-name">{home_team}</span>
              <span className="hero-team-badge home">Home Ground</span>
            </div>
          </div>

          <div className="hero-center-vs">
            <span className="hero-vs-pill">VS</span>
            <div className={`hero-outcome-glow ${getOutcomeBadgeClass()}`}>
              {getOutcomeIcon()}
              <div className="hero-outcome-text">
                <span className="hero-outcome-sub">Predicted Outcome</span>
                <span className="hero-outcome-title">{predicted_outcome}</span>
              </div>
            </div>
          </div>

          <div className="hero-team-side away">
            <TeamLogo name={away_team} logo={awayLogo} size={64} className="hero-crest" />
            <div className="hero-team-details">
              <span className="hero-team-name">{away_team}</span>
              <span className="hero-team-badge away">Away Side</span>
            </div>
          </div>
        </div>
      </div>

      {/* Probability Cards with Animated Gauges */}
      <div className="probability-section">
        <div className="prob-cards-grid">
          <div className={`prob-card home-card ${predicted_outcome === "Home Win" ? "highest" : ""}`}>
            <div className="prob-card-header">
              <TeamLogo name={home_team} logo={homeLogo} size={28} />
              <div className="prob-label">{home_team} (Home Win)</div>
            </div>
            <div className="prob-value">{pctHome}%</div>
            <div className="prob-subtext">3-Way Probability</div>
            <div className="prob-mini-track">
              <div
                className="prob-mini-fill home"
                style={{ width: animateBars ? `${pctHome}%` : "0%" }}
              />
            </div>
          </div>

          <div className={`prob-card draw-card ${predicted_outcome === "Draw" ? "highest" : ""}`}>
            <div className="prob-card-header">
              <div className="draw-icon-bullet">X</div>
              <div className="prob-label">Draw (Tie)</div>
            </div>
            <div className="prob-value">{pctDraw}%</div>
            <div className="prob-subtext">3-Way Probability</div>
            <div className="prob-mini-track">
              <div
                className="prob-mini-fill draw"
                style={{ width: animateBars ? `${pctDraw}%` : "0%" }}
              />
            </div>
          </div>

          <div className={`prob-card away-card ${predicted_outcome === "Away Win" ? "highest" : ""}`}>
            <div className="prob-card-header">
              <TeamLogo name={away_team} logo={awayLogo} size={28} />
              <div className="prob-label">{away_team} (Away Win)</div>
            </div>
            <div className="prob-value">{pctAway}%</div>
            <div className="prob-subtext">3-Way Probability</div>
            <div className="prob-mini-track">
              <div
                className="prob-mini-fill away"
                style={{ width: animateBars ? `${pctAway}%` : "0%" }}
              />
            </div>
          </div>
        </div>

        {/* Stacked Visual Probability Bar */}
        <div className="stacked-bar-container">
          <div
            className="stacked-segment home"
            style={{ width: animateBars ? `${pctHome}%` : "0%" }}
            title={`${home_team}: ${pctHome}%`}
          />
          <div
            className="stacked-segment draw"
            style={{ width: animateBars ? `${pctDraw}%` : "0%" }}
            title={`Draw: ${pctDraw}%`}
          />
          <div
            className="stacked-segment away"
            style={{ width: animateBars ? `${pctAway}%` : "0%" }}
            title={`${away_team}: ${pctAway}%`}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          <span>Home Win: {pctHome}%</span>
          <span>Draw: {pctDraw}%</span>
          <span>Away Win: {pctAway}%</span>
        </div>
      </div>

      {/* Analytical Key Drivers */}
      {key_drivers && key_drivers.length > 0 && (
        <div className="drivers-box">
          <h4 className="drivers-title">
            <TrendingUp size={16} color="#10b981" />
            <span>Pre-Kickoff Statistical Drivers Identified by Model</span>
          </h4>
          {key_drivers.map((driver, idx) => (
            <div key={idx} className="driver-item">
              <span className="driver-bullet">•</span>
              <span>{driver}</span>
            </div>
          ))}
        </div>
      )}

      {/* Source & Disclaimer */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginTop: "1rem" }}>
        {data_source && (
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center" }}>
            <strong>Data Lineage:</strong> {data_source} (strictly preceding kickoff date).
          </p>
        )}
        <p className="disclaimer-text">
          <Info size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
          {disclaimer || "Machine learning predictions are probabilistic estimates derived from pre-kickoff historical performance, not guarantees."}
        </p>
      </div>
    </div>
  );
}
