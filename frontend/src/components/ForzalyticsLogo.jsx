import React from "react";

export default function ForzalyticsLogo({
  size = 32,
  showText = true,
  className = "",
  onClick,
}) {
  return (
    <div
      className={`forzalytics-brand ${className}`}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient
            id="forzaTop"
            x1="6"
            y1="6.5"
            x2="36"
            y2="14"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#00ff87" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <linearGradient
            id="forzaMid"
            x1="6"
            y1="17.5"
            x2="28"
            y2="25"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient
            id="forzaBot"
            x1="6"
            y1="28.5"
            x2="21"
            y2="36"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#00f0ff" />
          </linearGradient>
          <filter id="glowF" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="2"
              floodColor="#00ff87"
              floodOpacity="0.45"
            />
          </filter>
        </defs>

        {/* Top Blade (Y: 6.5 to 14) */}
        <path
          d="M9 6.5H33.5C35.8 6.5 37.2 9.1 35.7 10.8L32.8 14H9C7.6 14 6.5 12.9 6.5 11.5V9C6.5 7.6 7.6 6.5 9 6.5Z"
          fill="url(#forzaTop)"
          filter="url(#glowF)"
        />

        {/* Middle Blade with 3.5px visible space (Y: 17.5 to 25) */}
        <path
          d="M9 17.5H25.5C27.8 17.5 29.2 20.1 27.7 21.8L24.8 25H9C7.6 25 6.5 23.9 6.5 22.5V20C6.5 18.6 7.6 17.5 9 17.5Z"
          fill="url(#forzaMid)"
        />

        {/* Bottom Blade with 3.5px visible space (Y: 28.5 to 36) */}
        <path
          d="M9 28.5H18.5C20.8 28.5 22.2 31.1 20.7 32.8L17.8 36H9C7.6 36 6.5 34.9 6.5 33.5V31C6.5 29.6 7.6 28.5 9 28.5Z"
          fill="url(#forzaBot)"
        />
      </svg>

      {showText && (
        <span
          className="forzalytics-text"
          style={{
            fontSize: `${Math.round(size * 0.72)}px`,
            fontWeight: 900,
            letterSpacing: "0.02em",
            fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
            lineHeight: 1,
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <span
            style={{
              color: "#00ff87",
              textShadow: "0 0 14px rgba(0, 255, 135, 0.45)",
            }}
          >
            FORZA
          </span>
          <span style={{ color: "#ffffff", letterSpacing: "0.03em" }}>
            LYTICS
          </span>
        </span>
      )}
    </div>
  );
}
