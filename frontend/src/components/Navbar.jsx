import React, { useEffect, useState } from "react";
import { Home, Shield, Users, BarChart3, History, Target, Star } from "lucide-react";
import ForzalyticsLogo from "./ForzalyticsLogo";

export default function Navbar({
  currentView = "home",
  onNavigateHome,
  onNavigateSection,
  activeSection = "home",
}) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "total-goals", label: "Total Goals (xG)", icon: Target, href: "/total_goals.html" },
    { id: "teams", label: "Teams", icon: Shield },
    { id: "players", label: "Players", icon: Users },
    { id: "player-ratings", label: "Player Ratings", icon: Star },
    { id: "statistics", label: "Statistics", icon: BarChart3 },
    { id: "history", label: "History", icon: History },
  ];

  return (
    <header className={`transparent-navbar ${isScrolled ? "is-scrolled" : ""}`}>
      <div className="navbar-inner">
        {/* Left: Brand Logo */}
        <div className="navbar-left">
          <ForzalyticsLogo
            size={34}
            onClick={onNavigateHome}
            className="clickable-brand"
          />
        </div>

        {/* Center: Floating Glass Navigation Dock */}
        <nav className="navbar-center-dock" aria-label="Main Navigation">
          <div className="dock-items-wrapper">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                currentView === item.id ||
                (currentView === "home" && activeSection === item.id);

              if (item.href) {
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    className="dock-nav-item"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <Icon size={14} className="dock-item-icon" />
                    <span className="dock-item-label">{item.label}</span>
                  </a>
                );
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`dock-nav-item ${isActive ? "active" : ""}`}
                  onClick={() => onNavigateSection && onNavigateSection(item.id)}
                >
                  <Icon size={14} className="dock-item-icon" />
                  <span className="dock-item-label">{item.label}</span>
                  {isActive && <span className="dock-active-glow-bar" />}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Right: Balance Spacer */}
        <div className="navbar-right-spacer" />
      </div>
    </header>
  );
}
