import React, { useState, useEffect, useMemo } from "react";
import {
  Trophy,
  Calendar,
  Search,
  ChevronRight,
  Shield,
  Layers,
  Sparkles,
  ArrowRight,
  Info,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { fetchLeagueStandings, LEAGUES_LIST } from "../services/teamsApi";
import { fetchUpcomingFixtures } from "../services/fixturesApi";
import TeamLogo from "../components/TeamLogo";
import FixtureCard from "../components/FixtureCard";
import ScrollReveal from "../components/ScrollReveal";
import LoadingState from "../components/LoadingState";

export default function TeamsPage({
  onSelectTeam,
  onPredictFixture,
  initialLeague = "laliga",
}) {
  const [selectedLeague, setSelectedLeague] = useState(initialLeague);
  const [activeTab, setActiveTab] = useState("standings"); // "standings" | "fixtures"
  const [standingsData, setStandingsData] = useState(null);
  const [fixtures, setFixtures] = useState([]);
  const [isLoadingStandings, setIsLoadingStandings] = useState(true);
  const [isLoadingFixtures, setIsLoadingFixtures] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRound, setSelectedRound] = useState("all");

  const currentLeagueInfo = useMemo(() => {
    return (
      LEAGUES_LIST.find((l) => l.id === selectedLeague) || LEAGUES_LIST[0]
    );
  }, [selectedLeague]);

  // Fetch standings when selected league changes
  useEffect(() => {
    let isMounted = true;
    const loadStandings = async () => {
      setIsLoadingStandings(true);
      setError(null);
      try {
        const data = await fetchLeagueStandings(selectedLeague);
        if (isMounted) {
          setStandingsData(data);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Standings load error:", err);
          setError("Failed to load league standings. Please retry.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingStandings(false);
        }
      }
    };

    loadStandings();
    return () => {
      isMounted = false;
    };
  }, [selectedLeague]);

  // Fetch fixtures when switching to fixtures tab or changing league
  useEffect(() => {
    if (activeTab !== "fixtures") return;
    let isMounted = true;
    const loadFixtures = async () => {
      setIsLoadingFixtures(true);
      try {
        const data = await fetchUpcomingFixtures({
          competition: selectedLeague,
          limit: 120,
        });
        if (isMounted) {
          setFixtures(data || []);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Fixtures load error:", err);
        }
      } finally {
        if (isMounted) {
          setIsLoadingFixtures(false);
        }
      }
    };

    loadFixtures();
    return () => {
      isMounted = false;
    };
  }, [selectedLeague, activeTab]);

  // Filter standings by search query
  const filteredStandings = useMemo(() => {
    if (!standingsData?.standings) return [];
    if (!searchQuery.trim()) return standingsData.standings;
    const q = searchQuery.toLowerCase().trim();
    return standingsData.standings.filter((row) => {
      const name = (row.team?.name || "").toLowerCase();
      const shortName = (row.team?.shortName || "").toLowerCase();
      const norm = (row.team?.normalizedName || "").toLowerCase();
      return name.includes(q) || shortName.includes(q) || norm.includes(q);
    });
  }, [standingsData, searchQuery]);

  // Available rounds for league fixtures
  const availableRounds = useMemo(() => {
    const rounds = new Set();
    fixtures.forEach((f) => {
      if (f.round) rounds.add(f.round);
    });
    return Array.from(rounds).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, "")) || 0;
      const numB = parseInt(b.replace(/\D/g, "")) || 0;
      return numA - numB;
    });
  }, [fixtures]);

  // Filtered fixtures
  const filteredFixtures = useMemo(() => {
    return fixtures.filter((f) => {
      if (selectedRound !== "all" && f.round !== selectedRound) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const h = (f.homeTeam?.name || "").toLowerCase();
        const a = (f.awayTeam?.name || "").toLowerCase();
        return h.includes(q) || a.includes(q);
      }
      return true;
    });
  }, [fixtures, selectedRound, searchQuery]);

  // Group filtered fixtures by round
  const roundGroups = useMemo(() => {
    const groups = {};
    filteredFixtures.forEach((f) => {
      const r = f.round || "Upcoming Matches";
      if (!groups[r]) groups[r] = [];
      groups[r].push(f);
    });
    return Object.entries(groups).map(([name, matchGroup]) => ({
      name,
      fixtures: matchGroup,
    }));
  }, [filteredFixtures]);

  return (
    <div className="teams-page-container">
      {/* 1. TOP HEADER BANNER */}
      <div className="teams-header-banner">
        <div className="teams-header-content">
          <div className="teams-header-badge">
            <Shield size={14} className="accent-icon" />
            <span>European Leagues & Club Directory</span>
          </div>
          <h1 className="teams-page-title">
            Leagues, Standings & Club Squads
          </h1>
          <p className="teams-page-subtitle">
            Explore live league tables, scheduled fixtures, and comprehensive squad rosters across Europe's top 5 leagues. Click any club to inspect their full squad and match schedule.
          </p>
        </div>
      </div>

      {/* 2. LEAGUE SELECTOR PILLS */}
      <div className="leagues-selector-wrapper">
        <div className="leagues-selector-track">
          {LEAGUES_LIST.map((league) => {
            const isSelected = selectedLeague === league.id;
            return (
              <button
                key={league.id}
                type="button"
                className={`league-pill-btn ${isSelected ? "active" : ""}`}
                onClick={() => {
                  setSelectedLeague(league.id);
                  setSearchQuery("");
                }}
              >
                <div className="league-pill-emblem-wrap">
                  {league.emblem ? (
                    <img
                      src={league.emblem}
                      alt={league.name}
                      className="league-pill-emblem"
                      loading="lazy"
                    />
                  ) : (
                    <Shield size={18} />
                  )}
                </div>
                <div className="league-pill-info">
                  <span className="league-pill-name">{league.name}</span>
                  <span className="league-pill-country">{league.country}</span>
                </div>
                {isSelected && <span className="league-pill-glow" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. SWITCH BUTTONS & SEARCH BAR */}
      <div className="teams-controls-row">
        {/* Switch Buttons (Standings vs Fixtures) */}
        <div className="view-switch-group">
          <button
            type="button"
            className={`view-switch-btn ${activeTab === "standings" ? "active" : ""}`}
            onClick={() => setActiveTab("standings")}
          >
            <Trophy size={16} />
            <span>Standings Table</span>
          </button>
          <button
            type="button"
            className={`view-switch-btn ${activeTab === "fixtures" ? "active" : ""}`}
            onClick={() => setActiveTab("fixtures")}
          >
            <Calendar size={16} />
            <span>League Fixtures</span>
          </button>
        </div>

        {/* Search input */}
        <div className="teams-search-box">
          <Search size={15} className="teams-search-icon" />
          <input
            type="text"
            className="teams-search-input"
            placeholder={
              activeTab === "standings"
                ? `Filter ${currentLeagueInfo.name} clubs...`
                : "Search clubs in fixtures..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="teams-search-clear"
              onClick={() => setSearchQuery("")}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* 4. CONTENT VIEW A: STANDINGS TABLE */}
      {activeTab === "standings" && (
        <div className="standings-view-panel card-panel">
          {isLoadingStandings ? (
            <LoadingState message={`Fetching live ${currentLeagueInfo.name} standings...`} />
          ) : error ? (
            <div className="teams-error-card">
              <AlertCircle size={28} className="error-icon" />
              <p>{error}</p>
              <button
                type="button"
                className="btn-retry-teams"
                onClick={() => {
                  setError(null);
                  setSelectedLeague((prev) => prev);
                }}
              >
                <RefreshCw size={14} />
                <span>Retry</span>
              </button>
            </div>
          ) : filteredStandings.length === 0 ? (
            <div className="teams-empty-state">
              <Info size={28} />
              <p>No clubs match "{searchQuery}" in {currentLeagueInfo.name}.</p>
            </div>
          ) : (
            <div className="standings-table-responsive">
              <table className="standings-table">
                <thead>
                  <tr>
                    <th className="th-pos">#</th>
                    <th className="th-team">Club</th>
                    <th className="th-stat" title="Matches Played">P</th>
                    <th className="th-stat" title="Won">W</th>
                    <th className="th-stat" title="Drawn">D</th>
                    <th className="th-stat" title="Lost">L</th>
                    <th className="th-stat th-gf" title="Goals For">GF</th>
                    <th className="th-stat th-ga" title="Goals Against">GA</th>
                    <th className="th-stat" title="Goal Difference">GD</th>
                    <th className="th-stat th-pts" title="Points">PTS</th>
                    <th className="th-form">Form</th>
                    <th className="th-action"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStandings.map((row) => {
                    const pos = row.position;
                    // Position qualification indicator classes
                    let zoneClass = "";
                    if (pos <= 4) zoneClass = "zone-ucl";
                    else if (pos === 5 || pos === 6) zoneClass = "zone-uel";
                    else if (pos >= (standingsData.standings.length - 2)) zoneClass = "zone-relegation";

                    const teamName = row.team?.name || "Club";
                    const normName = row.team?.normalizedName || teamName;

                    return (
                      <tr
                        key={row.team?.id || pos}
                        className={`standings-row ${zoneClass}`}
                        onClick={() => onSelectTeam && onSelectTeam({
                          ...row.team,
                          competitionId: selectedLeague,
                          competitionName: currentLeagueInfo.name,
                        })}
                      >
                        {/* Position */}
                        <td className="td-pos">
                          <span className={`pos-badge ${zoneClass}`}>
                            {pos}
                          </span>
                        </td>

                        {/* Team Info (Crest + Name) */}
                        <td className="td-team">
                          <div className="standings-team-cell">
                            <TeamLogo
                              name={teamName}
                              logo={row.team?.crest}
                              size={30}
                            />
                            <div className="standings-team-text">
                              <span className="standings-team-name">
                                {teamName}
                              </span>
                              {row.team?.shortName && row.team.shortName !== teamName && (
                                <span className="standings-team-short">
                                  {row.team.shortName}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Stats */}
                        <td className="td-stat td-played">{row.played}</td>
                        <td className="td-stat td-won">{row.won}</td>
                        <td className="td-stat td-draw">{row.draw}</td>
                        <td className="td-stat td-lost">{row.lost}</td>
                        <td className="td-stat th-gf">{row.goalsFor}</td>
                        <td className="td-stat th-ga">{row.goalsAgainst}</td>
                        <td className={`td-stat td-gd ${row.goalDifference > 0 ? "positive" : row.goalDifference < 0 ? "negative" : ""}`}>
                          {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                        </td>
                        <td className="td-stat td-pts">
                          <span className="pts-highlight">{row.points}</span>
                        </td>

                        {/* Form Badges (W/D/L) */}
                        <td className="td-form">
                          <div className="form-badges-stack">
                            {row.form && row.form.length > 0 ? (
                              row.form.map((res, fIdx) => (
                                <span
                                  key={fIdx}
                                  className={`form-pill ${res === "W" ? "win" : res === "D" ? "draw" : "loss"}`}
                                  title={res === "W" ? "Win" : res === "D" ? "Draw" : "Loss"}
                                >
                                  {res}
                                </span>
                              ))
                            ) : (
                              <span className="form-pill none">-</span>
                            )}
                          </div>
                        </td>

                        {/* Click Action Arrow */}
                        <td className="td-action">
                          <button
                            type="button"
                            className="btn-inspect-team"
                            title={`Inspect ${teamName} squad and fixtures`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTeam && onSelectTeam({
                                ...row.team,
                                competitionId: selectedLeague,
                                competitionName: currentLeagueInfo.name,
                              });
                            }}
                          >
                            <span>Squad</span>
                            <ChevronRight size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Table Qualification Legend */}
              <div className="standings-legend-bar">
                <div className="legend-item">
                  <span className="legend-indicator ucl" />
                  <span>Champions League (1-4)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-indicator uel" />
                  <span>Europa League (5-6)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-indicator relegation" />
                  <span>Relegation Zone</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. CONTENT VIEW B: LEAGUE FIXTURES */}
      {activeTab === "fixtures" && (
        <div className="league-fixtures-view">
          {/* Round Filter Pills */}
          {availableRounds.length > 0 && (
            <div className="league-rounds-filter-bar">
              <span className="filter-label">Matchday:</span>
              <div className="rounds-scroll-track">
                <button
                  type="button"
                  className={`round-pill-btn ${selectedRound === "all" ? "active" : ""}`}
                  onClick={() => setSelectedRound("all")}
                >
                  All Rounds
                </button>
                {availableRounds.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`round-pill-btn ${selectedRound === r ? "active" : ""}`}
                    onClick={() => setSelectedRound(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isLoadingFixtures ? (
            <LoadingState message={`Loading scheduled fixtures for ${currentLeagueInfo.name}...`} />
          ) : filteredFixtures.length === 0 ? (
            <div className="teams-empty-state card-panel">
              <Calendar size={32} />
              <p>No fixtures found matching your criteria.</p>
            </div>
          ) : (
            <div className="league-fixtures-groups">
              {roundGroups.map((rg) => (
                <div key={rg.name} className="round-group-panel">
                  <div className="round-group-header">
                    <div className="round-title-group">
                      <div className="round-icon-badge">
                        <Layers size={16} />
                      </div>
                      <h3 className="round-name-heading">{rg.name}</h3>
                      <span className="round-count-badge">
                        {rg.fixtures.length} {rg.fixtures.length === 1 ? "match" : "matches"}
                      </span>
                    </div>
                  </div>

                  <div className="fixtures-grid">
                    {rg.fixtures.map((f, idx) => (
                      <ScrollReveal key={f.id} animation="fade-up" delay={Math.min(250, idx * 30)}>
                        <FixtureCard
                          fixture={f}
                          onSelectFixture={() => onPredictFixture && onPredictFixture(f)}
                          onPredict={() => onPredictFixture && onPredictFixture(f)}
                        />
                      </ScrollReveal>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
