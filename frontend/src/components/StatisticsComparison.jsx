import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { BarChart3 } from "lucide-react";
import TeamLogo from "./TeamLogo";

export default function StatisticsComparison({
  homeTeam,
  awayTeam,
  homeLogo,
  awayLogo,
  homeSummary,
  awaySummary,
}) {
  if (!homeSummary || !awaySummary) return null;

  const chartData = [
    {
      metric: "Goals Scored",
      [homeTeam]: homeSummary.avg_goals_for ?? 0,
      [awayTeam]: awaySummary.avg_goals_for ?? 0,
    },
    {
      metric: "Goals Conceded",
      [homeTeam]: homeSummary.avg_goals_against ?? 0,
      [awayTeam]: awaySummary.avg_goals_against ?? 0,
    },
    {
      metric: "Shots on Target",
      [homeTeam]: homeSummary.avg_shots_on_target ?? 0,
      [awayTeam]: awaySummary.avg_shots_on_target ?? 0,
    },
    {
      metric: "Total Shots",
      [homeTeam]: homeSummary.avg_shots ?? 0,
      [awayTeam]: awaySummary.avg_shots ?? 0,
    },
    {
      metric: "Corners",
      [homeTeam]: homeSummary.avg_corners ?? 0,
      [awayTeam]: awaySummary.avg_corners ?? 0,
    },
    {
      metric: "Points (L5)",
      [homeTeam]: homeSummary.points ?? 0,
      [awayTeam]: awaySummary.points ?? 0,
    },
  ];

  return (
    <div className="card-panel">
      <div className="panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
          <h3 className="panel-title" style={{ margin: 0 }}>
            <BarChart3 size={18} color="#10b981" />
            <span>Head-to-Head 5-Match Metrics Comparison</span>
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <TeamLogo name={homeTeam} logo={homeLogo} size={22} />
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--color-home)" }}>{homeTeam}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>vs</span>
            <TeamLogo name={awayTeam} logo={awayLogo} size={22} />
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--color-away)" }}>{awayTeam}</span>
          </div>
        </div>
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          Strictly pre-kickoff per-game averages
        </span>
      </div>

      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
            <XAxis dataKey="metric" stroke="#94a3b8" tick={{ fontSize: 12 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#121826",
                borderColor: "rgba(255, 255, 255, 0.15)",
                borderRadius: "8px",
                color: "#f8fafc",
              }}
            />
            <Legend wrapperStyle={{ paddingTop: "10px" }} />
            <Bar dataKey={homeTeam} fill="#10b981" radius={[4, 4, 0, 0]} name={`${homeTeam} (Home)`} />
            <Bar dataKey={awayTeam} fill="#38bdf8" radius={[4, 4, 0, 0]} name={`${awayTeam} (Away)`} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
