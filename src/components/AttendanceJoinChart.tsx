import React, { useState } from 'react';
import { Calendar, Clock, CheckCircle2, AlertTriangle, XCircle, Info, Sparkles } from 'lucide-react';
import { ClassJoinRecord, StudentPermissionRequest } from '../types';

interface AttendanceJoinChartProps {
  joins: ClassJoinRecord[];
  permissions: StudentPermissionRequest[];
  attendanceRecords: { date: string; status: string; reason?: string }[];
  yellowFrom?: number;
  redFrom?: number;
  yellowPenalty?: number;
  redPenalty?: number;
}

export const AttendanceJoinChart: React.FC<AttendanceJoinChartProps> = ({
  joins,
  permissions,
  attendanceRecords,
  yellowFrom = 1,
  redFrom = 10,
  yellowPenalty = 0,
  redPenalty = 2,
}) => {
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [activeTooltipIndex, setActiveTooltipIndex] = useState<number | null>(null);

  const todayObj = new Date();
  const todayStr = todayObj.toISOString().slice(0, 10);

  // Generate Week Days (Mon-Sun of current week)
  const getWeekDays = () => {
    const current = new Date(todayObj);
    const dayOfWeek = current.getDay(); // 0 is Sun
    const distanceToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(current.setDate(current.getDate() + distanceToMon));

    const days: { date: string; label: string; isToday: boolean; isFuture: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dStr = d.toISOString().slice(0, 10);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      days.push({
        date: dStr,
        label: dayName,
        isToday: dStr === todayStr,
        isFuture: dStr > todayStr,
      });
    }
    return days;
  };

  // Generate Month Days (all dates in current month)
  const getMonthDays = () => {
    const year = todayObj.getFullYear();
    const month = todayObj.getMonth();
    const numDays = new Date(year, month + 1, 0).getDate();

    const days: { date: string; label: string; isToday: boolean; isFuture: boolean }[] = [];
    for (let i = 1; i <= numDays; i++) {
      const d = new Date(year, month, i);
      const dStr = d.toISOString().slice(0, 10);
      days.push({
        date: dStr,
        label: `${i}`,
        isToday: dStr === todayStr,
        isFuture: dStr > todayStr,
      });
    }
    return days;
  };

  const chartDays = viewMode === 'week' ? getWeekDays() : getMonthDays();

  // Combine data per day
  const dayData = chartDays.map(day => {
    const join = joins.find(j => j.date === day.date);
    const attRec = attendanceRecords.find(a => a.date === day.date);
    const perm = permissions.find(p => p.date === day.date && (p.status === 'Approved' || p.status === 'Acknowledged'));

    let status: 'green' | 'yellow' | 'red' | 'excused' | 'absent' | 'empty' | 'future' = 'empty';
    let minutesLate = 0;
    let timeLabel = '—';
    let penalty = 0;

    if (day.isFuture) {
      status = 'future';
    } else if (perm) {
      status = 'excused';
      timeLabel = 'Excused';
    } else if (join) {
      minutesLate = join.minutesLate ?? 0;
      if (minutesLate <= 0) {
        status = 'green';
        timeLabel = join.joinedAt ? new Date(join.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : 'On time';
      } else if (minutesLate < redFrom) {
        status = 'yellow';
        penalty = yellowPenalty;
        timeLabel = `+${minutesLate}m`;
      } else {
        status = 'red';
        penalty = redPenalty;
        timeLabel = `+${minutesLate}m`;
      }
    } else if (attRec) {
      if (attRec.status === 'P') {
        status = 'green';
        timeLabel = 'Present';
      } else if (attRec.status === 'L') {
        status = 'yellow';
        timeLabel = 'Late';
        penalty = yellowPenalty;
      } else if (attRec.status === 'E') {
        status = 'excused';
        timeLabel = 'Excused';
      } else if (attRec.status === 'U') {
        status = 'absent';
        timeLabel = 'Absent';
      }
    }

    return {
      ...day,
      join,
      status,
      minutesLate,
      timeLabel,
      penalty,
    };
  });

  // Calculate summary metrics
  const activeDays = dayData.filter(d => d.status !== 'empty' && d.status !== 'future');
  const onTimeDays = activeDays.filter(d => d.status === 'green').length;
  const lateDays = activeDays.filter(d => d.status === 'yellow' || d.status === 'red').length;
  const totalPenalty = activeDays.reduce((acc, d) => acc + d.penalty, 0);

  const totalLateMins = activeDays.reduce((acc, d) => acc + (d.minutesLate > 0 ? d.minutesLate : 0), 0);
  const avgLateMins = lateDays > 0 ? Math.round(totalLateMins / lateDays) : 0;

  return (
    <div className="bg-white dark:bg-[#121212] border border-slate-200/90 dark:border-[#262626] rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header with Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[11px] font-bold tracking-wide uppercase mb-1">
            <Clock className="w-3 h-3" />
            <span>Attendance Overview</span>
          </div>
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
            Join Time &amp; Lateness Tracking
          </h3>
        </div>

        {/* Week / Month Toggle */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'week'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            This Week
          </button>
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'month'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            This Month
          </button>
        </div>
      </div>

      {/* Bar Chart Container */}
      <div className="relative pt-4 pb-2 overflow-x-auto scrollbar-none">
        <div className={`flex items-end gap-2 sm:gap-3 min-w-full ${viewMode === 'month' ? 'w-[640px] sm:w-full' : ''} h-40 px-2`}>
          {dayData.map((d, idx) => {
            let barHeightPct = 15;
            let barBg = 'bg-slate-300 dark:bg-slate-700/80 border border-slate-300 dark:border-slate-600/50';
            let labelColor = 'text-slate-500 dark:text-slate-400';

            if (d.status === 'green') {
              barHeightPct = 75;
              barBg = 'bg-emerald-500 dark:bg-emerald-400';
              labelColor = 'text-emerald-600 dark:text-emerald-400 font-bold';
            } else if (d.status === 'yellow') {
              barHeightPct = Math.min(95, 30 + d.minutesLate * 4);
              barBg = 'bg-amber-500 dark:bg-amber-400';
              labelColor = 'text-amber-600 dark:text-amber-400 font-bold';
            } else if (d.status === 'red') {
              barHeightPct = Math.min(100, 50 + d.minutesLate * 3);
              barBg = 'bg-rose-500 dark:bg-rose-400';
              labelColor = 'text-rose-600 dark:text-rose-400 font-bold';
            } else if (d.status === 'excused') {
              barHeightPct = 50;
              barBg = 'bg-blue-500 dark:bg-blue-400';
              labelColor = 'text-blue-600 dark:text-blue-400 font-bold';
            } else if (d.status === 'absent') {
              barHeightPct = 25;
              barBg = 'bg-rose-300 dark:bg-rose-900/60';
              labelColor = 'text-rose-500';
            } else if (d.status === 'future') {
              barHeightPct = 15;
              barBg = 'bg-slate-200 dark:bg-slate-800/60 border border-slate-300/60 dark:border-slate-700/40';
            }

            const isHovered = activeTooltipIndex === idx;

            return (
              <div
                key={d.date}
                className="flex-1 flex flex-col items-center justify-end h-full relative group cursor-pointer"
                onMouseEnter={() => setActiveTooltipIndex(idx)}
                aria-label={`Join details for ${d.date}`}
                onMouseLeave={() => setActiveTooltipIndex(null)}
                onClick={() => setActiveTooltipIndex(isHovered ? null : idx)}
              >
                {/* Time / Status Label above Bar */}
                <span className={`text-[10px] mb-1.5 text-center truncate w-full ${labelColor}`}>
                  {d.timeLabel}
                </span>

                {/* Vertical Bar */}
                <div className="w-full max-w-[28px] bg-slate-200/80 dark:bg-slate-800/80 border border-slate-300/80 dark:border-slate-700/60 rounded-xl overflow-hidden flex items-end h-28 p-0.5 shadow-2xs">
                  <div
                    className={`w-full rounded-lg transition-all duration-500 ease-out ${barBg}`}
                    style={{ height: `${barHeightPct}%` }}
                  />
                </div>

                {/* Day Label Below Bar */}
                <span className={`text-[11px] font-semibold mt-2 ${d.isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                  {d.label}
                </span>

                {/* Tooltip Card */}
                {isHovered && d.status !== 'future' && (
                  <div className="absolute bottom-full mb-2 z-30 p-3 rounded-2xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xl border border-slate-700/50 dark:border-slate-300/50 text-xs w-44 space-y-1 animate-in fade-in zoom-in-95 pointer-events-none">
                    <p className="font-bold text-[11px] border-b border-slate-700 dark:border-slate-300/50 pb-1">
                      {d.date} {d.isToday ? '(Today)' : ''}
                    </p>
                    <p className="text-[11px] flex justify-between">
                      <span>Status:</span>
                      <span className="font-bold capitalize">{d.status}</span>
                    </p>
                    {d.minutesLate > 0 && (
                      <p className="text-[11px] flex justify-between text-amber-400 dark:text-amber-600">
                        <span>Lateness:</span>
                        <span className="font-bold">+{d.minutesLate} mins</span>
                      </p>
                    )}
                    {d.penalty > 0 && (
                      <p className="text-[11px] flex justify-between text-rose-400 dark:text-rose-600 font-bold">
                        <span>Penalty:</span>
                        <span>-{d.penalty} pts</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend & Summary Row */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> On Time
          </span>
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 1–9m Late
          </span>
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> 10+m Late
          </span>
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Excused
          </span>
        </div>

        {/* Metrics Summary */}
        <div className="flex items-center gap-4 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          <span>On time: <strong className="text-emerald-600 dark:text-emerald-400">{onTimeDays} d</strong></span>
          <span>Late: <strong className="text-amber-600 dark:text-amber-400">{lateDays} d</strong></span>
          {avgLateMins > 0 && <span>Avg late: <strong className="text-slate-800 dark:text-slate-200">{avgLateMins}m</strong></span>}
          {totalPenalty > 0 && <span>Deductions: <strong className="text-rose-600 dark:text-rose-400">-{totalPenalty} pts</strong></span>}
        </div>
      </div>
    </div>
  );
};
