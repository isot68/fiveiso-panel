'use client';
import {
  AreaChart,
  Area,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
export function PlayerChart({
  data,
}: {
  data: { time: string; players: number }[];
}) {
  return (
    <div
      className="h-64 w-full"
      role="img"
      aria-label="Oyuncu sayısının zaman içindeki değişimi"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 20, right: 12, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="players-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5ce1e6" stopOpacity={0.24} />
              <stop offset="100%" stopColor="#5ce1e6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="#283249"
            strokeDasharray="3 5"
          />
          <XAxis
            dataKey="time"
            tick={{ fill: '#949aa4', fontSize: 12 }}
            minTickGap={40}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#949aa4', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: '#152035',
              border: '1px solid #373d43',
              borderRadius: 5,
            }}
            labelStyle={{ color: '#aeb6bf' }}
          />
          <Area
            type="monotone"
            dataKey="players"
            name="Oyuncu"
            stroke="#5ce1e6"
            strokeWidth={2.5}
            fill="url(#players-fill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
