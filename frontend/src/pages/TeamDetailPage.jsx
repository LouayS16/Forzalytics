import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Calendar,
  Users,
  Shield,
  MapPin,
  Clock,
  Sparkles,
  Search,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ExternalLink,
  UserCheck,
  Zap,
} from "lucide-react";
import { fetchTeamDetails } from "../services/teamsApi";
import TeamLogo from "../components/TeamLogo";
import FixtureCard from "../components/FixtureCard";
import ScrollReveal from "../components/ScrollReveal";
import LoadingState from "../components/LoadingState";

export default function TeamDetailPage({
  team,
  onBack,
  onPredictFixture,
}) {
  const [activeTab, setActiveTab] = useState("fixtures"); // "fixtures" | "squad"
  const [teamData, setTeamData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("all");

  const teamIdentifier = team?.normalizedName || team?.name || team?.id || "Barcelona";
  const competitionId = team?.competitionId;

  // Load team profile, squad, and matches
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchTeamDetails(teamIdentifier, competitionId);
        if (isMounted) {
          setTeamData(data);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Failed to load team details:", err);
          setError("Failed to fetch team details and squad roster.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [teamIdentifier, competitionId]);

  const teamMeta = teamData?.team || team;
  const squad = teamData?.squad || [];
  const upcomingFixtures = teamData?.upcoming_fixtures || [];

  // Categorized & filtered squad
  const filteredSquad = useMemo(() => {
    return squad.filter((player) => {
      // 1. Position filter
      if (positionFilter !== "all") {
        if (player.position?.toLowerCase() !== positionFilter.toLowerCase()) {
          return false;
        }
      }
      // 2. Search filter
      if (playerSearch.trim()) {
        const q = playerSearch.toLowerCase().trim();
        const pName = (player.name || "").toLowerCase();
        const pNat = (player.nationality || "").toLowerCase();
        return pName.includes(q) || pNat.includes(q);
      }
      return true;
    });
  }, [squad, positionFilter, playerSearch]);

  // Counts by position
  const positionCounts = useMemo(() => {
    const counts = { all: squad.length, Goalkeeper: 0, Defender: 0, Midfielder: 0, Attacker: 0 };
    squad.forEach((p) => {
      if (counts[p.position] !== undefined) {
        counts[p.position] += 1;
      }
    });
    return counts;
  }, [squad]);

  return (
    <div className="team-detail-page">
      {/* 1. TOP NAV / BACK BUTTON */}
      <div className="team-detail-back-bar">
        <button
          type="button"
          className="btn-back-teams"
          onClick={onBack}
        >
          <ArrowLeft size={16} />
          <span>Back to League Standings</span>
        </button>
      </div>

      {isLoading ? (
        <LoadingState message={`Loading ${teamMeta?.name || "club"} details and squad...`} />
      ) : error ? (
        <div className="teams-error-card card-panel">
          <p>{error}</p>
          <button type="button" className="btn-retry-teams" onClick={onBack}>
            Return to Teams
          </button>
        </div>
      ) : (
        <>
          {/* 2. TEAM HERO BANNER */}
          <div className="team-hero-banner card-panel">
            <div className="team-hero-inner">
              <div className="team-hero-crest-wrap">
                <TeamLogo
                  name={teamMeta?.name || teamIdentifier}
                  logo={teamMeta?.crest || team?.crest}
                  size={80}
                  className="team-hero-crest"
                />
              </div>

              <div className="team-hero-info">
                <div className="team-hero-badge-row">
                  <span className="team-league-badge">
                    <Shield size={13} />
                    <span>{team?.competitionName || "First Division"}</span>
                  </span>
                  {teamMeta?.founded && (
                    <span className="team-meta-pill">
                      Founded {teamMeta.founded}
                    </span>
                  )}
                </div>

                <h1 className="team-hero-title">
                  {teamMeta?.name || teamIdentifier}
                </h1>

                <div className="team-hero-chips">
                  {teamMeta?.venue && (
                    <span className="team-chip">
                      <MapPin size={13} className="chip-icon" />
                      <span>{teamMeta.venue}</span>
                    </span>
                  )}
                  {teamMeta?.coach?.name && (
                    <span className="team-chip">
                      <UserCheck size={13} className="chip-icon" />
                      <span>Manager: {teamMeta.coach.name}</span>
                    </span>
                  )}
                  <span className="team-chip">
                    <Users size={13} className="chip-icon" />
                    <span>{squad.length} Players in Roster</span>
                  </span>
                </div>
              </div>

              {/* Quick switch to Squad button right in hero for high visibility */}
              <div className="team-hero-actions">
                <button
                  type="button"
                  className={`hero-action-squad-btn ${activeTab === "squad" ? "active" : ""}`}
                  onClick={() => setActiveTab(activeTab === "squad" ? "fixtures" : "squad")}
                >
                  <Users size={16} />
                  <span>
                    {activeTab === "squad" ? "View Match Fixtures" : "View Squad Roster"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* 3. SWITCH TABS: FIXTURES vs SQUAD */}
          <div className="team-tabs-row">
            <div className="view-switch-group">
              <button
                type="button"
                className={`view-switch-btn ${activeTab === "fixtures" ? "active" : ""}`}
                onClick={() => setActiveTab("fixtures")}
              >
                <Calendar size={16} />
                <span>Team Fixtures & Schedule</span>
                <span className="tab-count-pill">{upcomingFixtures.length}</span>
              </button>
              <button
                type="button"
                className={`view-switch-btn ${activeTab === "squad" ? "active" : ""}`}
                onClick={() => setActiveTab("squad")}
              >
                <Users size={16} />
                <span>Full Squad List</span>
                <span className="tab-count-pill">{squad.length}</span>
              </button>
            </div>
          </div>

          {/* 4. VIEW A: TEAM FIXTURES & SCHEDULE */}
          {activeTab === "fixtures" && (
            <div className="team-fixtures-layout">
              {/* Upcoming Matches Section */}
              <div className="team-fixtures-section">
                <div className="section-title-row">
                  <div className="section-title-group">
                    <div className="round-icon-badge">
                      <Calendar size={16} />
                    </div>
                    <h2 className="section-heading">Upcoming Scheduled Matches</h2>
                  </div>
                  <span className="section-count-badge">
                    {upcomingFixtures.length} matches scheduled
                  </span>
                </div>

                {upcomingFixtures.length === 0 ? (
                  <div className="teams-empty-state card-panel">
                    <Calendar size={32} />
                    <p>No upcoming matches currently scheduled for this team.</p>
                  </div>
                ) : (
                  <div className="fixtures-grid">
                    {upcomingFixtures.map((f, idx) => (
                      <ScrollReveal key={f.id} animation="fade-up" delay={Math.min(250, idx * 30)}>
                        <FixtureCard
                          fixture={f}
                          onSelectFixture={() => onPredictFixture && onPredictFixture(f)}
                          onPredict={() => onPredictFixture && onPredictFixture(f)}
                        />
                      </ScrollReveal>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. VIEW B: SQUAD LIST */}
          {activeTab === "squad" && (
            <div className="team-squad-layout card-panel">
              {/* Controls bar: Position Tabs + Search */}
              <div className="squad-controls-bar">
                <div className="position-tabs-group">
                  <button
                    type="button"
                    className={`pos-tab-btn ${positionFilter === "all" ? "active" : ""}`}
                    onClick={() => setPositionFilter("all")}
                  >
                    <span>All</span>
                    <span className="pos-badge-count">{positionCounts.all}</span>
                  </button>
                  <button
                    type="button"
                    className={`pos-tab-btn ${positionFilter === "Goalkeeper" ? "active" : ""}`}
                    onClick={() => setPositionFilter("Goalkeeper")}
                  >
                    <span>Goalkeepers</span>
                    <span className="pos-badge-count">{positionCounts.Goalkeeper}</span>
                  </button>
                  <button
                    type="button"
                    className={`pos-tab-btn ${positionFilter === "Defender" ? "active" : ""}`}
                    onClick={() => setPositionFilter("Defender")}
                  >
                    <span>Defenders</span>
                    <span className="pos-badge-count">{positionCounts.Defender}</span>
                  </button>
                  <button
                    type="button"
                    className={`pos-tab-btn ${positionFilter === "Midfielder" ? "active" : ""}`}
                    onClick={() => setPositionFilter("Midfielder")}
                  >
                    <span>Midfielders</span>
                    <span className="pos-badge-count">{positionCounts.Midfielder}</span>
                  </button>
                  <button
                    type="button"
                    className={`pos-tab-btn ${positionFilter === "Attacker" ? "active" : ""}`}
                    onClick={() => setPositionFilter("Attacker")}
                  >
                    <span>Attackers</span>
                    <span className="pos-badge-count">{positionCounts.Attacker}</span>
                  </button>
                </div>

                <div className="teams-search-box squad-search">
                  <Search size={15} className="teams-search-icon" />
                  <input
                    type="text"
                    className="teams-search-input"
                    placeholder="Search player or nationality..."
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                  />
                  {playerSearch && (
                    <button
                      type="button"
                      className="teams-search-clear"
                      onClick={() => setPlayerSearch("")}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Player Cards Grid */}
              {filteredSquad.length === 0 ? (
                <div className="teams-empty-state">
                  <Users size={32} />
                  <p>No players match the criteria.</p>
                </div>
              ) : (
                <div className="squad-grid">
                  {filteredSquad.map((player, idx) => {
                    const posColor =
                      player.position === "Goalkeeper"
                        ? "pos-gk"
                        : player.position === "Defender"
                        ? "pos-df"
                        : player.position === "Midfielder"
                        ? "pos-mf"
                        : "pos-fw";

                    return (
                      <div key={player.id || idx} className={`player-card ${posColor}`}>
                        <div className="player-card-header">
                          <div className="player-number-badge">
                            {player.shirtNumber ? `#${player.shirtNumber}` : "•"}
                          </div>
                          <span className={`player-pos-badge ${posColor}`}>
                            {player.rawPosition || player.position}
                          </span>
                        </div>

                        <div className="player-card-body">
                          <h4 className="player-name">{player.name}</h4>
                          <div className="player-meta-row">
                            {player.nationality && (
                              <span className="player-nationality">
                                🌍 {player.nationality}
                              </span>
                            )}
                            {player.dateOfBirth && (
                              <span className="player-dob">
                                Born: {player.dateOfBirth.slice(0, 4)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
