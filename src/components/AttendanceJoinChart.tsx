import React, { useState } from 'react';
import { Clock, Info } from 'lucide-react';
import { ClassJoinRecord, StudentPermissionRequest } from '../types';
import { getAttendanceCredit } from '../utils/helpers';

export interface AttendanceJoinChartProps {
  joins: ClassJoinRecord[];
  permissions: StudentPermissionRequest[];
  attendanceRecords: {
    date: string;
    status: string;
    reason?: string;
    minutesLate?: number;
    joinedAt?: string;
  }[];
  classDuration?: number;
  classStartTime?: string;
  yellowFrom?: number;
  redFrom?: number;
  yellowPenalty?: number;
  redPenalty?: number;
}

interface DayItem {
  date: string;
  dayName: string; // "Mon", "Tue", etc.
  dayNum: string; // "1", "29", etc.
  isToday: boolean;
  isFuture: boolean;
  isCurrentMonth: boolean;
  hasSession: boolean;
  status: 'P' | 'L' | 'E' | 'U' | 'empty';
  minutesLate: number;
  minutesAttended: number;
  fillHeightPct: number;
  colorType: 'green' | 'yellow' | 'orange' | 'red' | 'excused' | 'absent' | 'empty';
  primaryLabel: string;
  secondaryLabel?: string;
  credit: number;
  reason?: string;
}

export const AttendanceJoinChart: React.FC<AttendanceJoinChartProps> = ({
  joins,
  permissions,
  attendanceRecords,
  classDuration = 60,
  classStartTime = '20:00',
}) => {
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<'all' | number>('all');
  const [activeTooltipDate, setActiveTooltipDate] = useState<string | null>(null);

  const todayObj = new Date();
  const todayStr = todayObj.toISOString().slice(0, 10);

  // Compute a single day item
  const buildDayItem = (d: Date, isCurrentMonth = true): DayItem => {
    const dateStr = d.toISOString().slice(0, 10);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = `${d.getDate()}`;
    const isToday = dateStr === todayStr;
    const isFuture = dateStr > todayStr;

    const attRec = attendanceRecords.find(a => a.date === dateStr);
    const join = joins.find(j => j.date === dateStr);
    const perm = permissions.find(
      p => p.date === dateStr && (p.status === 'Approved' || p.status === 'Acknowledged')
    );

    let hasSession = false;
    let rawStatus: 'P' | 'L' | 'E' | 'U' | 'empty' = 'empty';
    let minsLate = 0;
    let reason = attRec?.reason || perm?.reason;

    if (attRec && attRec.status) {
      hasSession = true;
      rawStatus = attRec.status as 'P' | 'L' | 'E' | 'U';
      if (rawStatus === 'L') {
        minsLate = attRec.minutesLate ?? join?.minutesLate ?? 8;
      } else if (rawStatus === 'P') {
        minsLate = attRec.minutesLate ?? 0;
      }
    } else if (join) {
      hasSession = true;
      minsLate = join.minutesLate ?? 0;
      rawStatus = minsLate <= 5 ? 'P' : 'L';
    } else if (perm) {
      hasSession = true;
      rawStatus = 'E';
      minsLate = 0;
    }

    let colorType: DayItem['colorType'] = 'empty';
    let fillHeightPct = 0;
    let minutesAttended = 0;
    let primaryLabel = '—';
    let secondaryLabel: string | undefined = undefined;
    let credit = 0;

    const oneThird = Math.floor(classDuration / 3);

    if (hasSession) {
      if (rawStatus === 'P' || rawStatus === 'L') {
        minsLate = Math.max(0, minsLate);
        minutesAttended = Math.max(0, classDuration - minsLate);
        // Fill height = minutes attended / class duration (e.g. 30 min late in 60 min class fills 50%)
        fillHeightPct = Math.min(100, Math.round((minutesAttended / classDuration) * 100));

        if (minsLate <= 5) {
          colorType = 'green';
          primaryLabel = 'On time';
          credit = 1.0;
        } else if (minsLate <= 10) {
          colorType = 'yellow';
          primaryLabel = `+${minsLate}m`;
          credit = 0.75;
        } else if (minsLate <= oneThird) {
          colorType = 'orange';
          primaryLabel = `+${minsLate}m`;
          credit = 0.5;
        } else {
          colorType = 'red';
          primaryLabel = `+${minsLate}m`;
          secondaryLabel = 'no credit';
          credit = 0;
          // Beyond one third: red (fill stays reduced, minimum 8% so visible)
          fillHeightPct = Math.max(8, fillHeightPct);
        }
      } else if (rawStatus === 'E') {
        colorType = 'excused';
        fillHeightPct = 100;
        minutesAttended = classDuration;
        primaryLabel = 'Excused';
        credit = 0.5;
      } else if (rawStatus === 'U') {
        colorType = 'absent';
        fillHeightPct = 0;
        minutesAttended = 0;
        primaryLabel = 'Absent';
        secondaryLabel = 'no credit';
        credit = 0;
      }
    }

    return {
      date: dateStr,
      dayName,
      dayNum,
      isToday,
      isFuture,
      isCurrentMonth,
      hasSession,
      status: rawStatus,
      minutesLate: minsLate,
      minutesAttended,
      fillHeightPct,
      colorType,
      primaryLabel,
      secondaryLabel,
      credit,
      reason,
    };
  };

  // Generate Week Days (Monday to Sunday of current week)
  const getWeekDays = (): DayItem[] => {
    const current = new Date(todayObj);
    const dayOfWeek = current.getDay(); // 0 = Sunday
    const distanceToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(current.setDate(current.getDate() + distanceToMon));

    const list: DayItem[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      list.push(buildDayItem(d, true));
    }
    return list;
  };

  // Generate Month Weeks (Weeks 1 to 5 of current month, Monday to Sunday)
  const getMonthWeeks = (): { weekIndex: number; label: string; days: DayItem[] }[] => {
    const year = todayObj.getFullYear();
    const month = todayObj.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();

    const weeks: { weekIndex: number; label: string; days: DayItem[] }[] = [];
    let currentWeekDays: DayItem[] = [];
    let weekCount = 1;

    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month, day);
      currentWeekDays.push(buildDayItem(d, true));

      const isSunday = d.getDay() === 0;
      const isLast = day === totalDays;

      if (isSunday || isLast) {
        const startDay = currentWeekDays[0].dayNum;
        const endDay = currentWeekDays[currentWeekDays.length - 1].dayNum;
        weeks.push({
          weekIndex: weekCount,
          label: `Week ${weekCount} (${startDay}–${endDay})`,
          days: [...currentWeekDays],
        });
        currentWeekDays = [];
        weekCount++;
      }
    }

    return weeks;
  };

  const weekDays = getWeekDays();
  const monthWeeks = getMonthWeeks();
  const allMonthDays = monthWeeks.flatMap(w => w.days);

  // Active dataset for summary metrics
  const currentDataset = viewMode === 'week' ? weekDays : allMonthDays;
  const recordedDays = currentDataset.filter(d => d.hasSession);

  // Days on time (0-5m late)
  const daysOnTime = recordedDays.filter(d => d.colorType === 'green').length;

  // Days late (any late arrival: yellow, orange, red)
  const daysLate = recordedDays.filter(
    d => d.colorType === 'yellow' || d.colorType === 'orange' || d.colorType === 'red'
  ).length;

  // Average minutes late across all late days
  const lateMinutesList = recordedDays
    .filter(d => d.minutesLate > 0)
    .map(d => d.minutesLate);
  const totalLateMinutes = lateMinutesList.reduce((acc, m) => acc + m, 0);
  const avgLateMins = daysLate > 0 ? Math.round(totalLateMinutes / daysLate) : 0;

  // Render a single day column
  const renderDayColumn = (d: DayItem, colIndex = 0) => {
    const isHovered = activeTooltipDate === d.date;

    // Label styling
    let labelColor = 'text-slate-400 dark:text-slate-600';
    if (d.colorType === 'green') labelColor = 'text-emerald-600 dark:text-emerald-400';
    else if (d.colorType === 'yellow') labelColor = 'text-amber-500 dark:text-amber-400';
    else if (d.colorType === 'orange') labelColor = 'text-orange-500 dark:text-orange-400';
    else if (d.colorType === 'red') labelColor = 'text-rose-500 dark:text-rose-400';
    else if (d.colorType === 'excused') labelColor = 'text-blue-600 dark:text-blue-400';
    else if (d.colorType === 'absent') labelColor = 'text-rose-500 dark:text-rose-400';

    const tooltipPositionClass =
      colIndex === 0
        ? 'left-0 translate-x-0'
        : colIndex === 6
        ? 'right-0 translate-x-0'
        : 'left-1/2 -translate-x-1/2';

    return (
      <div
        key={d.date}
        className="flex-1 flex flex-col items-center justify-end relative group cursor-pointer select-none"
        onMouseEnter={() => setActiveTooltipDate(d.date)}
        onMouseLeave={() => setActiveTooltipDate(null)}
        onClick={() => setActiveTooltipDate(isHovered ? null : d.date)}
      >
        {/* Label Above Bar */}
        <div className="h-8 flex flex-col justify-end items-center mb-1.5 w-full px-0.5">
          <span className={`text-[10px] sm:text-xs font-bold leading-tight truncate w-full text-center ${labelColor}`}>
            {d.primaryLabel}
          </span>
          {d.secondaryLabel && (
            <span className="text-[8px] sm:text-[9px] font-bold text-rose-500 dark:text-rose-400 leading-none mt-0.5 block text-center whitespace-nowrap">
              {d.secondaryLabel}
            </span>
          )}
        </div>

        {/* Vertical Pill Bar */}
        <div className="w-full flex justify-center">
          {d.colorType === 'excused' ? (
            /* Excused: blue, full-height outline with a light fill */
            <div
              className="w-5 sm:w-6 h-28 sm:h-32 rounded-full border-2 border-blue-500 dark:border-blue-400 bg-blue-500/15 dark:bg-blue-400/20 shadow-xs"
              title={`Excused - ${classDuration} min session`}
            />
          ) : d.colorType === 'absent' ? (
            /* Unexcused absent: empty red outline */
            <div
              className="w-5 sm:w-6 h-28 sm:h-32 rounded-full border-2 border-rose-500 dark:border-rose-400 bg-transparent shadow-xs"
              title="Unexcused absent (0 credit)"
            />
          ) : d.hasSession ? (
            /* Filled Pill (Green, Yellow, Orange, Red) */
            <div className="w-5 sm:w-6 h-28 sm:h-32 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 p-0.5 overflow-hidden flex items-end shadow-2xs">
              <div
                className={`w-full rounded-full transition-all duration-500 ease-out ${
                  d.colorType === 'green'
                    ? 'bg-emerald-500 dark:bg-emerald-400 shadow-xs shadow-emerald-500/30'
                    : d.colorType === 'yellow'
                    ? 'bg-amber-400 dark:bg-amber-400 shadow-xs shadow-amber-400/30'
                    : d.colorType === 'orange'
                    ? 'bg-orange-500 dark:bg-orange-400 shadow-xs shadow-orange-500/30'
                    : 'bg-rose-500 dark:bg-rose-400 shadow-xs shadow-rose-500/30'
                }`}
                style={{ height: `${d.fillHeightPct}%` }}
              />
            </div>
          ) : (
            /* Days with no session stay as the current empty pill */
            <div className="w-5 sm:w-6 h-28 sm:h-32 rounded-full border border-dashed border-slate-200/90 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-800/30" />
          )}
        </div>

        {/* Day Label Below Bar */}
        <div className="mt-2 text-center">
          <span
            className={`text-[11px] font-bold block leading-none ${
              d.isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            {d.dayName}
          </span>
          <span
            className={`text-[10px] block mt-0.5 ${
              d.isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {d.dayNum}
          </span>
        </div>

        {/* Tooltip on Hover / Tap: Compact, theme-aware (dark in dark mode with white text, white in light mode with dark text) */}
        {isHovered && (
          <div
            className={`absolute bottom-full mb-2 z-40 p-2 rounded-xl bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-xl border border-slate-200/90 dark:border-white/15 text-[10px] w-36 space-y-1 animate-in fade-in zoom-in-95 pointer-events-none ${tooltipPositionClass}`}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-1 font-bold text-[10px] text-slate-900 dark:text-white leading-tight">
              <span>{d.date}</span>
              {d.isToday && <span className="text-blue-600 dark:text-blue-400 font-semibold">(Today)</span>}
            </div>
            {d.hasSession ? (
              <div className="space-y-0.5 text-[10px] text-slate-900 dark:text-white leading-tight">
                <div className="flex justify-between items-center gap-1">
                  <span>Status:</span>
                  <span className="font-bold">
                    {d.primaryLabel} {d.secondaryLabel ? `(${d.secondaryLabel})` : ''}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-1">
                  <span>Credit:</span>
                  <span className="font-bold font-mono">{d.credit} pts</span>
                </div>
                {(d.colorType === 'green' || d.colorType === 'yellow' || d.colorType === 'orange' || d.colorType === 'red') && (
                  <>
                    <div className="flex justify-between items-center gap-1">
                      <span>Attended:</span>
                      <span className="font-bold">
                        {d.minutesAttended}m / {classDuration}m
                      </span>
                    </div>
                    {d.minutesLate > 0 && (
                      <div className="flex justify-between items-center gap-1">
                        <span>Lateness:</span>
                        <span className="font-bold">+{d.minutesLate}m</span>
                      </div>
                    )}
                  </>
                )}
                {d.reason && (
                  <div className="pt-0.5 border-t border-slate-100 dark:border-white/10 text-[9px] truncate max-w-full">
                    <span className="italic">{d.reason}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-slate-900 dark:text-white italic leading-tight">No session</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white/80 dark:bg-[#121212]/90 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 rounded-3xl p-4 sm:p-6 shadow-xs space-y-5">
      {/* Header with Title and Week/Month Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[11px] font-bold tracking-wide uppercase mb-1">
            <Clock className="w-3 h-3" />
            <span>Attendance Overview</span>
          </div>
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
            Join Time &amp; Lateness Tracking
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Class duration: <strong className="text-slate-700 dark:text-slate-200">{classDuration} min</strong> &bull; Starts at: <strong className="text-slate-700 dark:text-slate-200">{classStartTime}</strong>
          </p>
        </div>

        {/* This Week / This Month Toggle */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl shrink-0 self-start sm:self-auto border border-slate-200/60 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'week'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            This Month
          </button>
        </div>
      </div>

      {/* Chart Section */}
      {viewMode === 'week' ? (
        /* Week View: 7 Daily Bars across Mon-Sun */
        <div className="pt-2 pb-1">
          <div className="grid grid-cols-7 gap-1 sm:gap-2.5 w-full">
            {weekDays.map((d, idx) => renderDayColumn(d, idx))}
          </div>
        </div>
      ) : (
        /* Month View: Organized by Weeks to ensure no overlapping labels and no horizontal scroll */
        <div className="space-y-4 pt-1">
          {/* Week Selection Chips for Month */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedWeekIndex('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedWeekIndex === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All Weeks ({monthWeeks.length})
            </button>
            {monthWeeks.map(w => (
              <button
                key={w.weekIndex}
                type="button"
                onClick={() => setSelectedWeekIndex(w.weekIndex)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedWeekIndex === w.weekIndex
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>

          {/* Week Rows */}
          <div className="space-y-6">
            {monthWeeks
              .filter(w => selectedWeekIndex === 'all' || selectedWeekIndex === w.weekIndex)
              .map(w => (
                <div key={w.weekIndex} className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    <span>{w.label}</span>
                    <span className="text-slate-400 font-normal lowercase">
                      {w.days.filter(d => d.hasSession).length} recorded sessions
                    </span>
                  </div>

                  <div className="grid grid-cols-7 gap-1 sm:gap-2.5 w-full p-2 rounded-2xl bg-slate-50/50 dark:bg-[#161616]/60 border border-slate-100 dark:border-[#222222]">
                    {w.days.map((d, idx) => renderDayColumn(d, idx))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Legend & Summary Row */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span>On time (0-5m)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
            <span>Late (6-10m)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
            <span>Very late (11m+)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <span>No credit</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-blue-500 bg-blue-500/20 shrink-0" />
            <span>Excused</span>
          </span>
        </div>

        {/* Summary Metrics */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100/80 dark:border-slate-800/60 text-xs">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 font-semibold">
            <span className="text-emerald-600 dark:text-emerald-400">
              {daysOnTime} {daysOnTime === 1 ? 'day' : 'days'} on time
            </span>
            <span className="text-slate-300 dark:text-slate-700">&bull;</span>
            <span className="text-amber-500 dark:text-amber-400">
              {daysLate} {daysLate === 1 ? 'day' : 'days'} late
            </span>
            <span className="text-slate-300 dark:text-slate-700">&bull;</span>
            <span className="text-slate-700 dark:text-slate-300">
              {avgLateMins}m average minutes late
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Bars scaled to {classDuration}m duration</span>
          </div>
        </div>
      </div>
    </div>
  );
};
