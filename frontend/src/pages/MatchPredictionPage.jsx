import React, { useEffect } from "react";
import { ArrowLeft, Calendar, Clock, Sparkles } from "lucide-react";
import PredictionResult from "../components/PredictionResult";
import TeamFormCard from "../components/TeamFormCard";
import StatisticsComparison from "../components/StatisticsComparison";
import LoadingState from "../components/LoadingState";
import ErrorMessage from "../components/ErrorMessage";
import ScrollReveal from "../components/ScrollReveal";
import TeamLogo from "../components/TeamLogo";

export default function MatchPredictionPage({
  fixture,
  prediction,
  isPredicting,
  predictionError,
  onPredict,
  onBack,
}) {
  // Scroll to top when opening match prediction page
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [fixture?.id]);

  if (!fixture) {
    return (
      <div className="prediction-page-viewport">
        <div className="prediction-pitch-bg" />
        <div className="prediction-pitch-overlay" />
        <div className="prediction-page-container">
          <div className="match-banner-panel">
            <button type="button" className="banner-back-btn" onClick={onBack}>
              <ArrowLeft size={14} />
              <span>Back to Fixtures Feed</span>
            </button>
          </div>
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "4rem 0" }}>
            No fixture selected. Please return to the feed.
          </p>
        </div>
      </div>
    );
  }

  const { homeTeam, awayTeam, competitionName, kickoffDate, kickoffTime } = fixture;

  return (
    <div className="prediction-page-viewport">
      {/* Stadium Pitch Background Image requested by user */}
      <div className="prediction-pitch-bg" />
      <div className="prediction-pitch-overlay" />

      <div className="prediction-page-container">
        {/* Match Context Banner matching the screen mockup */}
        <div className="match-banner-panel">
          <div className="banner-left">
            <button
              type="button"
              className="banner-back-btn"
              onClick={onBack}
              title="Return to upcoming fixtures feed"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>
            <span className="banner-league-badge">
              {(competitionName || "LEAGUE").toUpperCase()}
            </span>
            <div className="banner-time">
              <Calendar size={13} />
              <span>{kickoffDate}</span>
              <Clock size={13} style={{ marginLeft: "6px" }} />
              <span>{kickoffTime}</span>
            </div>
          </div>

          <div className="banner-right">
            <span className="banner-ai-tag">
              <Sparkles size={14} color="#00ff87" />
              <span>3-Way LightGBM Predictive Engine</span>
            </span>
          </div>
        </div>

        {/* Error Message */}
        <ErrorMessage
          message={predictionError}
          onRetry={() => onPredict && onPredict(fixture)}
        />

        {/* Loading State Spinner */}
        {isPredicting && (
          <div style={{ padding: "4rem 0", position: "relative", zIndex: 10 }}>
            <LoadingState
              message={`Calculating 5-game pre-kickoff rolling statistics for ${homeTeam.name} vs ${awayTeam.name}...`}
            />
          </div>
        )}

        {/* EXACT DESIGN FROM SCREENSHOT: Manual Prediction Launch Hero Card */}
        {!isPredicting && !prediction && (
          <ScrollReveal animation="fade-up" duration={0.6}>
            <div className="card-panel manual-predict-hero">
              <div className="launch-header-row">
                <span className="launch-badge">
                  <Sparkles size={14} color="#00ff87" />
                  <span>PRE-MATCH ANALYSIS ENGINE READY</span>
                </span>
                <span className="launch-model-tag">Model: LightGBM Multiclass</span>
              </div>

              <div className="predict-matchup-header">
                {/* Home Team */}
                <div className="launch-team-side home">
                  <div className="launch-badge-orb home">
                    <TeamLogo name={homeTeam.name} logo={homeTeam.logo} size={50} />
                  </div>
                  <span className="launch-team-name">{homeTeam.name}</span>
                  <span className="launch-venue-tag home">HOME TEAM</span>
                </div>

                {/* Concentric 3D Beveled VS Orb */}
                <div className="launch-vs-orb">
                  <div className="vs-inner-ring">
                    <span>VS</span>
                  </div>
                </div>

                {/* Away Team */}
                <div className="launch-team-side away">
                  <div className="launch-badge-orb away">
                    <TeamLogo name={awayTeam.name} logo={awayTeam.logo} size={50} />
                  </div>
                  <span className="launch-team-name">{awayTeam.name}</span>
                  <span className="launch-venue-tag away">AWAY TEAM</span>
                </div>
              </div>

              <div className="predict-cta-box">
                <h3 className="predict-cta-title">
                  Predict the Outcome
                </h3>
                <p className="predict-cta-desc">
                  Analyze recent team form and home advantage to uncover the probabilities of a home win, draw, or away win.
                </p>
                <p className="predict-cta-prompt">
                  <strong>Ready to see the prediction?</strong>
                </p>

                <button
                  type="button"
                  className="btn-launch-prediction"
                  onClick={() => onPredict && onPredict(fixture)}
                >
                  <Sparkles size={18} />
                  <span>Launch Prediction Engine</span>
                </button>
              </div>
            </div>
          </ScrollReveal>
        )}

        {/* Active Prediction Forecast Result */}
        {!isPredicting && prediction && (
          <ScrollReveal animation="fade-up" duration={0.6}>
            <PredictionResult prediction={prediction} />
          </ScrollReveal>
        )}

        {/* Pre-Kickoff 5-Match Rolling Form Panels (Home & Away) */}
        {!isPredicting && prediction && (
          <ScrollReveal animation="fade-up" delay={120}>
            <div className="teams-comparison-grid">
              <TeamFormCard
                teamName={prediction.fixture.homeTeam.name}
                teamLogo={prediction.fixture.homeTeam.logo}
                role="home"
                matches={prediction.home_recent_matches || []}
                summary={prediction.home_summary}
              />
              <TeamFormCard
                teamName={prediction.fixture.awayTeam.name}
                teamLogo={prediction.fixture.awayTeam.logo}
                role="away"
                matches={prediction.away_recent_matches || []}
                summary={prediction.away_summary}
              />
            </div>
          </ScrollReveal>
        )}

        {/* Head-to-Head Recharts Metric Chart */}
        {!isPredicting && prediction && prediction.home_summary && prediction.away_summary && (
          <ScrollReveal animation="fade-up" delay={180}>
            <StatisticsComparison
              homeTeam={prediction.fixture.homeTeam.name}
              awayTeam={prediction.fixture.awayTeam.name}
              homeLogo={prediction.fixture.homeTeam.logo}
              awayLogo={prediction.fixture.awayTeam.logo}
              homeSummary={prediction.home_summary}
              awaySummary={prediction.away_summary}
            />
          </ScrollReveal>
        )}
      </div>
    </div>
  );
}
