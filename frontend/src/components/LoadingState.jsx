import React from "react";
import { Loader2 } from "lucide-react";

export default function LoadingState({ message = "Retrieving statistics & computing ML prediction..." }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "3rem 1.5rem",
      background: "var(--bg-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-lg)",
      marginBottom: "2rem",
      textAlign: "center"
    }}>
      <Loader2 size={36} color="#10b981" style={{ animation: "spin 1s linear infinite", marginBottom: "1rem" }} />
      <p style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "1rem", marginBottom: "0.25rem" }}>
        {message}
      </p>
      <p style={{ color: "var(--text-muted)", fontSize: "0.825rem" }}>
        Extracting last 5 matches before kickoff and applying 3-class LightGBM probabilities.
      </p>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
