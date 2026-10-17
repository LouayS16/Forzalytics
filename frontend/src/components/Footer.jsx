import React from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import ForzalyticsLogo from "./ForzalyticsLogo";

export default function Footer({ onNavigateSection }) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="forzalytics-footer">
      <div className="footer-glow-bar" />
      <div className="footer-inner">
        {/* Top Grid: Brand, Platform Highlights, Quick Links */}
        <div className="footer-top-grid">
          {/* Brand Column */}
          <div className="footer-col-brand">
            <ForzalyticsLogo size={30} onClick={scrollToTop} className="clickable-brand" />
            <p className="footer-tagline">
              Advanced machine learning analytics and probabilistic outcome forecasts
              across Europe's top 5 football leagues.
            </p>
            <div className="footer-engine-tag">
              <Sparkles size={13} color="#00ff87" />
              <span>LightGBM 3-Way Predictive Core</span>
            </div>
          </div>

          {/* Quick Links Column */}
          <div className="footer-col-links">
            <h4 className="footer-heading">Platform</h4>
            <ul className="footer-links-list">
              <li>
                <button
                  type="button"
                  className="footer-link-btn"
                  onClick={() => onNavigateSection && onNavigateSection("home")}
                >
                  Home Overview
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="footer-link-btn"
                  onClick={() => onNavigateSection && onNavigateSection("teams")}
                >
                  Teams Directory
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="footer-link-btn"
                  onClick={() => onNavigateSection && onNavigateSection("players")}
                >
                  Players Engine
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="footer-link-btn"
                  onClick={() => onNavigateSection && onNavigateSection("statistics")}
                >
                  Model Statistics
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="footer-link-btn"
                  onClick={() => onNavigateSection && onNavigateSection("history")}
                >
                  Prediction History
                </button>
              </li>
            </ul>
          </div>

          {/* European Leagues Covered Column */}
          <div className="footer-col-leagues">
            <h4 className="footer-heading">Covered Leagues</h4>
            <div className="footer-leagues-pills">
              <span className="league-pill">Premier League</span>
              <span className="league-pill">La Liga</span>
              <span className="league-pill">Serie A</span>
              <span className="league-pill">Bundesliga</span>
              <span className="league-pill">Ligue 1</span>
            </div>
          </div>

          {/* Model Metrics Column */}
          <div className="footer-col-metrics">
            <h4 className="footer-heading">Data Engine</h4>
            <div className="footer-metric-item">
              <span className="metric-val">96,305</span>
              <span className="metric-desc">Historical matches trained</span>
            </div>
            <div className="footer-metric-item">
              <span className="metric-val">Rolling 5-Game</span>
              <span className="metric-desc">Dynamic pre-kickoff form vectors</span>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Back to Top */}
        <div className="footer-bottom-bar">
          <div className="footer-copyright">
            <span>© {new Date().getFullYear()} Forzalytics. Built for predictive football intelligence.</span>
            <span className="footer-disclaimer">
              Powered by OpenFootball schedule feeds & LightGBM multiclass models.
            </span>
          </div>

          <button
            type="button"
            className="footer-back-to-top"
            onClick={scrollToTop}
            title="Scroll back to top"
          >
            <span>Back to top</span>
            <ArrowUp size={14} />
          </button>
        </div>
      </div>
    </footer>
  );
}
