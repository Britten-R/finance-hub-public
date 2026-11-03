"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { day: number; actual: number | null; ideal: number };

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

// Cumulative card spending this month vs. an even-pace "ideal" line.
export default function SpendingPaceChart({ data, month }: { data: Point[]; month: string }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis
            dataKey="day"
            stroke="var(--axis)"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            tickLine={false}
            interval={6}
            tickFormatter={(d) => `${month.slice(0, 3)} ${d}`}
          />
          <YAxis
            stroke="var(--axis)"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={usd}
          />
          <Tooltip
            cursor={{ stroke: "var(--axis)" }}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "var(--ink)" }}
            itemStyle={{ color: "var(--ink-2)" }}
            labelFormatter={(d) => `${month} ${d}`}
            formatter={(v) => usd(Number(v))}
          />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "var(--ink-2)" }} />
          <Line
            name="Ideal pace"
            dataKey="ideal"
            stroke="var(--muted)"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={false}
          />
          <Line
            name="Actual spending"
            dataKey="actual"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
