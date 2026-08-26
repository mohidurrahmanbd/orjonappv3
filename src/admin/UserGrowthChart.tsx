import React, { useState, useMemo } from 'react';
import { User } from '../shared/types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { TrendingUp, Calendar } from 'lucide-react';

export type GrowthTimeframe = '24h' | '7d' | '15d' | '1m' | '6m' | '1y';

interface UserGrowthChartProps {
  users: User[];
}

export default function UserGrowthChart({ users = [] }: UserGrowthChartProps) {
  const [timeframe, setTimeframe] = useState<GrowthTimeframe>('7d');

  // Compute aggregated chart data based on selected timeframe
  const { chartData, totalInPeriod, peakCount, avgPerPeriod } = useMemo(() => {
    const safeUsers = users || [];
    const now = new Date();
    let maxUserTime = now.getTime();
    safeUsers.forEach(u => {
      if (u.createdAt) {
        const t = new Date(u.createdAt).getTime();
        if (!isNaN(t) && t > maxUserTime) maxUserTime = t;
      }
    });
    const refDate = new Date(maxUserTime);

    // Collect and sanitize creation timestamps
    const userTimestamps = safeUsers.map(u => {
      if (!u.createdAt) return refDate.getTime();
      const t = new Date(u.createdAt).getTime();
      return isNaN(t) ? refDate.getTime() : t;
    }).sort((a, b) => a - b);

    const slots: { label: string; startTime: number; endTime: number }[] = [];

    if (timeframe === '24h') {
      for (let i = 23; i >= 0; i--) {
        const slotEnd = new Date(refDate.getTime() - i * 3600 * 1000);
        const slotStart = new Date(slotEnd.getTime() - 3600 * 1000);
        const hours = slotEnd.getHours();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHour = `${hours % 12 || 12} ${ampm}`;
        slots.push({
          label: formattedHour,
          startTime: slotStart.getTime(),
          endTime: slotEnd.getTime()
        });
      }
    } else if (timeframe === '7d' || timeframe === '15d' || timeframe === '1m') {
      const numDays = timeframe === '7d' ? 7 : timeframe === '15d' ? 15 : 30;
      for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date(refDate);
        d.setDate(d.getDate() - i);
        d.setHours(23, 59, 59, 999);
        const slotStart = new Date(d);
        slotStart.setHours(0, 0, 0, 0);

        const dayStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        slots.push({
          label: dayStr,
          startTime: slotStart.getTime(),
          endTime: d.getTime()
        });
      }
    } else if (timeframe === '6m' || timeframe === '1y') {
      const numMonths = timeframe === '6m' ? 6 : 12;
      for (let i = numMonths - 1; i >= 0; i--) {
        const d = new Date(refDate.getFullYear(), refDate.getMonth() - i + 1, 0, 23, 59, 59, 999);
        const slotStart = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1, 0, 0, 0, 0);

        const monthStr = slotStart.toLocaleDateString('en-US', { month: 'short', year: numMonths > 6 ? '2-digit' : undefined });
        slots.push({
          label: monthStr,
          startTime: slotStart.getTime(),
          endTime: d.getTime()
        });
      }
    }

    let cumulative = 0;
    if (slots.length > 0) {
      const firstSlotStart = slots[0].startTime;
      cumulative = userTimestamps.filter(t => t < firstSlotStart).length;
    }

    let periodSum = 0;
    let maxInSlot = 0;

    const data = slots.map(slot => {
      const newInSlot = userTimestamps.filter(t => t >= slot.startTime && t <= slot.endTime).length;
      cumulative += newInSlot;
      periodSum += newInSlot;
      if (newInSlot > maxInSlot) maxInSlot = newInSlot;

      return {
        label: slot.label,
        newUsers: newInSlot,
        totalUsers: cumulative
      };
    });

    const avg = data.length > 0 ? (periodSum / data.length).toFixed(1) : '0';

    return {
      chartData: data,
      totalInPeriod: periodSum,
      peakCount: maxInSlot,
      avgPerPeriod: avg
    };
  }, [users, timeframe]);

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col gap-4">
      {/* Chart Header & Dropdown Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-gray-900 tracking-tight flex items-center gap-2">
              Recent User Growth
              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                Live Analytics
              </span>
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              শিক্ষার্থীদের রেজিস্ট্রেশন বৃদ্ধির রিয়েল-টাইম সময়ভিত্তিক অ্যানালিটিক্স
            </p>
          </div>
        </div>

        {/* Timeframe Dropdown Selector */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <label htmlFor="growth-timeframe" className="text-xs font-bold text-gray-600 flex items-center gap-1 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            সময়সীমা:
          </label>
          <select
            id="growth-timeframe"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as GrowthTimeframe)}
            className="px-3.5 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-extrabold text-indigo-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition cursor-pointer"
          >
            <option value="24h">⏱️ গত ২৪ ঘণ্টা (Last 24 Hours)</option>
            <option value="7d">📅 গত ৭ দিন (Last 7 Days)</option>
            <option value="15d">📆 গত ১৫ দিন (Last 15 Days)</option>
            <option value="1m">🗓️ গত ১ মাস (Last 1 Month)</option>
            <option value="6m">📊 গত ৬ মাস (Last 6 Months)</option>
            <option value="1y">📈 গত ১ বছর (Last 1 Year)</option>
          </select>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100/80">
          <span className="text-[10px] font-bold text-indigo-700 uppercase block">নতুন রেজিস্ট্রেশন</span>
          <span className="text-lg font-black text-indigo-950 block mt-0.5">
            +{totalInPeriod.toLocaleString('bn-BD')}
          </span>
          <span className="text-[10px] text-indigo-600 font-medium">নির্বাচিত সময়সীমায়</span>
        </div>

        <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100/80">
          <span className="text-[10px] font-bold text-emerald-700 uppercase block">সর্বমোট শিক্ষার্থী</span>
          <span className="text-lg font-black text-emerald-950 block mt-0.5">
            {users.length.toLocaleString('bn-BD')}
          </span>
          <span className="text-[10px] text-emerald-600 font-medium">সিস্টেম ডাটাবেজে</span>
        </div>

        <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-100/80">
          <span className="text-[10px] font-bold text-amber-800 uppercase block">সর্বোচ্চ বৃদ্ধি (Peak)</span>
          <span className="text-lg font-black text-amber-950 block mt-0.5">
            {peakCount.toLocaleString('bn-BD')} <span className="text-xs font-semibold text-amber-800">জন</span>
          </span>
          <span className="text-[10px] text-amber-700 font-medium">একক স্লটে</span>
        </div>

        <div className="bg-purple-50/70 p-3 rounded-xl border border-purple-100/80">
          <span className="text-[10px] font-bold text-purple-700 uppercase block">গড় নিবন্ধন</span>
          <span className="text-lg font-black text-purple-950 block mt-0.5">
            {avgPerPeriod}
          </span>
          <span className="text-[10px] text-purple-600 font-medium">প্রতি সময় স্লটে</span>
        </div>
      </div>

      {/* Recharts Area / Line Chart */}
      <div className="w-full h-72 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorNewUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorTotalUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} 
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <YAxis 
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#64748b' }} 
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs flex flex-col gap-1.5">
                      <p className="font-bold text-indigo-300 border-b border-slate-700 pb-1">
                        📌 {label}
                      </p>
                      <div className="flex items-center gap-2 text-indigo-100 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>
                        <span>নতুন নিবন্ধিত:</span>
                        <span className="font-bold text-white ml-auto">+{payload[0]?.value} জন</span>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-100 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                        <span>সর্বমোট ইউজার সংখ্যা:</span>
                        <span className="font-bold text-white ml-auto">{payload[1]?.value} জন</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend 
              verticalAlign="top" 
              height={36} 
              formatter={(value) => (
                <span className="text-xs font-extrabold text-slate-700">
                  {value === 'newUsers' ? '🆕 নতুন রেজিস্ট্রেশন (New Registrations)' : '👥 সর্বমোট ইউজার ট্রেন্ড (Total Cumulative)'}
                </span>
              )}
            />
            <Area 
              type="monotone" 
              dataKey="newUsers" 
              name="newUsers"
              stroke="#4f46e5" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorNewUsers)" 
              activeDot={{ r: 6, stroke: '#312e81', strokeWidth: 2 }}
            />
            <Area 
              type="monotone" 
              dataKey="totalUsers" 
              name="totalUsers"
              stroke="#10b981" 
              strokeWidth={2}
              strokeDasharray="4 4"
              fillOpacity={1} 
              fill="url(#colorTotalUsers)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
