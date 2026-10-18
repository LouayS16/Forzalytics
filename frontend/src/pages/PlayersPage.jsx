import React, { useEffect, useMemo, useState } from "react";
import {
  HeartPulse,
  Search,
  ArrowLeft,
  Calendar,
  Stethoscope,
  ShieldCheck,
  TriangleAlert,
  Info,
  UserRound,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import {
  searchPlayers,
  fetchPlayerInjuryRisk,
  fetchPlayerPhotos,
  fetchPlayerPhoto,
} from "../services/playersApi";
import ScrollReveal from "../components/ScrollReveal";
import LoadingState from "../components/LoadingState";
import "../styles/players.css";

const LEVEL_META = {
  low: { label: "Low risk", color: "#10b981" },
  medium: { label: "Medium risk", color: "#f59e0b" },
  high: { label: "High risk", color: "#ef4444" },
};

const pct = (p) => (p == null ? "N/A" : `${(p * 100).toFixed(1)}%`);
const val = (v, suffix = "") => (v == null ? "N/A" : `${v}${suffix}`);

const formatMonth = (m) => {
  if (!m) return "";
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
};

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function PlayerPhoto({ src, name, size }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="player-photo" style={{ width: size, height: size }}>
      {src && !failed ? (
        <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <UserRound size={Math.round(size * 0.45)} />
      )}
    </div>
  );
}

function RiskPill({ level, probability }) {
  const meta = LEVEL_META[level] || LEVEL_META.low;
  return (
    <span className="risk-pill" style={{ "--risk-color": meta.color }}>
      <span className="risk-pill-dot" />
      {meta.label}
      {probability != null && <strong>{pct(probability)}</strong>}
    </span>
  );
}

function RiskGauge({ prediction }) {
  const meta = LEVEL_META[prediction.level] || LEVEL_META.low;
  // Bar scale: 0 → 50% (probabilities above 50% are rare)
  const scale = 0.5;
  const pos = (p) => `${Math.min(p / scale, 1) * 100}%`;
  return (
    <div className="risk-gauge" style={{ "--risk-color": meta.color }}>
      <div className="risk-gauge-value">{pct(prediction.probability)}</div>
      <div className="risk-gauge-label">chance of injury this month</div>
      <RiskPill level={prediction.level} />
      <div className="risk-bar">
        <div className="risk-bar-zone low" style={{ width: pos(prediction.thresholds.medium) }} />
        <div
          className="risk-bar-zone medium"
          style={{ width: `calc(${pos(prediction.thresholds.high)} - ${pos(prediction.thresholds.medium)})` }}
        />
        <div className="risk-bar-zone high" style={{ flex: 1 }} />
        <div className="risk-bar-marker" style={{ left: pos(prediction.probability) }} />
      </div>
      <div className="risk-bar-legend">
        <span>0%</span>
        <span>Medium ≥ {pct(prediction.thresholds.medium)}</span>
        <span>High ≥ {pct(prediction.thresholds.high)}</span>
        <span>50%+</span>
      </div>
      <p className="risk-gauge-note">
        Average monthly injury rate across all players: <strong>{pct(prediction.baseRate)}</strong>
      </p>
    </div>
  );
}

function TimelineTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="timeline-tooltip">
      <strong>{formatMonth(d.month)}</strong>
      <span>Predicted risk: {pct(d.probability)}</span>
      <span style={{ color: d.injured ? "#ef4444" : "#10b981" }}>
        {d.injured ? "Injured that month" : "Not injured"}
      </span>
    </div>
  );
}

function InjuredDot({ cx, cy, payload }) {
  if (cx == null || cy == null) return null;
  if (!payload.injured) return <circle cx={cx} cy={cy} r={2.5} fill="#38bdf8" />;
  return <circle cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#121826" strokeWidth={2} />;
}

function PlayerRiskDetail({ data, photo, isLoading, onChangeMonth, onBack }) {
  const monthsDesc = useMemo(() => [...data.availableMonths].reverse(), [data.availableMonths]);
  const { prediction, outcome, features, profile } = data;

  const featureGroups = [
    {
      title: "Workload",
      items: [
        ["Matches (30 days)", val(features.matches30d)],
        ["Matches (90 days)", val(features.matches90d)],
        ["Starts (90 days)", val(features.starts90d)],
        ["Days since last match", val(features.daysSinceLastMatch)],
      ],
    },
    {
      title: "Form",
      items: [
        ["Avg rating (last 5)", val(features.avgRatingLast5)],
        ["Avg rating (season)", val(features.avgRatingSeason)],
      ],
    },
    {
      title: "Injury record",
      items: [
        ["Injuries before", val(features.injuriesBefore)],
        ["Injuries (last 365 days)", val(features.injuries365d)],
        ["Days out (last 365 days)", val(features.daysOut365d)],
        ["Serious injuries before", val(features.seriousInjuriesBefore)],
        ["Days since last injury", val(features.daysSinceLastInjury)],
      ],
    },
  ];

  return (
    <div className={`player-detail ${isLoading ? "is-refreshing" : ""}`}>
      <div className="card-panel player-header-card">
        <button type="button" className="players-back-btn" onClick={onBack}>
          <ArrowLeft size={14} />
          <span>Back to search</span>
        </button>
        <div className="player-header-row">
          <div className="player-photo-wrap">
            <PlayerPhoto src={photo?.imageUrl} name={data.player.name} size={96} />
            {photo?.pageUrl && (
              <a className="player-photo-credit" href={photo.pageUrl} target="_blank" rel="noreferrer">
                Photo: Wikipedia
              </a>
            )}
          </div>
          <div className="player-header-info">
            <h2>{data.player.name}</h2>
            <p>
              {data.team} • {data.league}
            </p>
            <div className="player-tags">
              <span>{val(profile.position)}</span>
              <span>{profile.age != null ? `${Math.floor(profile.age)} yrs` : "Age N/A"}</span>
              <span>{profile.height != null ? `${Math.round(profile.height)} cm` : "Height N/A"}</span>
              <span>{profile.foot ? `${profile.foot} foot` : "Foot N/A"}</span>
            </div>
          </div>
          <label className="player-month-select">
            <Calendar size={14} />
            <span>Month</span>
            <select value={data.month} onChange={(e) => onChangeMonth(e.target.value)}>
              {monthsDesc.map((m) => (
                <option key={m} value={m}>
                  {formatMonth(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {data.isTrainingPeriod && (
        <div className="players-notice">
          <Info size={16} />
          <span>
            {formatMonth(data.month)} was part of the model's training data, so this is not a true
            out-of-sample test. Pick a month from Jul 2021 onwards for an honest evaluation.
          </span>
        </div>
      )}

      <div className="player-risk-grid">
        <div className="card-panel">
          <div className="panel-header">
            <h3 className="panel-title">
              <HeartPulse size={18} color="#ef4444" /> Injury risk — {formatMonth(data.month)}
            </h3>
          </div>
          <RiskGauge prediction={prediction} />
        </div>

        <div className="card-panel">
          <div className="panel-header">
            <h3 className="panel-title">
              <Stethoscope size={18} color="#38bdf8" /> What actually happened
            </h3>
          </div>
          {!outcome.known ? (
            <p className="players-muted">Outcome not available for this month.</p>
          ) : outcome.injured ? (
            <div className="outcome-box injured">
              <TriangleAlert size={22} />
              <div>
                <strong>Injured</strong>
                <span>
                  {val(outcome.daysOut, " days out")}
                  {outcome.severity ? ` • ${outcome.severity} severity` : ""}
                </span>
                {outcome.injuries.map((inj) => (
                  <span key={inj.fromDate + inj.reason} className="outcome-injury">
                    {inj.reason} — {formatDate(inj.fromDate)}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="outcome-box healthy">
              <ShieldCheck size={22} />
              <div>
                <strong>Not injured</strong>
                <span>No injury recorded during {formatMonth(data.month)}.</span>
              </div>
            </div>
          )}
          <p className="players-muted" style={{ marginTop: "1rem" }}>
            Model quality on 2021-2023 test data: AUC {data.model.auc_test}. Real injury rate per
            predicted level: low {pct(data.model.injury_rate_by_level.low)}, medium{" "}
            {pct(data.model.injury_rate_by_level.medium)}, high {pct(data.model.injury_rate_by_level.high)}.
          </p>
        </div>
      </div>

      <div className="card-panel">
        <div className="panel-header">
          <h3 className="panel-title">Risk over the last {data.timeline.length} months</h3>
          <span className="players-muted">Red dots = months with a real injury</span>
        </div>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <AreaChart data={data.timeline} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="month" tickFormatter={formatMonth} stroke="#64748b" fontSize={11} minTickGap={24} />
              <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} stroke="#64748b" fontSize={11} />
              <Tooltip content={<TimelineTooltip />} />
              <ReferenceLine y={prediction.thresholds.medium} stroke="#f59e0b" strokeDasharray="4 4" />
              <ReferenceLine y={prediction.thresholds.high} stroke="#ef4444" strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="probability"
                stroke="#38bdf8"
                strokeWidth={2}
                fill="url(#riskFill)"
                dot={<InjuredDot />}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="player-risk-grid">
        <div className="card-panel">
          <div className="panel-header">
            <h3 className="panel-title">Model inputs</h3>
          </div>
          {featureGroups.map((g) => (
            <div key={g.title} className="feature-group">
              <h4>{g.title}</h4>
              {g.items.map(([label, value]) => (
                <div key={label} className="feature-row">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="card-panel">
          <div className="panel-header">
            <h3 className="panel-title">Injury history</h3>
            <span className="players-muted">up to {formatMonth(data.month)}</span>
          </div>
          {data.injuryHistory.length === 0 ? (
            <p className="players-muted">No injuries recorded.</p>
          ) : (
            <ul className="injury-history-list">
              {data.injuryHistory.map((inj) => (
                <li key={inj.fromDate + inj.reason}>
                  <div>
                    <strong>{inj.reason}</strong>
                    <span>
                      {formatDate(inj.fromDate)}
                      {inj.endDate ? ` → ${formatDate(inj.endDate)}` : ""} • season {inj.season}
                    </span>
                  </div>
                  <span className="injury-days">
                    {val(inj.daysMissed, " d")}
                    <small>{val(inj.gamesMissed, " games")}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlayersPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [photos, setPhotos] = useState({});

  const [selected, setSelected] = useState(null);
  const [detailPhoto, setDetailPhoto] = useState(null);
  const [risk, setRisk] = useState(null);
  const [isLoadingRisk, setIsLoadingRisk] = useState(false);
  const [riskError, setRiskError] = useState(null);

  // Debounced search as the user types
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const players = await searchPlayers(q);
        if (!cancelled) {
          setResults(players);
          setSearchError(null);
          // Photos load after the list, so the results never wait for Wikipedia
          fetchPlayerPhotos(players.map((p) => p.name)).then((map) => {
            if (!cancelled) setPhotos((prev) => ({ ...prev, ...map }));
          });
        }
      } catch (err) {
        if (!cancelled) setSearchError(err.message);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const loadRisk = async (name, month) => {
    setIsLoadingRisk(true);
    setRiskError(null);
    try {
      setRisk(await fetchPlayerInjuryRisk(name, month));
    } catch (err) {
      setRiskError(err.message);
    } finally {
      setIsLoadingRisk(false);
    }
  };

  const handleSelect = (player) => {
    setSelected(player);
    setRisk(null);
    setDetailPhoto(photos[player.name] ? { imageUrl: photos[player.name] } : null);
    fetchPlayerPhoto(player.name).then(setDetailPhoto);
    loadRisk(player.name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBack = () => {
    setSelected(null);
    setRisk(null);
    setRiskError(null);
  };

  if (selected) {
    return (
      <ScrollReveal animation="fade-up" duration={0.4}>
        {riskError && (
          <div className="card-panel">
            <button type="button" className="players-back-btn" onClick={handleBack}>
              <ArrowLeft size={14} />
              <span>Back to search</span>
            </button>
            <p className="players-error">{riskError}</p>
          </div>
        )}
        {!risk && !riskError && <LoadingState message={`Computing injury risk for ${selected.name}...`} />}
        {risk && (
          <PlayerRiskDetail
            data={risk}
            photo={detailPhoto}
            isLoading={isLoadingRisk}
            onChangeMonth={(m) => loadRisk(risk.player.name, m)}
            onBack={handleBack}
          />
        )}
      </ScrollReveal>
    );
  }

  return (
    <ScrollReveal animation="fade-up" duration={0.4}>
      <div className="card-panel players-search-panel">
        <div className="players-search-head">
          <div className="round-icon-badge">
            <HeartPulse size={16} />
          </div>
          <div>
            <h2 className="panel-title" style={{ margin: 0 }}>
              Player Injury Risk
            </h2>
            <p className="players-muted">
              Search a player from Europe's top 5 leagues (2014-2023) to see the model's monthly injury risk.
            </p>
          </div>
        </div>

        <div className="players-search-box">
          <Search size={18} className="players-search-icon" />
          <input
            type="text"
            className="players-search-input"
            placeholder="Type a player name, e.g. Messi, Dybala, Mbappé..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button type="button" className="teams-search-clear" onClick={() => setQuery("")} aria-label="Clear">
              ×
            </button>
          )}
        </div>

        {searchError && <p className="players-error">{searchError}</p>}

        {query.trim().length >= 2 && !isSearching && !searchError && results.length === 0 && (
          <p className="players-muted players-empty">No player matches "{query.trim()}".</p>
        )}

        {isSearching && results.length === 0 && <p className="players-muted players-empty">Searching...</p>}

        {results.length > 0 && (
          <>
            <p className="players-muted players-count">
              {results.length} {results.length === 1 ? "player" : "players"} found — pick one
            </p>
            <div className="players-results">
              {results.map((p) => (
                <button key={p.name} type="button" className="player-result-card" onClick={() => handleSelect(p)}>
                  <PlayerPhoto src={photos[p.name]} name={p.name} size={56} />
                  <div className="player-result-main">
                    <strong>{p.name}</strong>
                    <span>
                      {p.team} • {p.league}
                    </span>
                    <span className="players-muted">
                      {val(p.position)} • {p.age != null ? `${Math.floor(p.age)} yrs` : "age N/A"} •{" "}
                      {formatMonth(p.firstMonth)} → {formatMonth(p.lastMonth)}
                    </span>
                  </div>
                  <div className="player-result-risk">
                    <span className="players-muted">Latest ({formatMonth(p.lastMonth)})</span>
                    <RiskPill level={p.latestRisk.level} probability={p.latestRisk.probability} />
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </ScrollReveal>
  );
}
