'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface DayVolume {
  date: string
  buyVolume: number
  sellVolume: number
}

export function VolumeChart({ data }: { data: DayVolume[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
        <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} />
        <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} contentStyle={{ background: '#1F2937', border: 'none' }} />
        <Legend />
        <Bar dataKey="buyVolume" name="Buys" fill="#22C55E" />
        <Bar dataKey="sellVolume" name="Sells" fill="#EF4444" />
      </BarChart>
    </ResponsiveContainer>
  )
}
