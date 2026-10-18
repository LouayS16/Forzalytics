/**
 * Utility functions for formatting football statistics and sample sizes.
 */

export const formatStat = (val, decimals = 1, fallback = "N/A") => {
  if (val === null || val === undefined || isNaN(val)) {
    return fallback;
  }
  return Number(val).toFixed(decimals);
};

export const formatPct = (val, fallback = "N/A") => {
  if (val === null || val === undefined || isNaN(val)) {
    return fallback;
  }
  return `${Number(val).toFixed(1)}%`;
};

export const formatSampleSize = (sampleCount, total = 5) => {
  if (sampleCount === null || sampleCount === undefined) {
    return "0/5 matches";
  }
  return `${sampleCount}/${total} matches`;
};

export const formatDiff = (val, decimals = 1) => {
  if (val === null || val === undefined || isNaN(val)) return "0.0";
  const num = Number(val);
  const prefix = num > 0 ? "+" : "";
  return `${prefix}${num.toFixed(decimals)}`;
};

export const getResultBadge = (res) => {
  switch (res) {
    case "W":
      return { text: "W", label: "Win", colorClass: "badge-win" };
    case "D":
      return { text: "D", label: "Draw", colorClass: "badge-draw" };
    case "L":
      return { text: "L", label: "Loss", colorClass: "badge-loss" };
    default:
      return { text: "-", label: "Unknown", colorClass: "badge-unknown" };
  }
};
