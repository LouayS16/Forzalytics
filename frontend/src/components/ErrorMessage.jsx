import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorMessage({ message, onRetry }) {
  if (!message) return null;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "1rem 1.25rem",
      background: "rgba(239, 68, 68, 0.12)",
      border: "1px solid rgba(239, 68, 68, 0.35)",
      borderRadius: "var(--radius-md)",
      marginBottom: "1.5rem",
      color: "#fca5a5"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{message}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            background: "rgba(239, 68, 68, 0.2)",
            color: "#ffffff",
            padding: "0.4rem 0.8rem",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.8rem",
            fontWeight: 600,
            border: "1px solid rgba(239, 68, 68, 0.4)",
          }}
        >
          <RefreshCw size={12} />
          Retry
        </button>
      )}
    </div>
  );
}
