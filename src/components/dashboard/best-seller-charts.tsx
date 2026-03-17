"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ChartRow {
  name: string;
  value: number;
}

interface BestSellerChartProps {
  data: ChartRow[];
  color?: string;
  valueLabel: string;
}

export function BestSellerBarChart({
  data,
  color = "#0ea5e9",
  valueLabel,
}: BestSellerChartProps) {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" angle={-20} textAnchor="end" height={70} interval={0} />
          <YAxis />
          <Tooltip formatter={(value) => [Number(value ?? 0), valueLabel]} />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

