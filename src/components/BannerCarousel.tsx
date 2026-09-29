import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Pause,
  Play,
  Settings,
} from 'lucide-react';
import { AnnouncementBanner, BannerColorTheme } from '../types';

interface BannerCarouselProps {
  banners: AnnouncementBanner[];
  onManageBanners?: () => void;
  isTeacher?: boolean;
}

const THEME_STYLES: Record<
  BannerColorTheme,
  {
    solidDarkBg: string;
    solidLightBg: string;
    cardBorder: string;
    cardBorderDark: string;
    badgeBg: string;
    badgeText: string;
    accent: string;
    accentHover: string;
    glow: string;
    leftBorderAccent: string;
  }
> = {
  green: {
    solidDarkBg: 'bg-[#121212]',
    solidLightBg: 'bg-white',
    cardBorder: 'border-slate-200',
    cardBorderDark: 'border-[#27272A]',
    badgeBg: 'bg-[#4BA95F]/15 dark:bg-[#4BA95F]/20 border border-[#4BA95F]/30 dark:border-[#4BA95F]/50',
    badgeText: 'text-[#2e7d32] dark:text-[#4BA95F]',
    accent: '#4BA95F',
    accentHover: '#3e8f50',
    glow: 'rgba(75, 169, 95, 0.25)',
    leftBorderAccent: 'border-l-4 border-l-[#4BA95F]',
  },
  cyan: {
    solidDarkBg: 'bg-[#121212]',
    solidLightBg: 'bg-white',
    cardBorder: 'border-slate-200',
    cardBorderDark: 'border-[#27272A]',
    badgeBg: 'bg-[#77DDFA]/15 dark:bg-[#77DDFA]/20 border border-[#77DDFA]/30 dark:border-[#77DDFA]/50',
    badgeText: 'text-[#0369a1] dark:text-[#77DDFA]',
    accent: '#77DDFA',
    accentHover: '#5ecbe9',
    glow: 'rgba(119, 221, 250, 0.25)',
    leftBorderAccent: 'border-l-4 border-l-[#77DDFA]',
  },
  amber: {
    solidDarkBg: 'bg-[#121212]',
    solidLightBg: 'bg-white',
    cardBorder: 'border-slate-200',
    cardBorderDark: 'border-[#27272A]',
    badgeBg: 'bg-[#FEA339]/15 dark:bg-[#FEA339]/20 border border-[#FEA339]/30 dark:border-[#FEA339]/50',
    badgeText: 'text-[#b45309] dark:text-[#FEA339]',
    accent: '#FEA339',
    accentHover: '#e6902d',
    glow: 'rgba(254, 163, 57, 0.25)',
    leftBorderAccent: 'border-l-4 border-l-[#FEA339]',
  },
  purple: {
    solidDarkBg: 'bg-[#121212]',
    solidLightBg: 'bg-white',
    cardBorder: 'border-slate-200',
    cardBorderDark: 'border-[#27272A]',
    badgeBg: 'bg-[#9985FB]/15 dark:bg-[#9985FB]/20 border border-[#9985FB]/30 dark:border-[#9985FB]/50',
    badgeText: 'text-[#6348eb] dark:text-[#9985FB]',
    accent: '#9985FB',
    accentHover: '#8570ec',
    glow: 'rgba(153, 133, 251, 0.25)',
    leftBorderAccent: 'border-l-4 border-l-[#9985FB]',
  },
  coral: {
    solidDarkBg: 'bg-[#121212]',
    solidLightBg: 'bg-white',
    cardBorder: 'border-slate-200',
    cardBorderDark: 'border-[#27272A]',
    badgeBg: 'bg-[#FF908D]/15 dark:bg-[#FF908D]/20 border border-[#FF908D]/30 dark:border-[#FF908D]/50',
    badgeText: 'text-[#e11d48] dark:text-[#FF908D]',
    accent: '#FF908D',
    accentHover: '#eb7b78',
    glow: 'rgba(255, 144, 141, 0.25)',
    leftBorderAccent: 'border-l-4 border-l-[#FF908D]',
  },
};

const DEFAULT_BANNER: AnnouncementBanner = {
  id: 'def_ban',
  title: 'Welcome to Central Academy Resource Library',
  description: 'Access textbooks, model essays, grammar exercises, and curriculum guidelines.',
  badge: 'Library Announcement',
  bgColor: 'green',
  isActive: true,
};

export const BannerCarousel: React.FC<BannerCarouselProps> = ({
  banners,
  onManageBanners,
  isTeacher = false,
}) => {
  const activeBanners = banners.filter(b => b.isActive !== false);
  const list = activeBanners.length > 0 ? activeBanners : [DEFAULT_BANNER];

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const SLIDE_DURATION = 10000; // 10-second requirement
  const TICK_INTERVAL = 50; // Progress bar tick

  // Handle slide advance
  const nextSlide = () => {
    setCurrentIndex(prev => (prev + 1) % list.length);
    setProgress(0);
  };

  const prevSlide = () => {
    setCurrentIndex(prev => (prev - 1 + list.length) % list.length);
    setProgress(0);
  };

  const goToSlide = (idx: number) => {
    setCurrentIndex(idx);
    setProgress(0);
  };

  // Auto-slide 10-second timer and smooth progress indicator
  useEffect(() => {
    if (list.length <= 1 || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      return;
    }

    const step = (TICK_INTERVAL / SLIDE_DURATION) * 100;
    progressIntervalRef.current = setInterval(() => {
      setProgress(old => {
        if (old >= 100) {
          nextSlide();
          return 0;
        }
        return old + step;
      });
    }, TICK_INTERVAL);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, isPaused, list.length]);

  const currentBanner = list[currentIndex] || DEFAULT_BANNER;
  const theme = THEME_STYLES[currentBanner.bgColor || 'green'] || THEME_STYLES.green;

  return (
    <div
      className={`relative w-full rounded-3xl overflow-hidden border ${theme.cardBorder} dark:${theme.cardBorderDark} bg-white dark:bg-[#121212] shadow-xl group select-none transition-all duration-300 ${theme.leftBorderAccent}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{
        boxShadow: `0 8px 24px -6px ${theme.glow}`,
      }}
    >
      {/* Background container: Solid Deep Dark #121212 in Dark Mode, Solid White in Light Mode */}
      <div
        className={`relative min-h-[170px] sm:min-h-[190px] md:min-h-[210px] ${theme.solidLightBg} dark:${theme.solidDarkBg} p-5 sm:p-7 md:p-8 flex flex-col justify-between transition-colors duration-300`}
      >
        {/* Top bar inside banner */}
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase shadow-sm ${theme.badgeBg} ${theme.badgeText}`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{currentBanner.badge || 'Announcement'}</span>
            </span>

            {/* 10-Second Auto-Slide Tag */}
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium text-slate-500 dark:text-[#E4E4E7] bg-slate-100 dark:bg-[#18181B] border border-slate-200/80 dark:border-[#27272A]">
              <span>Auto-slide 10s</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Play/Pause indicator */}
            <button
              type="button"
              onClick={() => setIsPaused(!isPaused)}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-[#18181B] text-slate-700 dark:text-[#FFFFFF] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#27272A] hover:bg-slate-200 dark:hover:bg-[#27272A] transition-colors"
              title={isPaused ? 'Resume 10s auto-slide' : 'Pause auto-slide'}
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>

            {/* Teacher Manage Banners button */}
            {isTeacher && onManageBanners && (
              <button
                type="button"
                onClick={onManageBanners}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#4BA95F] text-white hover:bg-[#3e8f50] shadow-sm transition-all active:scale-95"
                title="Manage announcements & banner slides"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Edit Banners</span>
              </button>
            )}
          </div>
        </div>

        {/* Center Content: Title, Description, Image & Action */}
        <div className="relative z-10 my-3 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <h3 className="text-lg sm:text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-[#FFFFFF] tracking-tight leading-snug">
              {currentBanner.title}
            </h3>
            {currentBanner.description && (
              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#E4E4E7] leading-relaxed max-w-xl line-clamp-2 sm:line-clamp-3">
                {currentBanner.description}
              </p>
            )}
          </div>

          {/* Right Action / Image Thumbnail if provided */}
          <div className="flex items-center gap-3 shrink-0">
            {currentBanner.imageUrl && (
              <img
                src={currentBanner.imageUrl}
                alt={currentBanner.title}
                className="hidden sm:block w-24 h-24 md:w-28 md:h-28 rounded-2xl object-cover ring-2 ring-slate-200 dark:ring-[#27272A] shadow-lg"
              />
            )}

            {currentBanner.linkUrl && (
              <a
                href={currentBanner.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 text-white"
                style={{ backgroundColor: theme.accent }}
              >
                <span>Learn More</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Bottom Bar: Indicators & Left/Right Arrows */}
        <div className="relative z-10 pt-2 flex items-center justify-between gap-4 border-t border-slate-100 dark:border-[#27272A]">
          {/* Pagination dots & counter */}
          <div className="flex items-center gap-2">
            {list.map((b, idx) => (
              <button
                key={b.id || idx}
                type="button"
                onClick={() => goToSlide(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === currentIndex
                    ? 'w-6 shadow-sm'
                    : 'w-2 bg-slate-300 dark:bg-[#27272A] hover:bg-slate-400 dark:hover:bg-[#3F3F46]'
                }`}
                style={{
                  backgroundColor: idx === currentIndex ? theme.accent : undefined,
                }}
                aria-label={`Slide ${idx + 1}`}
              />
            ))}
            <span className="text-[11px] font-mono font-semibold text-slate-600 dark:text-[#E4E4E7] ml-2">
              {currentIndex + 1} / {list.length}
            </span>
          </div>

          {/* Prev / Next controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={prevSlide}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-[#18181B] hover:bg-slate-200 dark:hover:bg-[#27272A] text-slate-800 dark:text-[#FFFFFF] border border-slate-200 dark:border-[#27272A] transition-colors"
              aria-label="Previous banner"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-[#18181B] hover:bg-slate-200 dark:hover:bg-[#27272A] text-slate-800 dark:text-[#FFFFFF] border border-slate-200 dark:border-[#27272A] transition-colors"
              aria-label="Next banner"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 10-Second Progress Line at Bottom */}
      <div className="h-1.5 w-full bg-slate-100 dark:bg-[#18181B] overflow-hidden">
        <div
          className="h-full transition-all duration-100 ease-linear"
          style={{
            width: `${progress}%`,
            backgroundColor: theme.accent,
          }}
        />
      </div>
    </div>
  );
};

