import React from 'react';
import { BookOpen, HelpCircle, Award, Sparkles } from 'lucide-react';
import { ActivityKind } from '../types';
import { getDifficultyMeta } from '../utils/helpers';

interface ActivityCardThumbnailProps {
  thumbnail?: string;
  kind: ActivityKind | 'homework';
  difficulty?: number;
  label?: string;
  topRightBadge?: React.ReactNode;
  topLeftBadge?: React.ReactNode;
}

export const ActivityCardThumbnail: React.FC<ActivityCardThumbnailProps> = ({
  thumbnail,
  kind,
  difficulty = 3,
  label,
  topRightBadge,
  topLeftBadge,
}) => {
  const diffMeta = getDifficultyMeta(difficulty);

  const renderDifficultyBadge = () => (
    <span
      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold backdrop-blur-md border shadow-xs bg-white/90 dark:bg-slate-900/90 ${diffMeta.badgeClass}`}
      title={`Difficulty: ${diffMeta.label}`}
    >
      <span className="opacity-90">{diffMeta.stars}</span> {diffMeta.shortLabel}
    </span>
  );

  if (thumbnail) {
    return (
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-200/80 dark:border-slate-800 shrink-0 group">
        <img
          src={thumbnail}
          alt={label || `${kind} thumbnail`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none" />
        
        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
          {topLeftBadge}
        </div>
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
          {topRightBadge || renderDifficultyBadge()}
        </div>
      </div>
    );
  }

  // Default placeholder styling based on kind
  let gradientClass = 'from-purple-700 via-indigo-700 to-slate-900';
  let Icon = BookOpen;
  let defaultKindLabel = 'Homework';
  let textAccent = 'text-purple-200';

  if (kind === 'quiz') {
    gradientClass = 'from-indigo-700 via-purple-800 to-slate-950';
    Icon = HelpCircle;
    defaultKindLabel = 'Quiz';
    textAccent = 'text-indigo-200';
  } else if (kind === 'exam') {
    gradientClass = 'from-rose-700 via-red-800 to-slate-950';
    Icon = Award;
    defaultKindLabel = 'Final Exam';
    textAccent = 'text-rose-200';
  } else if (kind === 'custom') {
    gradientClass = 'from-amber-600 via-orange-700 to-slate-950';
    Icon = Sparkles;
    defaultKindLabel = label || 'Activity';
    textAccent = 'text-amber-200';
  }

  return (
    <div
      className={`relative w-full aspect-video rounded-2xl overflow-hidden bg-gradient-to-tr ${gradientClass} flex flex-col items-center justify-center text-white/90 shadow-inner border border-white/10 shrink-0 group`}
    >
      <div className="flex flex-col items-center gap-1.5 transform group-hover:scale-105 transition-transform duration-200">
        <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/15 shadow-md">
          <Icon className="w-6 h-6 text-white drop-shadow" />
        </div>
        <span className={`text-[11px] font-black uppercase tracking-wider ${textAccent}`}>
          {label || defaultKindLabel}
        </span>
      </div>

      {/* Top Badges */}
      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
        {topLeftBadge}
      </div>
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
        {topRightBadge || renderDifficultyBadge()}
      </div>
    </div>
  );
};
