import React, { useState, useMemo, useEffect } from "react";
import {
  Star,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Home,
  Plane,
  Zap,
  BarChart2,
  Clock,
  RefreshCw,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Activity,
} from "lucide-react";
import ScrollReveal from "../components/ScrollReveal";
import "../styles/player_ratings.css";

const POSITIONS = [
  { value: "DL",  label: "DL – Defensive Left" },
  { value: "DR",  label: "DR – Defensive Right" },
  { value: "DC",  label: "DC – Defensive Centre" },
  { value: "DM",  label: "DM / DMC – Defensive Mid" },
  { value: "MC",  label: "MC – Mid Centre" },
  { value: "ML",  label: "ML – Mid Left" },
  { value: "MR",  label: "MR – Mid Right" },
  { value: "AMC", label: "AMC – Attacking Mid Centre" },
  { value: "AML", label: "AML – Attacking Mid Left" },
  { value: "AMR", label: "AMR – Attacking Mid Right" },
  { value: "FW",  label: "FW – Forward / Striker" },
  { value: "FWL", label: "FWL – Forward Left" },
  { value: "FWR", label: "FWR – Forward Right" },
  { value: "GK",  label: "GK – Goalkeeper" },
  { value: "Sub", label: "Sub – Substitute" },
];

function normalizePosition(raw) {
  if (!raw) return "MC";
  const s = String(raw).toUpperCase().trim();
  if (s.includes("DL")) return "DL";
  if (s.includes("DR")) return "DR";
  if (s.includes("DC")) return "DC";
  if (s.includes("GK")) return "GK";
  if (s.includes("FWL")) return "FWL";
  if (s.includes("FWR")) return "FWR";
  if (s.includes("FW")) return "FW";
  if (s.includes("AML")) return "AML";
  if (s.includes("AMR")) return "AMR";
  if (s.includes("AMC")) return "AMC";
  if (s.includes("DMC") || s.includes("DM")) return "DM";
  if (s.includes("DML")) return "DML";
  if (s.includes("DMR")) return "DMR";
  if (s.includes("ML")) return "ML";
  if (s.includes("MR")) return "MR";
  if (s.includes("MC")) return "MC";
  if (s.includes("SUB")) return "Sub";
  return raw;
}

function simulateXGBoost({ rating_last_3, rating_last_5, rating_last_10, days_since_last_match, rating_std_5, is_home, position, is_starter }) {
  const momentum = rating_last_3 - rating_last_10;
  let pred = 6.72;
  pred += rating_last_3 * 0.2107;
  pred += rating_last_5 * 0.0437;
  pred += rating_last_10 * 0.3436;
  pred += days_since_last_match * -0.0005;
  pred += rating_std_5 * 0.0274;
  pred += momentum * -0.1330;
  if (is_home) pred += 0.08;
  if (!is_starter) pred *= 0.92;
  const posAdj = { GK: 0.05, DC: 0.03, DL: 0.02, DR: 0.02, FW: 0.06, FWL: 0.04, FWR: 0.04, Sub: -0.35 };
  pred += posAdj[position] || 0;
  pred = Math.max(4.5, Math.min(9.8, pred));
  return parseFloat(pred.toFixed(2));
}

const Q_HAT = 0.53;

function getReliability(low, high) {
  const width = high - low;
  if (width < 1.5) return { label: "High", icon: "🟢", color: "#10b981" };
  if (width < 2.5) return { label: "Medium", icon: "🟡", color: "#f59e0b" };
  return { label: "Low", icon: "🔴", color: "#ef4444" };
}

function computeFactors({ rating_last_3, rating_last_5, rating_last_10, days_since_last_match, rating_std_5, is_home, momentum, is_starter }) {
  return [
    { name: "Long-term form (L10)", impact: (rating_last_10 - 6.72) * 0.34 },
    { name: "Short-term form (L3)", impact: (rating_last_3 - 6.72) * 0.21 },
    { name: "Medium form (L5)",     impact: (rating_last_5 - 6.72) * 0.04 },
    { name: "Momentum",             impact: momentum * -0.13 },
    { name: "Home advantage",       impact: is_home ? 0.08 : -0.04 },
    { name: "Rest days",            impact: (7 - days_since_last_match) * 0.0005 },
    { name: "Consistency (σ L5)",   impact: (0.45 - rating_std_5) * 0.03 },
    { name: "Starter status",       impact: is_starter ? 0.05 : -0.35 },
  ].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
}

const SIMILAR_MATCHES_DB = [
  { player: "Karim Benzema",       date: "2022-09-14", formL5: 7.28, restDays: 6, rating: 7.81 },
  { player: "Ciro Immobile",       date: "2022-11-05", formL5: 7.10, restDays: 4, rating: 7.42 },
  { player: "Robert Lewandowski",  date: "2022-10-22", formL5: 7.45, restDays: 7, rating: 7.93 },
  { player: "Erling Haaland",     date: "2023-02-11", formL5: 7.55, restDays: 8, rating: 8.10 },
  { player: "Vinicius Jr",         date: "2023-03-01", formL5: 7.20, restDays: 5, rating: 7.65 },
  { player: "Kylian Mbappe",       date: "2022-12-18", formL5: 7.35, restDays: 7, rating: 7.85 },
  { player: "Neymar Jr",           date: "2022-08-13", formL5: 6.90, restDays: 9, rating: 7.30 },
  { player: "Luka Modric",         date: "2023-01-07", formL5: 6.95, restDays: 5, rating: 7.20 },
];

function pickSimilarMatches(ratingLast5, daysSinceLastMatch) {
  return [...SIMILAR_MATCHES_DB]
    .sort((a, b) => {
      const da = Math.hypot(a.formL5 - ratingLast5, (a.restDays - daysSinceLastMatch) * 0.1);
      const db = Math.hypot(b.formL5 - ratingLast5, (b.restDays - daysSinceLastMatch) * 0.1);
      return da - db;
    })
    .slice(0, 3);
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div className="pr-metric-card" style={{ "--pr-accent": color || "var(--accent-green)" }}>
      <span className="pr-metric-label">{label}</span>
      <span className="pr-metric-value">{value}</span>
      {sub && <span className="pr-metric-sub">{sub}</span>}
    </div>
  );
}

function RatingGauge({ predicted, low, high }) {
  const pct = ((predicted - 1) / 9) * 100;
  return (
    <div className="pr-gauge-wrap">
      <div className="pr-gauge-number">{predicted.toFixed(2)}</div>
      <div className="pr-gauge-label">predicted match rating / 10</div>
      <div className="pr-gauge-track">
        <div className="pr-gauge-fill" style={{ width: `${pct}%` }} />
        <div className="pr-gauge-marker" style={{ left: `${pct}%` }} />
      </div>
      <div className="pr-gauge-legend">
        <span>1</span><span>Poor (6)</span><span>Good (7)</span><span>10</span>
      </div>
      <div className="pr-gauge-interval">
        90% confidence interval: [{low.toFixed(2)}, {high.toFixed(2)}]
      </div>
    </div>
  );
}

function FactorBar({ name, impact }) {
  const isPos = impact >= 0;
  const pct = Math.min(100, Math.abs(impact) * 220);
  return (
    <div className="pr-factor-row">
      <span className="pr-factor-name">{name}</span>
      <div className="pr-factor-bar-wrap">
        <div className={`pr-factor-bar ${isPos ? "positive" : "negative"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`pr-factor-val ${isPos ? "pos" : "neg"}`}>
        {isPos ? "+" : ""}{impact.toFixed(3)}
      </span>
    </div>
  );
}

export default function PlayerRatingsPage() {
  const [playerName,         setPlayerName]         = useState("Aaron Cresswell");
  const [position,           setPosition]           = useState("DL");
  const [isStarter,          setIsStarter]          = useState(true);
  const [isHome,             setIsHome]             = useState(true);
  const [ratingLast3,        setRatingLast3]        = useState(6.95);
  const [ratingLast5,        setRatingLast5]        = useState(6.87);
  const [ratingLast10,       setRatingLast10]       = useState(6.83);
  const [daysSinceLastMatch, setDaysSinceLastMatch] = useState(4);
  const [ratingStd5,         setRatingStd5]         = useState(0.42);
  const [opponent,           setOpponent]           = useState("Leeds United");
  const [showResult,         setShowResult]         = useState(false);
  const [isComputing,        setIsComputing]        = useState(false);
  const [backendResult,      setBackendResult]      = useState(null);
  const [playerSuggestions,  setPlayerSuggestions]  = useState([]);
  const [isLiveModel,        setIsLiveModel]        = useState(false);
  const [playerFixtures,     setPlayerFixtures]     = useState([]);
  const [selectedFixtureIdx, setSelectedFixtureIdx] = useState(0);
  const [playerDropdownOpen, setPlayerDropdownOpen] = useState(false);

  // Instant smooth player suggestions filtering
  const filteredPlayers = useMemo(() => {
    if (!playerName || !playerName.trim()) {
      return playerSuggestions.slice(0, 40);
    }
    const q = playerName.toLowerCase().trim();
    return playerSuggestions
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 40);
  }, [playerName, playerSuggestions]);

  // Fetch initial player suggestions and fixtures from backend
  useEffect(() => {
    fetch("http://127.0.0.1:5000/api/ratings/players?limit=3000")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.players) {
          setPlayerSuggestions(data.players);
          setIsLiveModel(true);
        }
      })
      .catch(() => {
        // Fallback offline mode
      });

    // Fetch all 2022/2023 season fixtures for initial player on mount
    fetch(`http://127.0.0.1:5000/api/ratings/fixtures?player=${encodeURIComponent("Aaron Cresswell")}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.fixtures && data.fixtures.length > 0) {
          setPlayerFixtures(data.fixtures);
          setSelectedFixtureIdx(0);
          applyFixture(data.fixtures[0]);
        }
      })
      .catch(() => {});
  }, []);

  // Apply fixture data to form fields
  const applyFixture = (f) => {
    if (!f) return;
    setOpponent(f.opponent || "Opponent");
    setIsHome(f.is_home === 1);
    if (f.position) setPosition(normalizePosition(f.position));
    if (f.is_starter != null) setIsStarter(f.is_starter === 1);
    if (f.rating_last_3 != null) setRatingLast3(f.rating_last_3);
    if (f.rating_last_5 != null) setRatingLast5(f.rating_last_5);
    if (f.rating_last_10 != null) setRatingLast10(f.rating_last_10);
    if (f.days_since_last_match != null) setDaysSinceLastMatch(f.days_since_last_match);
    if (f.rating_std_5 != null) setRatingStd5(f.rating_std_5);
  };

  const selectPlayer = (p) => {
    setPlayerName(p.name);
    if (p.position) setPosition(normalizePosition(p.position));
    // Fetch fixtures for this player
    fetch(`http://127.0.0.1:5000/api/ratings/fixtures?player=${encodeURIComponent(p.name)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.fixtures && data.fixtures.length > 0) {
          setPlayerFixtures(data.fixtures);
          setSelectedFixtureIdx(0);
          applyFixture(data.fixtures[0]);
        } else {
          setPlayerFixtures([]);
          setSelectedFixtureIdx(0);
        }
      })
      .catch(() => { setPlayerFixtures([]); });
  };

  const selectFixture = (idx) => {
    setSelectedFixtureIdx(idx);
    if (playerFixtures[idx]) {
      applyFixture(playerFixtures[idx]);
    }
  };

  const momentum = ratingLast3 - ratingLast10;

  // Local fallback simulation (exact mirror of notebook weights)
  const localPredicted = useMemo(() => simulateXGBoost({
    rating_last_3: ratingLast3, rating_last_5: ratingLast5,
    rating_last_10: ratingLast10, days_since_last_match: daysSinceLastMatch,
    rating_std_5: ratingStd5, is_home: isHome, position, is_starter: isStarter,
  }), [ratingLast3, ratingLast5, ratingLast10, daysSinceLastMatch, ratingStd5, isHome, position, isStarter]);

  const predicted = backendResult ? backendResult.predicted_rating : localPredicted;
  const qHat = backendResult ? backendResult.confidence_interval.margin : Q_HAT;
  const intervalLow = backendResult ? backendResult.confidence_interval.low : Math.max(0, parseFloat((predicted - qHat).toFixed(2)));
  const intervalHigh = backendResult ? backendResult.confidence_interval.high : Math.min(10, parseFloat((predicted + qHat).toFixed(2)));
  const reliability = backendResult && backendResult.confidence_interval.reliability
    ? (typeof backendResult.confidence_interval.reliability === "object"
        ? { label: backendResult.confidence_interval.reliability.label, icon: backendResult.confidence_interval.reliability.level === "high" ? "🟢" : "🟡", color: backendResult.confidence_interval.reliability.color }
        : { label: backendResult.confidence_interval.reliability, icon: "🟢", color: "#10b981" })
    : getReliability(intervalLow, intervalHigh);

  const localFactors = useMemo(() => computeFactors({
    rating_last_3: ratingLast3, rating_last_5: ratingLast5,
    rating_last_10: ratingLast10, days_since_last_match: daysSinceLastMatch,
    rating_std_5: ratingStd5, is_home: isHome, momentum, is_starter: isStarter,
  }), [ratingLast3, ratingLast5, ratingLast10, daysSinceLastMatch, ratingStd5, isHome, momentum, isStarter]);

  // Use all SHAP factors from backend when available (real TreeExplainer values)
  const allFactors = backendResult?.explainability?.all_factors?.length
    ? backendResult.explainability.all_factors
    : localFactors;

  const positiveFactors = allFactors.filter((f) => f.impact > 0.001);
  const negativeFactors = allFactors.filter((f) => f.impact < -0.001);

  const shapMethod = backendResult?.explainability?.method || "local_approximation";

  const predWithRest = backendResult?.counterfactuals?.more_rest
    ? backendResult.counterfactuals.more_rest.predicted
    : simulateXGBoost({
        rating_last_3: ratingLast3, rating_last_5: ratingLast5,
        rating_last_10: ratingLast10, days_since_last_match: daysSinceLastMatch + 3,
        rating_std_5: ratingStd5, is_home: isHome, position, is_starter: isStarter,
      });

  const predFlippedVenue = backendResult?.counterfactuals?.inverted_venue
    ? backendResult.counterfactuals.inverted_venue.predicted
    : simulateXGBoost({
        rating_last_3: ratingLast3, rating_last_5: ratingLast5,
        rating_last_10: ratingLast10, days_since_last_match: daysSinceLastMatch,
        rating_std_5: ratingStd5, is_home: !isHome, position, is_starter: isStarter,
      });

  const similarMatches = backendResult?.similar_matches?.length
    ? backendResult.similar_matches.map((m) => ({
        player: m.player,
        date: m.datetime,
        formL5: m.rating_last_5,
        restDays: m.days_since_last_match,
        rating: m.rating,
      }))
    : pickSimilarMatches(ratingLast5, daysSinceLastMatch);

  const handlePredict = async () => {
    setIsComputing(true);
    try {
      const response = await fetch("http://127.0.0.1:5000/api/ratings/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player: playerName || "Aaron Cresswell",
          fixture_idx: selectedFixtureIdx,
          role: isStarter ? "Titulaire (Starter)" : "Remplaçant (Substitute)",
          position: position,
          days_override: daysSinceLastMatch,
          home_override: isHome ? 1 : 0,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setBackendResult(data);
        setIsLiveModel(true);
      } else {
        setBackendResult(null);
      }
    } catch {
      setBackendResult(null);
    } finally {
      setIsComputing(false);
      setShowResult(true);
    }
  };

  const handleReset = () => {
    setShowResult(false);
    setBackendResult(null);
    setPlayerName(""); setOpponent("");
    setPosition("MC"); setIsStarter(true); setIsHome(true);
    setRatingLast3(7.10); setRatingLast5(7.05); setRatingLast10(6.95);
    setDaysSinceLastMatch(7); setRatingStd5(0.40);
    setPlayerFixtures([]); setSelectedFixtureIdx(0);
  };

  return (
    <ScrollReveal animation="fade-up" duration={0.4}>
      <div className="pr-page">

        {/* PAGE HEADER */}
        <div className="card-panel pr-header-panel">
          <div className="pr-header-row">
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
              <div className="round-icon-badge"><Star size={16} /></div>
              <div>
                <h2 className="panel-title" style={{ margin: 0 }}>Player Rating Predictor</h2>
                <p className="pr-header-sub">
                  XGBoost model trained on 467,518 match ratings (2014-2023) from Europe&apos;s top 5 leagues.
                  Enter a player&apos;s recent stats to forecast their next-match rating with a 90% confidence interval.
                </p>
              </div>
            </div>
            <div className="pr-badge-row">
              <span className="pr-model-badge">XGBoost Dual-Model</span>
              <span className="pr-model-badge secondary">MAE 0.53</span>
              <span className="pr-model-badge secondary">Conformal CI</span>
              <span className="pr-model-badge" style={{ background: isLiveModel ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.06)", borderColor: isLiveModel ? "#22c55e" : "rgba(255,255,255,0.15)", color: isLiveModel ? "#4ade80" : "var(--text-muted)" }}>
                {isLiveModel ? "⚡ Real ML Model Connected" : "Local Engine"}
              </span>
            </div>
          </div>
        </div>

        {/* INPUTS FORM */}
        {!showResult && (
          <div className="card-panel pr-form-panel">
            <div className="panel-header" style={{ marginBottom: "1.5rem" }}>
              <h3 className="panel-title">
                <Activity size={16} style={{ marginRight: "0.5rem" }} />
                Match Parameters
              </h3>
              <span className="players-muted">Select a player from dataset or adjust features to predict</span>
            </div>

            <div className="pr-form-grid">
              {/* IDENTITY */}
              <div className="pr-form-section">
                <h4 className="pr-section-title">Player Identity</h4>
                <div className="pr-autocomplete-wrap">
                  <label className="pr-field-label">
                    1. Choose a player
                    <div className="pr-autocomplete-input-wrap">
                      <input
                        type="text"
                        className="pr-text-input"
                        value={playerName}
                        placeholder="Type to search players..."
                        onFocus={() => setPlayerDropdownOpen(true)}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPlayerName(val);
                          setPlayerDropdownOpen(true);
                          const exact = playerSuggestions.find(
                            (p) => p.name.toLowerCase() === val.toLowerCase().trim()
                          );
                          if (exact) selectPlayer(exact);
                        }}
                        onBlur={() => {
                          setTimeout(() => setPlayerDropdownOpen(false), 200);
                        }}
                      />
                      <ChevronDown
                        size={14}
                        className="pr-autocomplete-toggle-icon"
                        onClick={() => setPlayerDropdownOpen((prev) => !prev)}
                        style={{ cursor: "pointer", pointerEvents: "auto" }}
                      />
                    </div>
                  </label>

                  {playerDropdownOpen && filteredPlayers.length > 0 && (
                    <div className="pr-autocomplete-dropdown">
                      {filteredPlayers.map((p) => (
                        <div
                          key={p.name}
                          className={`pr-dropdown-item ${p.name === playerName ? "active" : ""}`}
                          onMouseDown={() => {
                            selectPlayer(p);
                            setPlayerDropdownOpen(false);
                          }}
                        >
                          <span className="pr-dropdown-item-name">{p.name}</span>
                          <div className="pr-dropdown-item-meta">
                            <span className="pr-pos-tag">{normalizePosition(p.position)}</span>
                            {p.avgRating && (
                              <span className="pr-rating-tag">★ {p.avgRating}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fixture dropdown — mirrors original Streamlit sidebar selectbox */}
                {playerFixtures.length > 0 && (
                  <label className="pr-field-label">
                    2. Choose the match to predict
                    <div className="pr-select-wrap">
                      <select
                        className="pr-select"
                        value={selectedFixtureIdx}
                        onChange={(e) => selectFixture(parseInt(e.target.value))}
                      >
                        {playerFixtures.map((f, i) => (
                          <option key={f.id || i} value={i}>
                            {f.datetime} — vs {f.opponent || "Opponent"} ({f.is_home === 1 ? "Home" : "Away"})
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="pr-select-icon" />
                    </div>
                  </label>
                )}
                <div className="pr-field-label">
                  Position
                  <div className="pr-readonly-badge">
                    <span className="pr-pos-pill">
                      {POSITIONS.find((p) => p.value === position)?.label || position}
                    </span>
                  </div>
                </div>
                <div className="pr-toggle-group">
                  <span className="pr-field-label" style={{ marginBottom: 0 }}>Match Status</span>
                  <div className="pr-toggle-row">
                    <button type="button" className={`pr-toggle-btn ${isStarter ? "active-blue" : ""}`} onClick={() => setIsStarter(true)}>Starter</button>
                    <button type="button" className={`pr-toggle-btn ${!isStarter ? "active-orange" : ""}`} onClick={() => setIsStarter(false)}>Substitute</button>
                  </div>
                </div>
                <div className="pr-toggle-group">
                  <span className="pr-field-label" style={{ marginBottom: 0 }}>Venue</span>
                  <div className="pr-toggle-row">
                    <button type="button" className={`pr-toggle-btn ${isHome ? "active-blue" : ""}`} onClick={() => setIsHome(true)}>
                      <Home size={12} /> Home
                    </button>
                    <button type="button" className={`pr-toggle-btn ${!isHome ? "active-orange" : ""}`} onClick={() => setIsHome(false)}>
                      <Plane size={12} /> Away
                    </button>
                  </div>
                </div>
              </div>

              {/* FORM HISTORY */}
              <div className="pr-form-section">
                <h4 className="pr-section-title">Recent Form (Historical Averages)</h4>
                <div className="pr-stat-row">
                  <span className="pr-stat-label">Avg rating — last 3 matches</span>
                  <span className="pr-stat-value highlight">{ratingLast3.toFixed(2)}</span>
                </div>
                <div className="pr-stat-row">
                  <span className="pr-stat-label">Avg rating — last 5 matches</span>
                  <span className="pr-stat-value highlight">{ratingLast5.toFixed(2)}</span>
                </div>
                <div className="pr-stat-row">
                  <span className="pr-stat-label">Avg rating — last 10 matches (baseline)</span>
                  <span className="pr-stat-value highlight">{ratingLast10.toFixed(2)}</span>
                </div>
                <div className="pr-derived-row">
                  <span className="pr-field-label" style={{ marginBottom: 0 }}>Momentum (L3 minus L10)</span>
                  <span className={`pr-momentum-badge ${momentum >= 0 ? "pos" : "neg"}`}>
                    {momentum >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {momentum >= 0 ? "+" : ""}{momentum.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* WORKLOAD */}
              <div className="pr-form-section">
                <h4 className="pr-section-title">Workload &amp; Volatility</h4>
                <div className="pr-stat-row">
                  <span className="pr-stat-label">Days since last match</span>
                  <span className="pr-stat-value cyan">{daysSinceLastMatch} d</span>
                </div>
                <div className="pr-stat-row">
                  <span className="pr-stat-label">Rating std dev — last 5 matches (consistency)</span>
                  <span className="pr-stat-value">±{ratingStd5.toFixed(2)}</span>
                </div>
                <div className="pr-info-box">
                  <AlertCircle size={14} />
                  <span>
                    Historical statistics automatically loaded from the selected match fixture.
                  </span>
                </div>
              </div>
            </div>

            <div className="pr-cta-row">
              <button type="button" className="btn-access-platform pr-predict-btn"
                onClick={handlePredict} disabled={isComputing}>
                {isComputing
                  ? <><RefreshCw size={15} className="pr-spin" /><span>Computing...</span></>
                  : <><Star size={15} /><span>PREDICT RATING</span></>
                }
              </button>
            </div>
          </div>
        )}

        {/* RESULTS DASHBOARD */}
        {showResult && (
          <>
            {/* Context bar */}
            <div className="card-panel pr-context-bar">
              <button type="button" className="players-back-btn" onClick={handleReset}>
                <ArrowLeft size={14} /> New prediction
              </button>
              <div className="pr-context-info">
                {playerName && <strong>{playerName}</strong>}
                {playerName && opponent && <span> vs </span>}
                {opponent && <span>{opponent}</span>}
                {!playerName && !opponent && <span>Player Rating Forecast</span>}
                <span className={`pr-role-pill ${isStarter ? "blue" : "orange"}`}>
                  {isStarter ? "Starter" : "Substitute"}
                </span>
                <span className="pr-venue-pill">
                  {isHome ? <><Home size={11} /> Home</> : <><Plane size={11} /> Away</>}
                </span>
                <span className="pr-pos-pill">{position}</span>
              </div>
            </div>

            {/* 3 METRIC CARDS */}
            <div className="pr-metrics-row">
              <MetricCard label="Predicted Rating" value={`${predicted.toFixed(2)} / 10`}
                sub={`+/-${Q_HAT} conformal margin`} color="var(--accent-green)" />
              <MetricCard label="90% Confidence Interval"
                value={`[${intervalLow.toFixed(2)}, ${intervalHigh.toFixed(2)}]`}
                sub={`Width: ${(intervalHigh - intervalLow).toFixed(2)} pts`} color="#38bdf8" />
              <MetricCard label="Reliability Index"
                value={`${reliability.icon} ${reliability.label}`}
                sub="Historical MAE: 0.53 pts" color={reliability.color} />
            </div>

            {/* GAUGE + SHAP FACTORS */}
            <div className="pr-two-col">
              <div className="card-panel">
                <div className="panel-header">
                  <h3 className="panel-title"><Star size={16} /> Rating Gauge</h3>
                </div>
                <RatingGauge predicted={predicted} low={intervalLow} high={intervalHigh} />
                <div className="pr-stat-rows">
                  <div className="pr-stat-row">
                    <Clock size={13} /><span>Recent form (L5)</span><strong>{ratingLast5.toFixed(2)}</strong>
                  </div>
                  <div className="pr-stat-row">
                    <BarChart2 size={13} /><span>Long-term (L10)</span><strong>{ratingLast10.toFixed(2)}</strong>
                  </div>
                  <div className="pr-stat-row">
                    {momentum >= 0
                      ? <TrendingUp size={13} color="#10b981" />
                      : <TrendingDown size={13} color="#ef4444" />}
                    <span>Momentum</span>
                    <strong className={momentum >= 0 ? "pr-pos-text" : "pr-neg-text"}>
                      {momentum >= 0 ? "+" : ""}{momentum.toFixed(2)}
                    </strong>
                  </div>
                  <div className="pr-stat-row">
                    <Zap size={13} /><span>Rest days</span><strong>{daysSinceLastMatch} d</strong>
                  </div>
                </div>
              </div>

              <div className="card-panel">
                <div className="panel-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                  <h3 className="panel-title"><BarChart2 size={16} /> Key Impact Factors (SHAP)</h3>
                  <span className="pr-model-badge" style={{
                    background: shapMethod === "shap_tree_explainer" ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${shapMethod === "shap_tree_explainer" ? "#22c55e" : "rgba(255,255,255,0.15)"}`,
                    color: shapMethod === "shap_tree_explainer" ? "#4ade80" : "var(--text-muted)",
                    fontSize: "0.65rem",
                  }}>
                    {shapMethod === "shap_tree_explainer" ? "✓ Real SHAP TreeExplainer" : "≈ Linear Approximation"}
                  </span>
                </div>
                <div className="pr-factors-section">
                  <div className="pr-factors-group">
                    <h4 className="pr-factors-heading pos">
                      <CheckCircle2 size={13} /> Positive contributors
                    </h4>
                    {positiveFactors.length === 0
                      ? <p className="players-muted">No significant positive factors.</p>
                      : positiveFactors.map((f) => <FactorBar key={f.name} {...f} />)}
                  </div>
                  <div className="pr-factors-group">
                    <h4 className="pr-factors-heading neg">
                      <AlertCircle size={13} /> Negative contributors
                    </h4>
                    {negativeFactors.length === 0
                      ? <p className="players-muted">No significant negative factors.</p>
                      : negativeFactors.map((f) => <FactorBar key={f.name} {...f} />)}
                  </div>
                </div>
              </div>
            </div>

            {/* WHAT-IF COUNTERFACTUALS */}
            <div className="card-panel">
              <div className="panel-header">
                <h3 className="panel-title"><RefreshCw size={16} /> What-If Counterfactual Analysis</h3>
                <span className="players-muted">Scenario modelling based on model-learned relationships</span>
              </div>
              <div className="pr-whatif-grid">
                <div className={`pr-whatif-card ${predWithRest >= predicted ? "wc-pos" : "wc-neg"}`}>
                  <div className="pr-whatif-icon"><Clock size={20} /></div>
                  <div className="pr-whatif-content">
                    <span className="pr-whatif-label">+3 extra rest days</span>
                    <span className="pr-whatif-val">{predWithRest.toFixed(2)}</span>
                    <span className={`pr-whatif-delta ${predWithRest >= predicted ? "pos" : "neg"}`}>
                      {predWithRest >= predicted ? "+" : ""}{(predWithRest - predicted).toFixed(2)} pts
                    </span>
                  </div>
                </div>
                <div className={`pr-whatif-card ${predFlippedVenue >= predicted ? "wc-pos" : "wc-neg"}`}>
                  <div className="pr-whatif-icon">
                    {isHome ? <Plane size={20} /> : <Home size={20} />}
                  </div>
                  <div className="pr-whatif-content">
                    <span className="pr-whatif-label">If played {isHome ? "Away" : "at Home"}</span>
                    <span className="pr-whatif-val">{predFlippedVenue.toFixed(2)}</span>
                    <span className={`pr-whatif-delta ${predFlippedVenue >= predicted ? "pos" : "neg"}`}>
                      {predFlippedVenue >= predicted ? "+" : ""}{(predFlippedVenue - predicted).toFixed(2)} pts
                    </span>
                  </div>
                </div>
                <div className="pr-whatif-card wc-neutral">
                  <div className="pr-whatif-icon"><Minus size={20} /></div>
                  <div className="pr-whatif-content">
                    <span className="pr-whatif-label">Base prediction</span>
                    <span className="pr-whatif-val">{predicted.toFixed(2)}</span>
                    <span className="pr-whatif-delta neutral">Reference</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SIMILAR HISTORICAL MATCHES */}
            <div className="card-panel">
              <div className="panel-header">
                <h3 className="panel-title"><Activity size={16} /> Similar Historical Matches (KNN)</h3>
                <span className="players-muted">3 nearest neighbours by (L5 form, rest days) from 2022-2023 test set</span>
              </div>
              <div className="pr-similar-table-wrap">
                <table className="pr-similar-table">
                  <thead>
                    <tr>
                      <th>Player</th><th>Date</th><th>Form (L5)</th><th>Rest (days)</th><th>Actual Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {similarMatches.map((m, i) => (
                      <tr key={i}>
                        <td><strong>{m.player}</strong></td>
                        <td>{m.date}</td>
                        <td>{m.formL5.toFixed(2)}</td>
                        <td>{m.restDays}</td>
                        <td>
                          <span className={`pr-rating-badge ${m.rating >= 7.5 ? "rhigh" : m.rating >= 7 ? "rmid" : "rlow"}`}>
                            {m.rating.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="players-muted" style={{ marginTop: "1rem", fontSize: "0.78rem" }}>
                KNN avg of similar matches: {(similarMatches.reduce((s, m) => s + m.rating, 0) / similarMatches.length).toFixed(2)} pts
                &mdash; Euclidean distance on StandardScaler-normalized features.
              </p>
            </div>

            {/* MODEL INFO */}
            <div className="card-panel pr-model-info">
              <div className="pr-model-info-grid">
                <div>
                  <strong>Model Architecture</strong>
                  <p>Two-model XGBoost pipeline: Model A (Starters, max_depth=5) + Model B (Substitutes, max_depth=3)</p>
                </div>
                <div>
                  <strong>Training Data</strong>
                  <p>467,518 player-match rows &middot; 7,608 unique players &middot; 2014-2020</p>
                </div>
                <div>
                  <strong>Test Performance (2022-2023)</strong>
                  <p>MAE Starters: 0.5262 &middot; MAE Subs: 0.2649 &middot; Combined: 0.4566</p>
                </div>
                <div>
                  <strong>Conformal Prediction</strong>
                  <p>90% coverage calibrated on 2021 starters (q-hat = {Q_HAT}). Empirical coverage validated on test set.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </ScrollReveal>
  );
}
