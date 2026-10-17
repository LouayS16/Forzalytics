import React, { useState } from "react";

// Curated primary/secondary color gradients for popular football clubs
const TEAM_GRADIENTS = {
  barcelona: "linear-gradient(135deg, #004d98, #a50044)",
  betis: "linear-gradient(135deg, #008f39, #005020)",
  "real madryt": "linear-gradient(135deg, #2b3a4a, #feb800)",
  "real madrid": "linear-gradient(135deg, #2b3a4a, #feb800)",
  "atl. madryt": "linear-gradient(135deg, #cb3524, #1b3864)",
  "ath. bilbao": "linear-gradient(135deg, #ee2524, #000000)",
  sevilla: "linear-gradient(135deg, #d4001f, #ffffff)",
  valencia: "linear-gradient(135deg, #ff7f00, #000000)",
  villarreal: "linear-gradient(135deg, #fceb00, #00519e)",
  "real sociedad": "linear-gradient(135deg, #0067b1, #ffffff)",
  girona: "linear-gradient(135deg, #d3112c, #ffffff)",
  mallorca: "linear-gradient(135deg, #d1121d, #000000)",
  "celta vigo": "linear-gradient(135deg, #8ac3ee, #b71c1c)",
  getafe: "linear-gradient(135deg, #005ba9, #ffffff)",
  alaves: "linear-gradient(135deg, #00529f, #ffffff)",
  "las palmas": "linear-gradient(135deg, #ffd700, #0047bb)",
  osasuna: "linear-gradient(135deg, #b81c22, #0b1a30)",
  vallecano: "linear-gradient(135deg, #e30613, #ffffff)",
  arsenal: "linear-gradient(135deg, #ef0107, #063672)",
  chelsea: "linear-gradient(135deg, #034694, #6a7ab5)",
  liverpool: "linear-gradient(135deg, #c8102e, #00b2a9)",
  "man city": "linear-gradient(135deg, #6cabdd, #1c2c5b)",
  "man united": "linear-gradient(135deg, #da291c, #000000)",
  tottenham: "linear-gradient(135deg, #132257, #ffffff)",
  bayern: "linear-gradient(135deg, #dc052d, #0066b2)",
  dortmund: "linear-gradient(135deg, #fde100, #000000)",
  juventus: "linear-gradient(135deg, #000000, #333333)",
  inter: "linear-gradient(135deg, #010e80, #000000)",
  milan: "linear-gradient(135deg, #fb090b, #000000)",
  psg: "linear-gradient(135deg, #004170, #da291c)",
};

export default function TeamLogo({ name = "", logo, size = 36, className = "" }) {
  const [hasError, setHasError] = useState(!logo);

  const cleanName = name.toLowerCase().trim();
  let gradient = "linear-gradient(135deg, #1e293b, #0f172a)";
  for (const [key, grad] of Object.entries(TEAM_GRADIENTS)) {
    if (cleanName.includes(key) || key.includes(cleanName)) {
      gradient = grad;
      break;
    }
  }

  // Get 2-letter monogram
  const initials = name
    .replace(/^(fc|cf|rcd|ud|ca|cd)\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || name.slice(0, 2).toUpperCase();

  const containerStyle = {
    width: `${size}px`,
    height: `${size}px`,
    minWidth: `${size}px`,
    minHeight: `${size}px`,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.45)",
    background: "rgba(255, 255, 255, 0.08)",
    backdropFilter: "blur(4px)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    flexShrink: 0,
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  };

  if (!hasError && logo) {
    return (
      <div
        style={containerStyle}
        className={`team-logo-container ${className}`}
        title={name}
      >
        <img
          src={logo}
          alt={name}
          style={{
            width: "78%",
            height: "78%",
            objectFit: "contain",
            filter: "drop-shadow(0 2px 5px rgba(0, 0, 0, 0.6))",
          }}
          onError={() => setHasError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      style={{
        ...containerStyle,
        background: gradient,
        border: "1.5px solid rgba(255, 255, 255, 0.25)",
      }}
      className={`team-logo-fallback ${className}`}
      title={name}
    >
      <span
        style={{
          color: "#ffffff",
          fontWeight: 800,
          fontSize: `${Math.max(10, Math.floor(size * 0.38))}px`,
          letterSpacing: "0.04em",
          textShadow: "0 2px 4px rgba(0, 0, 0, 0.9)",
          fontFamily: "var(--font-mono, monospace)",
          userSelect: "none",
        }}
      >
        {initials}
      </span>
    </div>
  );
}
