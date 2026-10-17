import React from "react";
import {
  formatStat,
  formatPct,
  formatSampleSize,
  getResultBadge,
} from "../utils/formatStatistics";
import { Shield, Target, Activity, Flame, Calendar, Award } from "lucide-react";
import TeamLogo from "./TeamLogo";
import useScrollReveal from "../hooks/useScrollReveal";

export default function TeamFormCard({
  teamName,
  teamLogo,
  role = "home",
  matches = [],
  summary,
}) {
  const [cardRef, isVisible] = useScrollReveal({ threshold: 0.1 });

  if (!summary) {
    return (
      <div ref={cardRef} className={`team-card ${role}`}>
        <div className="team-card-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <TeamLogo name={teamName} logo={teamLogo} size={42} />
            <div>
              <h3 className="team-name">{teamName}</h3>
              <span className={`team-role ${role}`}>
                {role === "home" ? "Home Side" : "Away Side"}
              </span>
            </div>
          </div>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "1.5rem 0" }}>
          No pre-kickoff match history found in dataset.
        </p>
      </div>
    );
  }

  const formBadges = (summary.form || []).map((res, i) => {
    const b = getResultBadge(res);
    return (
      <span key={i} className={`form-pill ${b.colorClass}`} title={b.label}>
        {b.text}
      </span>
    );
  });

  // Calculate percentage fills for visual progress bars (normalized to realistic caps)
  const goalsFill = Math.min(100, ((summary.avg_goals_for || 0) / 3.5) * 100);
  const gaFill = Math.min(100, ((summary.avg_goals_against || 0) / 3.0) * 100);
  const sotFill = Math.min(100, ((summary.avg_shots_on_target || 0) / 8.0) * 100);
  const possFill = summary.avg_possession || 50;

  return (
    <div
      ref={cardRef}
      className={`team-card ${role} scroll-reveal-container fade-up ${
        isVisible ? "is-revealed" : ""
      }`}
    >
      {/* Team Header */}
      <div className="team-card-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
          <TeamLogo name={teamName} logo={teamLogo} size={48} />
          <div>
            <h3 className="team-name">{teamName}</h3>
            <span className={`team-role ${role}`}>
              {role === "home" ? "Home Club" : "Away Club"}
            </span>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div className="ppg-counter">
            {summary.points} <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>pts</span>
          </div>
          <span className="record-chip">
            {summary.points_per_game} PPG • {summary.wins}W {summary.draws}D {summary.losses}L
          </span>
        </div>
      </div>

      {/* Form Sequence */}
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.45rem", display: "flex", justifyContent: "space-between" }}>
          <span>Recent Form (Last {summary.sample_size} matches)</span>
          <span style={{ fontSize: "0.7rem" }}>Oldest → Newest</span>
        </div>
        <div className="form-strip">
          {formBadges.length > 0 ? formBadges : <span style={{ color: "var(--text-muted)" }}>N/A</span>}
        </div>
      </div>

      {/* Last 5 Matches Detailed List */}
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
          Pre-Kickoff Matches Archive:
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
          {matches.map((m, idx) => {
            const b = getResultBadge(m.result);
            return (
              <div key={m.match_id || idx} className="recent-match-row">
                <div className="recent-match-opp">
                  <span className={`form-pill ${b.colorClass}`}>{b.text}</span>
                  <span className="venue-indicator">{m.is_home ? "vs" : "@"}</span>
                  <span className="opp-name">{m.opponent}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span style={{ fontSize: "0.725rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "3px" }}>
                    <Calendar size={11} /> {m.date}
                  </span>
                  <span className={`recent-match-score ${b.colorClass}`}>
                    {m.goals_for} - {m.goals_against}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Aggregated Statistical Summaries with Mini Visual Bars */}
      <div className="stats-table">
        {/* Goals Scored */}
        <div className="stat-item-with-bar">
          <div className="stat-item-header">
            <span className="stat-label">
              <Flame size={14} color="#f59e0b" />
              <span>Avg Goals Scored</span>
              <span className="sample-tag">{formatSampleSize(summary.sample_size)}</span>
            </span>
            <span className="stat-val">{formatStat(summary.avg_goals_for)} / game</span>
          </div>
          <div className="mini-progress-track">
            <div className="mini-progress-fill goals" style={{ width: isVisible ? `${goalsFill}%` : "0%" }} />
          </div>
        </div>

        {/* Goals Conceded */}
        <div className="stat-item-with-bar">
          <div className="stat-item-header">
            <span className="stat-label">
              <Shield size={14} color="#ef4444" />
              <span>Avg Goals Conceded</span>
              <span className="sample-tag">{formatSampleSize(summary.sample_size)}</span>
            </span>
            <span className="stat-val">{formatStat(summary.avg_goals_against)} / game</span>
          </div>
          <div className="mini-progress-track">
            <div className="mini-progress-fill ga" style={{ width: isVisible ? `${gaFill}%` : "0%" }} />
          </div>
        </div>

        {/* Shots on Target */}
        <div className="stat-item-with-bar">
          <div className="stat-item-header">
            <span className="stat-label">
              <Target size={14} color="#38bdf8" />
              <span>Avg Shots on Target</span>
              <span className="sample-tag">{formatSampleSize(summary.sot_sample_size)}</span>
            </span>
            <span className="stat-val">{formatStat(summary.avg_shots_on_target)}</span>
          </div>
          <div className="mini-progress-track">
            <div className="mini-progress-fill sot" style={{ width: isVisible ? `${sotFill}%` : "0%" }} />
          </div>
        </div>

        {/* Possession */}
        <div className="stat-item-with-bar">
          <div className="stat-item-header">
            <span className="stat-label">
              <Activity size={14} color="#10b981" />
              <span>Avg Ball Possession</span>
              <span className="sample-tag">{formatSampleSize(summary.possession_sample_size)}</span>
            </span>
            <span className="stat-val">{formatPct(summary.avg_possession)}</span>
          </div>
          <div className="mini-progress-track">
            <div className="mini-progress-fill poss" style={{ width: isVisible ? `${possFill}%` : "0%" }} />
          </div>
        </div>

        {/* Corners */}
        <div className="stat-item">
          <span className="stat-label">
            <span>Avg Corner Kicks</span>
            <span className="sample-tag">{formatSampleSize(summary.corners_sample_size)}</span>
          </span>
          <span className="stat-val">{formatStat(summary.avg_corners)}</span>
        </div>

        {/* Venue-Specific Form */}
        <div className="stat-item">
          <span className="stat-label">
            <Award size={14} color="#818cf8" />
            <span>{role === "home" ? "Home-Only Record" : "Away-Only Record"}</span>
          </span>
          <span className="stat-val highlight-venue">
            {role === "home"
              ? summary.home_ppg !== null
                ? `${summary.home_ppg} PPG`
                : "N/A"
              : summary.away_ppg !== null
              ? `${summary.away_ppg} PPG`
              : "N/A"}
          </span>
        </div>
      </div>
    </div>
  );
}
