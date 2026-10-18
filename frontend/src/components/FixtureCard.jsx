import React from "react";
import { Calendar, Clock, ChevronRight, Sparkles } from "lucide-react";
import TeamLogo from "./TeamLogo";

export default function FixtureCard({
  fixture,
  isSelected,
  onSelectFixture,
  onPredict,
  isPredicting,
}) {
  const {
    competitionName,
    round,
    kickoffUtc,
    kickoffDate,
    kickoffTime,
    homeTeam,
    awayTeam,
    status,
  } = fixture;

  const formatLocalDate = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } catch {
      return kickoffDate;
    }
  };

  const formatLocalTime = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return kickoffTime;
    }
  };

  const isScheduled = status === "SCHEDULED" || status === "TIMED" || status === "UPCOMING";

  return (
    <div
      className={`fixture-card ${isSelected ? "selected" : ""}`}
      onClick={() => onSelectFixture && onSelectFixture(fixture)}
    >
      {/* Header bar: Competition & Kickoff */}
      <div className="fixture-header">
        <span className="fixture-competition">
          {competitionName} {round ? `• ${round}` : ""}
        </span>
        <div className="fixture-time-badge">
          <Calendar size={12} />
          <span>{formatLocalDate(kickoffUtc)}</span>
          <Clock size={12} style={{ marginLeft: "4px" }} />
          <span>{formatLocalTime(kickoffUtc)}</span>
        </div>
      </div>

      {/* Teams Stack (Clean 2-Row Matchup Display) */}
      <div className="fixture-teams-stack">
        {/* Home Team Row */}
        <div className="fixture-team-row home">
          <div className="fixture-team-info">
            <TeamLogo name={homeTeam.name} logo={homeTeam.logo} size={34} />
            <span className="team-title" title={homeTeam.name}>
              {homeTeam.name}
            </span>
          </div>
          <span className="team-venue-tag home">Home</span>
        </div>

        {/* Subtle Match Divider with Mini VS */}
        <div className="fixture-divider">
          <span className="fixture-vs-mini">VS</span>
        </div>

        {/* Away Team Row */}
        <div className="fixture-team-row away">
          <div className="fixture-team-info">
            <TeamLogo name={awayTeam.name} logo={awayTeam.logo} size={34} />
            <span className="team-title" title={awayTeam.name}>
              {awayTeam.name}
            </span>
          </div>
          <span className="team-venue-tag away">Away</span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="fixture-footer">
        <span className={`status-pill ${isScheduled ? "scheduled" : "finished"}`}>
          <span className="status-dot-pulse"></span>
          {status}
        </span>

        <button
          className="btn-predict-action"
          onClick={(e) => {
            e.stopPropagation();
            onPredict(fixture);
          }}
          disabled={isPredicting}
          title="Predict match outcome using 5-match rolling ML model"
        >
          <Sparkles size={14} className={isPredicting && isSelected ? "spin-icon" : ""} />
          <span>{isPredicting && isSelected ? "Predicting..." : "Predict Match"}</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
