import React, { useState, useEffect, useMemo } from "react";
import Navbar from "../components/Navbar";
import HeroSection from "../components/HeroSection";
import ScrollReveal from "../components/ScrollReveal";
import FixtureFilters from "../components/FixtureFilters";
import FixtureCard from "../components/FixtureCard";
import Pagination from "../components/Pagination";
import MatchPredictionPage from "./MatchPredictionPage";
import TeamsPage from "./TeamsPage";
import TeamDetailPage from "./TeamDetailPage";
import PlayersPage from "./PlayersPage";
import PlayerRatingsPage from "./PlayerRatingsPage";
import LoadingState from "../components/LoadingState";
import ErrorMessage from "../components/ErrorMessage";
import PredictionHistory from "../components/PredictionHistory";
import Footer from "../components/Footer";
import { Trophy, ArrowRight, ArrowLeft, Layers, Calendar, History, Sparkles, X, Shield } from "lucide-react";

import fixturesApi from "../services/fixturesApi";
import predictionsApi from "../services/predictionsApi";
import footballApi from "../services/footballApi";

export default function Dashboard() {
  const [currentView, setCurrentView] = useState("home"); // "home" | "prediction"
  const [isBackendOnline, setIsBackendOnline] = useState(false);
  const [datasetSize, setDatasetSize] = useState(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  // Competitions & Filter State (Default to "all" to show all regrouped by league)
  const [competitions, setCompetitions] = useState([]);
  const [selectedCompetition, setSelectedCompetition] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState("all");
  const [selectedRound, setSelectedRound] = useState("all");

  // Raw Fixtures State
  const [fixtures, setFixtures] = useState([]);
  const [isFixturesLoading, setIsFixturesLoading] = useState(false);
  const [fixturesError, setFixturesError] = useState(null);

  // Pagination for single league view or general long list
  const [currentPage, setCurrentPage] = useState(1);

  // Prediction State
  const [selectedFixture, setSelectedFixture] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [predictionError, setPredictionError] = useState(null);

  // Active Navbar Section ('home' | 'teams' | 'players' | 'statistics' | 'history')
  const [activeSection, setActiveSection] = useState("home");
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [toastNotice, setToastNotice] = useState(null);

  // History State
  const [history, setHistory] = useState([]);

  // Check backend health
  const checkHealth = async () => {
    setIsCheckingHealth(true);
    const health = await footballApi.checkBackendHealth();
    setIsBackendOnline(health.online);
    if (health.online && health.data) {
      setDatasetSize(health.data.dataset_rows || 96305);
    }
    setIsCheckingHealth(false);
  };

  useEffect(() => {
    checkHealth();
  }, []);

  // Fetch competitions list
  useEffect(() => {
    const loadCompetitions = async () => {
      const comps = await fixturesApi.fetchCompetitions();
      setCompetitions(comps);
    };
    loadCompetitions();
  }, []);

  // Fetch all upcoming fixtures across all European leagues
  const loadFixtures = async () => {
    setIsFixturesLoading(true);
    setFixturesError(null);
    try {
      const list = await fixturesApi.fetchUpcomingFixtures({
        competition: "all",
        limit: 250,
      });
      setFixtures(list);
    } catch {
      setFixturesError("Failed to fetch upcoming fixtures from data feed. Please retry.");
    } finally {
      setIsFixturesLoading(false);
    }
  };

  useEffect(() => {
    loadFixtures();
  }, []);

  // Derive unique available match dates
  const availableDates = useMemo(() => {
    const dates = new Set();
    fixtures.forEach((f) => {
      if (f.kickoffDate) dates.add(f.kickoffDate);
    });
    return Array.from(dates).sort();
  }, [fixtures]);

  // Derive unique available rounds / matchdays
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

  // Apply filters (League, Date, Round, Search)
  const filteredFixtures = useMemo(() => {
    return fixtures.filter((f) => {
      // 1. League Filter
      if (selectedCompetition !== "all" && f.competitionId !== selectedCompetition) {
        return false;
      }
      // 2. Date Filter
      if (selectedDate !== "all" && f.kickoffDate !== selectedDate) {
        return false;
      }
      // 3. Round Filter
      if (selectedRound !== "all" && f.round !== selectedRound) {
        return false;
      }
      // 4. Search Query Filter
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase().trim();
        const hName = (f.homeTeam?.name || "").toLowerCase();
        const aName = (f.awayTeam?.name || "").toLowerCase();
        const hNorm = (f.homeTeam?.normalizedName || "").toLowerCase();
        const aNorm = (f.awayTeam?.normalizedName || "").toLowerCase();
        if (
          !hName.includes(q) &&
          !aName.includes(q) &&
          !hNorm.includes(q) &&
          !aNorm.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [fixtures, selectedCompetition, selectedDate, selectedRound, searchQuery]);

  // Reset pagination whenever any filter criteria changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCompetition, selectedDate, selectedRound, searchQuery]);

  // Group filtered fixtures by league for "Show All" view
  const leagueGroups = useMemo(() => {
    if (selectedCompetition !== "all") return [];

    const orderMap = {
      laliga: 1,
      "premier-league": 2,
      "serie-a": 3,
      bundesliga: 4,
      "ligue-1": 5,
    };

    const map = {};
    for (const f of filteredFixtures) {
      const cId = f.competitionId || "other";
      if (!map[cId]) {
        const compObj = competitions.find((c) => c.id === cId);
        map[cId] = {
          id: cId,
          name: compObj?.name || f.competitionName || cId.toUpperCase(),
          country: compObj?.country || "",
          emblem: compObj?.emblem || "",
          fixtures: [],
        };
      }
      map[cId].fixtures.push(f);
    }

    return Object.values(map).sort((a, b) => {
      const orderA = orderMap[a.id] || 99;
      const orderB = orderMap[b.id] || 99;
      return orderA - orderB;
    });
  }, [filteredFixtures, selectedCompetition, competitions]);

  // Group fixtures by round when a specific league is selected
  const roundGroups = useMemo(() => {
    if (selectedCompetition === "all") return [];

    const map = {};
    for (const f of filteredFixtures) {
      const rName = f.round || "Scheduled Matches";
      if (!map[rName]) {
        map[rName] = {
          name: rName,
          fixtures: [],
        };
      }
      map[rName].fixtures.push(f);
    }

    // Sort rounds numerically and chronologically
    return Object.values(map).sort((a, b) => {
      const numA = parseInt(a.name.replace(/\D/g, "")) || 0;
      const numB = parseInt(b.name.replace(/\D/g, "")) || 0;
      if (numA !== numB) return numA - numB;
      const dateA = a.fixtures[0]?.kickoffDate || "";
      const dateB = b.fixtures[0]?.kickoffDate || "";
      return dateA.localeCompare(dateB);
    });
  }, [filteredFixtures, selectedCompetition]);

  // Pagination for rounds in single league view (e.g. 4 rounds per page)
  const roundsPerPage = 4;
  const totalRoundPages = Math.ceil(roundGroups.length / roundsPerPage) || 1;
  const paginatedRoundGroups = useMemo(() => {
    if (selectedCompetition === "all") return [];
    const start = (currentPage - 1) * roundsPerPage;
    return roundGroups.slice(start, start + roundsPerPage);
  }, [roundGroups, selectedCompetition, currentPage, roundsPerPage]);

  // Reset all filters back to initial state
  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedDate("all");
    setSelectedRound("all");
    setSelectedCompetition("all");
    setCurrentPage(1);
  };

  // Load prediction history on mount
  useEffect(() => {
    const loadHistory = async () => {
      const h = await predictionsApi.fetchPredictionHistory();
      setHistory(h);
    };
    loadHistory();
  }, []);

  // Handle Predict Fixture
  const handlePredict = async (fixtureToPredict) => {
    if (!fixtureToPredict) return;

    setSelectedFixture(fixtureToPredict);
    setIsPredicting(true);
    setPredictionError(null);

    try {
      const result = await predictionsApi.predictFixture(fixtureToPredict.id, {
        homeTeam: fixtureToPredict.homeTeam.normalizedName,
        awayTeam: fixtureToPredict.awayTeam.normalizedName,
        matchDate: fixtureToPredict.kickoffDate,
        league: fixtureToPredict.competitionId,
      });

      setPrediction(result);

      // Refresh history
      const updatedHistory = await predictionsApi.fetchPredictionHistory();
      setHistory(updatedHistory);
    } catch (err) {
      setPredictionError(err.message || "Failed to generate prediction for fixture.");
    } finally {
      setIsPredicting(false);
    }
  };

  // Open the dedicated Match Prediction Page when clicking a match (manual launch)
  const handleOpenMatchPrediction = (fixture) => {
    setSelectedFixture(fixture);
    setPrediction(null);
    setPredictionError(null);
    setCurrentView("prediction");
    try {
      window.location.hash = `#/match/${fixture.id}`;
    } catch {
      // Ignore in restricted environments
    }
  };

  const handleNavigateHome = () => {
    setCurrentView("home");
    setSelectedTeam(null);
    setActiveSection("home");
    try {
      window.location.hash = "";
    } catch {
      // Ignore
    }
  };

  const handleSelectTeam = (teamObj) => {
    setSelectedTeam(teamObj);
    setCurrentView("team-detail");
    setActiveSection("teams");
    try {
      window.location.hash = `#/teams/${encodeURIComponent(teamObj.normalizedName || teamObj.name || "")}`;
    } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackToTeams = () => {
    setCurrentView("teams");
    setSelectedTeam(null);
    setActiveSection("teams");
    try {
      window.location.hash = "#teams";
    } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Section Navigation handler for Navbar (Home, Teams, Players, Statistics, History)
  const handleNavigateSection = (sectionId) => {
    setActiveSection(sectionId);

    if (sectionId === "history") {
      setCurrentView("history");
      setSelectedTeam(null);
      try {
        window.location.hash = "#history";
      } catch {}
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (sectionId === "teams") {
      setCurrentView("teams");
      setSelectedTeam(null);
      try {
        window.location.hash = "#teams";
      } catch {}
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (sectionId === "players") {
      setCurrentView("players");
      setSelectedTeam(null);
      try {
        window.location.hash = "#players";
      } catch {}
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (sectionId === "player-ratings") {
      setCurrentView("player-ratings");
      setSelectedTeam(null);
      try {
        window.location.hash = "#player-ratings";
      } catch {}
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (sectionId === "statistics") {
      setToastNotice({
        title: "Statistics Engine",
        message: "Model calibration charts, distribution metrics, and feature weights are in development.",
      });
      setTimeout(() => setToastNotice(null), 3800);
      return;
    }

    if (currentView !== "home") {
      setCurrentView("home");
      try {
        window.location.hash = "";
      } catch {}
    }

    setTimeout(() => {
      if (sectionId === "home") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, currentView !== "home" ? 120 : 10);
  };

  // Scroll spy to highlight active section in navbar automatically (Home vs Fixtures)
  useEffect(() => {
    if (currentView !== "home") return;

    const handleScrollSpy = () => {
      const scrollPos = window.scrollY + 250;
      const fixturesEl = document.getElementById("fixtures-feed");

      if (fixturesEl && scrollPos >= fixturesEl.offsetTop) {
        setActiveSection("fixtures");
      } else {
        setActiveSection("home");
      }
    };

    window.addEventListener("scroll", handleScrollSpy, { passive: true });
    return () => window.removeEventListener("scroll", handleScrollSpy);
  }, [currentView]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === "#history") {
        setCurrentView("history");
      } else if (hash === "#players") {
        setCurrentView("players");
      } else if (hash === "#player-ratings") {
        setCurrentView("player-ratings");
      } else if (!hash || hash === "#" || hash === "#/") {
        setCurrentView("home");
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return (
    <div className="app-viewport">
      {/* Transparent Floating Navbar across the full screen */}
      <Navbar
        isBackendOnline={isBackendOnline}
        datasetSize={datasetSize}
        onRetryConnection={checkHealth}
        isCheckingHealth={isCheckingHealth}
        currentView={currentView}
        onNavigateHome={handleNavigateHome}
        onNavigateSection={handleNavigateSection}
        activeSection={activeSection}
      />

      {/* VIEW 1: HOME PAGE */}
      {currentView === "home" && (
        <>
          {/* Full-Bleed Fullscreen Video Hero Section */}
          <HeroSection
            onAccessPlatform={() => {
              document.getElementById("fixtures-feed")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
            onExploreClick={() => {
              document.getElementById("fixtures-feed")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
          />

          {/* Main Content Area Container */}
          <main className="main-content-container">
            {/* Multi-Criteria Fixture Filters (League Tabs with Show All, Date, Round, Search) */}
            <ScrollReveal animation="fade-up" delay={50}>
              <FixtureFilters
                competitions={competitions}
                selectedCompetition={selectedCompetition}
                onSelectCompetition={(compId) => {
                  setSelectedCompetition(compId);
                  setSelectedFixture(null);
                }}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                availableDates={availableDates}
                selectedRound={selectedRound}
                onSelectRound={setSelectedRound}
                availableRounds={availableRounds}
                onRefresh={loadFixtures}
                isLoading={isFixturesLoading}
                fixtureCount={filteredFixtures.length}
                totalAvailableCount={fixtures.length}
                onClearFilters={handleClearFilters}
              />
            </ScrollReveal>

            {/* Fixtures Error Message */}
            <ErrorMessage message={fixturesError} onRetry={loadFixtures} />

            {/* Upcoming Fixtures Feed */}
            <div id="fixtures-feed" className="card-panel">
              <div className="panel-header">
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                  {selectedCompetition !== "all" && (
                    <button
                      type="button"
                      className="btn-back-all-leagues"
                      onClick={() => setSelectedCompetition("all")}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "var(--text-secondary)",
                        padding: "0.35rem 0.75rem",
                        borderRadius: "var(--radius-full)",
                        fontSize: "0.75rem",
                        fontWeight: "700",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <ArrowLeft size={13} />
                      <span>All Leagues</span>
                    </button>
                  )}
                  <h2 className="panel-title">
                    <span>
                      {selectedCompetition === "all"
                        ? "Upcoming Fixtures"
                        : `${competitions.find((c) => c.id === selectedCompetition)?.name || "League"} (Grouped by Round)`}
                    </span>
                  </h2>
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Click any match to launch the ML prediction engine
                </span>
              </div>

              {isFixturesLoading ? (
                <LoadingState message="Retrieving upcoming fixtures from European football schedules..." />
              ) : filteredFixtures.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
                  <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
                    No upcoming fixtures found matching current criteria.
                  </p>
                  <button
                    type="button"
                    className="btn-back-all-leagues"
                    onClick={handleClearFilters}
                  >
                    <span>Reset All Filters</span>
                  </button>
                </div>
              ) : selectedCompetition === "all" ? (
                /* OPTION A: REGROUPED BY LEAGUE (SHOW ONLY 6 MATCHES) */
                <div className="regrouped-leagues-container">
                  {leagueGroups.map((group) => {
                    const displayedFixtures = group.fixtures.slice(0, 6);
                    const hasMore = group.fixtures.length > 6;

                    return (
                      <div key={group.id} className="league-group-panel">
                        {/* League Section Header */}
                        <div className="league-group-header">
                          <div className="league-title-group">
                            <div className="league-emblem-badge">
                              {group.emblem ? (
                                <img src={group.emblem} alt={group.name} />
                              ) : (
                                <Trophy size={16} />
                              )}
                            </div>
                            <h3 className="league-name-heading">
                              <span>{group.name}</span>
                              {group.country && (
                                <span className="league-country-tag">
                                  {group.country}
                                </span>
                              )}
                            </h3>
                            <span className="league-count-badge">
                              {hasMore
                                ? `Showing 6 of ${group.fixtures.length} matches`
                                : `${group.fixtures.length} matches`}
                            </span>
                          </div>

                          {/* "Show all" action button requested by user */}
                          <button
                            type="button"
                            className="btn-league-show-all"
                            onClick={() => {
                              setSelectedCompetition(group.id);
                              document.getElementById("fixtures-feed")?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                            }}
                            title={`Filter to view all ${group.name} fixtures grouped by round`}
                          >
                            <span>Show all ({group.fixtures.length})</span>
                            <ArrowRight size={13} />
                          </button>
                        </div>

                        {/* Fixtures Grid for this league (SHOW ONLY 6) */}
                        <div className="fixtures-grid">
                          {displayedFixtures.map((f, idx) => (
                            <ScrollReveal
                              key={f.id}
                              animation="fade-up"
                              delay={Math.min(250, idx * 30)}
                            >
                              <FixtureCard
                                fixture={f}
                                isSelected={
                                  selectedFixture && selectedFixture.id === f.id
                                }
                                onSelectFixture={handleOpenMatchPrediction}
                                onPredict={handleOpenMatchPrediction}
                                isPredicting={
                                  isPredicting &&
                                  selectedFixture &&
                                  selectedFixture.id === f.id
                                }
                              />
                            </ScrollReveal>
                          ))}
                        </div>

                        {/* Show more shortcut row if league has > 6 matches */}
                        {hasMore && (
                          <div className="league-show-more-row">
                            <button
                              type="button"
                              className="btn-view-all-league-matches"
                              onClick={() => {
                                setSelectedCompetition(group.id);
                                document.getElementById("fixtures-feed")?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                });
                              }}
                            >
                              <span>
                                View all {group.fixtures.length} matches in {group.name} grouped by round
                              </span>
                              <ArrowRight size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* OPTION B: SINGLE LEAGUE VIEW GROUPED BY ROUND */
                <div className="single-league-container">
                  {paginatedRoundGroups.map((rg) => {
                    const dates = rg.fixtures
                      .map((f) => f.kickoffDate)
                      .filter(Boolean)
                      .sort();
                    const minDate = dates[0] || "";
                    const maxDate = dates[dates.length - 1] || "";
                    const dateRangeStr =
                      minDate === maxDate
                        ? minDate
                        : `${minDate} to ${maxDate}`;

                    return (
                      <div key={rg.name} className="round-group-panel">
                        {/* Round Section Header */}
                        <div className="round-group-header">
                          <div className="round-title-group">
                            <div className="round-icon-badge">
                              <Layers size={16} />
                            </div>
                            <h3 className="round-name-heading">{rg.name}</h3>
                            <span className="round-count-badge">
                              {rg.fixtures.length}{" "}
                              {rg.fixtures.length === 1 ? "match" : "matches"}
                            </span>
                          </div>

                          {dateRangeStr && (
                            <div className="round-dates-span">
                              <Calendar size={13} />
                              <span>{dateRangeStr}</span>
                            </div>
                          )}
                        </div>

                        {/* Fixtures Grid for this Round */}
                        <div className="fixtures-grid">
                          {rg.fixtures.map((f, idx) => (
                            <ScrollReveal
                              key={f.id}
                              animation="fade-up"
                              delay={Math.min(250, idx * 30)}
                            >
                              <FixtureCard
                                fixture={f}
                                isSelected={
                                  selectedFixture && selectedFixture.id === f.id
                                }
                                onSelectFixture={handleOpenMatchPrediction}
                                onPredict={handleOpenMatchPrediction}
                                isPredicting={
                                  isPredicting &&
                                  selectedFixture &&
                                  selectedFixture.id === f.id
                                }
                              />
                            </ScrollReveal>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Centered Pagination for rounds if multiple rounds exist */}
                  {totalRoundPages > 1 && (
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalRoundPages}
                      totalItems={roundGroups.length}
                      pageSize={roundsPerPage}
                      onPageChange={(p) => {
                        setCurrentPage(p);
                        document.getElementById("fixtures-feed")?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }}
                      itemLabel="rounds"
                    />
                  )}
                </div>
              )}
            </div>
          </main>
        </>
      )}

      {/* VIEW 2: DEDICATED PREDICTION HISTORY PAGE */}
      {currentView === "history" && (
        <main className="main-content-container" style={{ paddingTop: "7.5rem", paddingBottom: "4rem" }}>
          <ScrollReveal animation="fade-up" duration={0.4}>
            <div className="card-panel">
              <div className="panel-header" style={{ marginBottom: "1.75rem", flexWrap: "wrap", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn-back-all-leagues"
                    onClick={handleNavigateHome}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "var(--text-secondary)",
                      padding: "0.4rem 0.95rem",
                      borderRadius: "var(--radius-full)",
                      fontSize: "0.8rem",
                      fontWeight: "700",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <ArrowLeft size={14} />
                    <span>Back to Home</span>
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <div className="round-icon-badge">
                      <History size={16} />
                    </div>
                    <h2 className="panel-title" style={{ margin: 0 }}>
                      Prediction History
                    </h2>
                  </div>
                </div>
                <span style={{ fontSize: "0.825rem", color: "var(--text-muted)" }}>
                  {history.length} {history.length === 1 ? "forecast" : "forecasts"} recorded
                </span>
              </div>

              <PredictionHistory
                history={history}
                onNavigateHome={handleNavigateHome}
                onSelectHistoryItem={(item) => {
                  if (item?.fixture) {
                    handleOpenMatchPrediction(item.fixture);
                  } else if (item?.home_team && item?.away_team) {
                    const synthesizedFixture = {
                      id: `hist-${item.id || Date.now()}`,
                      competitionName: item.competition || "League",
                      kickoffUtc: item.kickoff_utc || item.timestamp,
                      kickoffDate: (item.kickoff_utc || item.timestamp || "").slice(0, 10),
                      kickoffTime: (item.kickoff_utc || item.timestamp || "").slice(11, 16) || "16:00",
                      homeTeam: { name: item.home_team, normalizedName: item.home_team, logo: item.home_logo },
                      awayTeam: { name: item.away_team, normalizedName: item.away_team, logo: item.away_logo },
                    };
                    handleOpenMatchPrediction(synthesizedFixture);
                  }
                }}
              />
            </div>
          </ScrollReveal>
        </main>
      )}

      {/* VIEW 2: DEDICATED MATCH PREDICTION PAGE */}
      {currentView === "prediction" && (
        <MatchPredictionPage
          fixture={selectedFixture}
          prediction={prediction}
          isPredicting={isPredicting}
          predictionError={predictionError}
          onPredict={handlePredict}
          onBack={handleNavigateHome}
        />
      )}

      {/* VIEW 3: TEAMS & LEAGUE STANDINGS / FIXTURES */}
      {currentView === "teams" && (
        <main className="main-content-container" style={{ paddingTop: "7.5rem", paddingBottom: "4rem" }}>
          <TeamsPage
            onSelectTeam={handleSelectTeam}
            onPredictFixture={handleOpenMatchPrediction}
          />
        </main>
      )}

      {/* VIEW 5: PLAYERS — INJURY RISK SEARCH */}
      {currentView === "players" && (
        <main className="main-content-container" style={{ paddingTop: "7.5rem", paddingBottom: "4rem" }}>
          <PlayersPage />
        </main>
      )}

      {/* VIEW 6: PLAYER RATINGS — XGBOOST RATING PREDICTOR */}
      {currentView === "player-ratings" && (
        <main className="main-content-container" style={{ paddingTop: "7.5rem", paddingBottom: "4rem" }}>
          <PlayerRatingsPage />
        </main>
      )}

      {/* VIEW 4: TEAM DETAIL PAGE (FIXTURES & SQUAD) */}
      {currentView === "team-detail" && (
        <main className="main-content-container" style={{ paddingTop: "7.5rem", paddingBottom: "4rem" }}>
          <TeamDetailPage
            team={selectedTeam}
            onBack={handleBackToTeams}
            onPredictFixture={handleOpenMatchPrediction}
          />
        </main>
      )}

      {/* Floating Notice Toast */}
      {toastNotice && (
        <div className="stats-coming-soon-toast">
          <Sparkles size={18} color="#00ff87" />
          <div style={{ flex: 1 }}>
            <strong>{toastNotice.title}</strong>
            <span>{toastNotice.message}</span>
          </div>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => setToastNotice(null)}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* STYLISH FOOTER */}
      {currentView !== "prediction" && (
        <Footer onNavigateSection={handleNavigateSection} />
      )}
    </div>
  );
}
