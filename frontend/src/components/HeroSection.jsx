import React, { useEffect, useState } from "react";

export default function HeroSection({ onAccessPlatform, onExploreClick }) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Parallax offsets
  const videoOffset = Math.min(220, scrollY * 0.25);
  const hudOffset = Math.max(-120, -scrollY * 0.12);

  // Equalizer density bars for the HUD card
  const equalizerBars = [
    { height: 18, color: "#00ff87" },
    { height: 26, color: "#00ff87" },
    { height: 38, color: "#00ff87" },
    { height: 52, color: "#00ff87" },
    { height: 68, color: "#00ff87" },
    { height: 78, color: "#00ff87" },
    { height: 86, color: "#00ff87" },
    { height: 75, color: "#00ff87" },
    { height: 60, color: "#00ff87" },
    { height: 44, color: "#00ff87" },
    { height: 30, color: "#00ff87" },
    { height: 22, color: "#64748b" },
    { height: 32, color: "#64748b" },
    { height: 46, color: "#64748b" },
    { height: 54, color: "#64748b" },
    { height: 42, color: "#64748b" },
    { height: 28, color: "#64748b" },
    { height: 18, color: "#64748b" },
    { height: 14, color: "#334155" },
    { height: 20, color: "#334155" },
    { height: 32, color: "#334155" },
    { height: 40, color: "#334155" },
    { height: 48, color: "#334155" },
    { height: 38, color: "#334155" },
    { height: 26, color: "#334155" },
    { height: 16, color: "#334155" },
  ];

  return (
    <section className="cinematic-hero-section">
      {/* Background Stadium Video with Parallax */}
      <div
        className="hero-video-container"
        style={{ transform: `translate3d(0, ${videoOffset}px, 0)` }}
      >
        <video
          className="hero-video"
          src="/football_hero.mp4"
          autoPlay
          loop
          muted
          playsInline
        />
        {/* Dark Vignette Overlay for Crisp Readability */}
        <div className="hero-video-overlay" />
      </div>

      {/* Main Content Grid: Left Typography + Right Live Telemetry HUD */}
      <div className="hero-content-grid">
        {/* Left Side: Brand Headline & Subtitle */}
        <div className="hero-left-column">
          <span className="hero-eyebrow">DATA-DRIVEN</span>

          <h1 className="hero-big-title">
            MATCH <br />
            INSIGHTS
          </h1>

          <p className="hero-subtext">
            The ultimate intelligence suite for elite sports analytics.
            Real-time predictive metrics, performance modeling, and match
            forecasting.
          </p>

          <div className="hero-button-row">
            <button
              type="button"
              className="btn-access-platform"
              onClick={onAccessPlatform || onExploreClick}
            >
              <span>ACCESS PLATFORM</span>
            </button>

            <button
              type="button"
              className="btn-view-demo"
              onClick={onExploreClick}
            >
              <span>VIEW DEMO</span>
            </button>
          </div>
        </div>

        {/* Right Side: Live Telemetry Glassmorphic HUD Card */}
        <div
          className="hero-right-column"
          style={{ transform: `translate3d(0, ${hudOffset}px, 0)` }}
        >
          {/* Tactical HUD Wireframe Frame */}
          <div className="hud-wireframe-frame">
            <span className="hud-corner top-left" />
            <span className="hud-corner top-right" />
            <span className="hud-corner bottom-left" />
            <span className="hud-corner bottom-right" />

            <div className="hud-telemetry-meta top">
              <span>COORDINATE REF-3508</span>
              <span className="telemetry-center">REAL-TIME DIGITAL TELEMETRY</span>
              <span>COORDINATE 55R-420.MS</span>
            </div>

            {/* Inner Glass HUD Card */}
            <div className="hud-glass-card">
              {/* Header row */}
              <div className="hud-card-header">
                <span className="hud-label-dim">LIVE MATCH PROBABILITY</span>
                <span className="hud-live-badge">
                  <span className="live-pulsing-dot" /> LIVE 72'
                </span>
              </div>

              {/* Matchup row */}
              <div className="hud-matchup-row">
                {/* MNC */}
                <div className="hud-team mnc">
                  <div className="hud-badge-circle mnc">
                    <span className="badge-initials">MNC</span>
                  </div>
                  <div className="hud-team-text">
                    <span className="hud-team-code">MNC</span>
                    <span className="hud-team-sub">Manchester</span>
                  </div>
                </div>

                <span className="hud-vs-divider">VS</span>

                {/* MAD */}
                <div className="hud-team mad">
                  <div className="hud-badge-shield mad">
                    <span className="badge-initials">MAD</span>
                  </div>
                  <div className="hud-team-text">
                    <span className="hud-team-code">MAD</span>
                    <span className="hud-team-sub">Madrid</span>
                  </div>
                </div>
              </div>

              {/* Wave Density Histogram / Equalizer */}
              <div className="hud-equalizer-container">
                <div className="hud-equalizer-bars">
                  {equalizerBars.map((bar, i) => (
                    <div
                      key={i}
                      className="equalizer-bar"
                      style={{
                        height: `${bar.height}%`,
                        backgroundColor: bar.color,
                        boxShadow:
                          bar.color === "#00ff87"
                            ? "0 0 8px rgba(0, 255, 135, 0.45)"
                            : "none",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* 3-Way Probability Bar */}
              <div className="hud-prob-bar-track">
                <div className="hud-prob-segment win" style={{ width: "45.2%" }}>
                  <span>WIN 45.2%</span>
                </div>
                <div className="hud-prob-segment draw" style={{ width: "22.8%" }}>
                  <span>DRAW 22.8%</span>
                </div>
                <div className="hud-prob-segment loss" style={{ width: "32.0%" }}>
                  <span>MAD WIN 32.0%</span>
                </div>
              </div>

              {/* Stepped Cumulative xG Chart */}
              <div className="hud-xg-chart-container">
                <div className="hud-xg-axes">
                  <span>10</span>
                  <span className="axis-mid">xG</span>
                  <span>0</span>
                </div>
                <div className="hud-xg-graph">
                  <svg
                    className="xg-svg"
                    viewBox="0 0 320 80"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <linearGradient
                        id="xgFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="80"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop offset="0%" stopColor="#00ff87" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#00ff87" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {/* Shaded Area Under Curve */}
                    <path
                      d="M 10 70 L 30 65 L 50 65 L 70 55 L 100 55 L 130 45 L 170 45 L 200 35 L 240 35 L 270 20 L 310 20 L 310 75 L 10 75 Z"
                      fill="url(#xgFill)"
                    />
                    {/* Stepped xG Curve Line */}
                    <path
                      d="M 10 70 L 30 65 L 50 65 L 70 55 L 100 55 L 130 45 L 170 45 L 200 35 L 240 35 L 270 20 L 310 20"
                      stroke="#00ff87"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Secondary Competitor xG Curve */}
                    <path
                      d="M 10 74 L 40 70 L 90 70 L 120 60 L 160 60 L 210 50 L 250 50 L 280 45 L 310 45"
                      stroke="rgba(255, 255, 255, 0.35)"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                  </svg>
                </div>
              </div>

              {/* Bottom Telemetry Footer */}
              <div className="hud-telemetry-meta bottom">
                <span>SYS-35.228 // ML: MODEL-JOB</span>
                <span className="telemetry-right">DATA POINTS: 96,305</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
