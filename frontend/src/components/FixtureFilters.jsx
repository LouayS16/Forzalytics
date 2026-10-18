import React, { useRef } from "react";
import {
  Search,
  RefreshCw,
  Trophy,
  Globe,
  Calendar,
  Layers,
  X,
  RotateCcw,
} from "lucide-react";

export default function FixtureFilters({
  competitions = [],
  selectedCompetition = "all",
  onSelectCompetition,
  searchQuery = "",
  onSearchChange,
  selectedDate = "all",
  onSelectDate,
  selectedRound = "all",
  onSelectRound,
  availableRounds = [],
  onRefresh,
  isLoading,
  fixtureCount = 0,
  totalAvailableCount = 0,
  onClearFilters,
}) {
  const dateInputRef = useRef(null);

  // Compute local "Today" and "Tomorrow" dates in YYYY-MM-DD format
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getTomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTodayStr();
  const tomorrowStr = getTomorrowStr();

  const isTodayActive = selectedDate === todayStr;
  const isTomorrowActive = selectedDate === tomorrowStr;
  const isAllDatesActive = selectedDate === "all";

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    (selectedDate && selectedDate !== "all") ||
    (selectedRound && selectedRound !== "all");

  const formatDateLabel = (dateStr) => {
    if (!dateStr || dateStr === "all") return "All Dates";
    if (dateStr === todayStr) return "Today";
    if (dateStr === tomorrowStr) return "Tomorrow";
    try {
      const [year, month, day] = dateStr.split("-");
      const d = new Date(year, parseInt(month) - 1, day);
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const handleOpenCalendar = () => {
    if (dateInputRef.current) {
      if (typeof dateInputRef.current.showPicker === "function") {
        dateInputRef.current.showPicker();
      } else {
        dateInputRef.current.focus();
      }
    }
  };

  return (
    <div className="card-panel filters-panel">
      {/* Top Row: League Selector Tabs with "Show All" */}
      <div className="filters-top-row">
        <div className="competition-tabs-container">
          {/* Show All Leagues Tab */}
          <button
            type="button"
            className={`competition-tab ${selectedCompetition === "all" ? "active" : ""}`}
            onClick={() => onSelectCompetition("all")}
            title="Show all matches regrouped across all European leagues"
          >
            <Globe size={15} />
            <span>Show All</span>
          </button>

          {/* Individual League Tabs */}
          {competitions.map((c) => {
            const isActive = selectedCompetition === c.id;
            return (
              <button
                type="button"
                key={c.id}
                className={`competition-tab ${isActive ? "active" : ""}`}
                onClick={() => onSelectCompetition(c.id)}
              >
                <Trophy size={14} />
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>

        {/* Refresh Feed Button */}
        <button
          type="button"
          className="btn-refresh"
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh fixtures from live schedule feed"
        >
          <RefreshCw size={14} className={isLoading ? "spin-icon" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Middle Row: Search, Interactive Calendar Date Picker, and Round Filter */}
      <div className="filters-controls-row">
        {/* Search Team Input */}
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search teams (e.g. Real Madrid, Arsenal, Barcelona, Milan)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => onSearchChange("")}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Interactive Calendar Date Picker */}
        <div className="calendar-picker-wrapper" onClick={handleOpenCalendar}>
          <Calendar size={15} className="calendar-picker-icon" />
          <input
            ref={dateInputRef}
            type="date"
            className="calendar-date-input"
            value={selectedDate !== "all" ? selectedDate : ""}
            onChange={(e) => onSelectDate(e.target.value || "all")}
            title="Choose match kickoff date from calendar"
          />
          {selectedDate !== "all" ? (
            <button
              type="button"
              className="calendar-clear-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSelectDate("all");
              }}
              title="Clear date filter"
            >
              <X size={13} />
            </button>
          ) : (
            <span className="calendar-placeholder-text">Pick Date</span>
          )}
        </div>

        {/* Filter by Round Selector */}
        <div className="filter-select-wrapper">
          <Layers size={15} className="filter-select-icon" />
          <select
            className="filter-select"
            value={selectedRound}
            onChange={(e) => onSelectRound(e.target.value)}
            title="Filter by matchday / round"
          >
            <option value="all">All Rounds ({availableRounds.length})</option>
            {availableRounds.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Shortcuts Row: Date Presets (All Dates, Today, Tomorrow) & Active Filter Badges */}
      <div className="filters-shortcuts-row">
        {/* Quick Date Shortcuts Requested by User */}
        <div className="date-shortcuts-group">
          <span className="shortcuts-label">Date:</span>

          <button
            type="button"
            className={`date-shortcut-pill ${isAllDatesActive ? "active" : ""}`}
            onClick={() => onSelectDate("all")}
          >
            All Dates
          </button>

          <button
            type="button"
            className={`date-shortcut-pill ${isTodayActive ? "active" : ""}`}
            onClick={() => onSelectDate(todayStr)}
            title={`Filter matches for Today (${todayStr})`}
          >
            Today
          </button>

          <button
            type="button"
            className={`date-shortcut-pill ${isTomorrowActive ? "active" : ""}`}
            onClick={() => onSelectDate(tomorrowStr)}
            title={`Filter matches for Tomorrow (${tomorrowStr})`}
          >
            Tomorrow
          </button>
        </div>

        {/* Counter and Active Tags */}
        <div className="active-filters-group">
          <div className="fixture-count-tag">
            <span>
              <strong>{fixtureCount}</strong>{" "}
              {fixtureCount === 1 ? "match" : "matches"} found
              {totalAvailableCount > fixtureCount && (
                <span className="count-total-dim"> of {totalAvailableCount}</span>
              )}
            </span>
          </div>

          {/* Active Date Tag */}
          {selectedDate && selectedDate !== "all" && (
            <div className="active-filter-badge">
              <Calendar size={12} />
              <span>{formatDateLabel(selectedDate)}</span>
              <button
                type="button"
                onClick={() => onSelectDate("all")}
                title="Remove date filter"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Active Round Tag */}
          {selectedRound && selectedRound !== "all" && (
            <div className="active-filter-badge">
              <Layers size={12} />
              <span>{selectedRound}</span>
              <button
                type="button"
                onClick={() => onSelectRound("all")}
                title="Remove round filter"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Reset All Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              className="btn-reset-filters"
              onClick={onClearFilters}
              title="Reset all search, date and round filters"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}

          {selectedCompetition !== "all" && (
            <button
              type="button"
              className="btn-back-all-leagues"
              onClick={() => onSelectCompetition("all")}
              title="Show all leagues grouped"
            >
              <Globe size={13} />
              <span>Show All Leagues</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
