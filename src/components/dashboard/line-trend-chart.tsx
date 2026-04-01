"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type { LinePoint } from "@/types/dashboard";

interface LineTrendChartProps {
  data: LinePoint[];
  valuePrefix?: string;
}

export function LineTrendChart({ data, valuePrefix = "" }: LineTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(22, 43, 79, 0.12)" />
        <XAxis dataKey="label" stroke="rgba(22, 43, 79, 0.65)" fontSize={12} />
        <YAxis stroke="rgba(22, 43, 79, 0.65)" fontSize={12} width={44} />
        <Tooltip
          cursor={{ stroke: "rgba(47, 116, 255, 0.24)", strokeWidth: 2 }}
          contentStyle={{
            borderRadius: "12px",
            border: "1px solid rgba(190,205,228,0.7)",
            boxShadow: "0 4px 22px rgba(12,35,64,0.1)"
          }}
          formatter={(value: number) => `${valuePrefix}${value}`}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#2f74ff"
          strokeWidth={3}
          dot={{ fill: "#2f74ff", strokeWidth: 0, r: 3 }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
