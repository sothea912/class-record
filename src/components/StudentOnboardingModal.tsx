import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  CalendarCheck,
  Trophy,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
} from 'lucide-react';

interface StudentOnboardingModalProps {
  studentId: string;
  studentName?: string;
}

export const StudentOnboardingModal: React.FC<StudentOnboardingModalProps> = ({
  studentId,
  studentName,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [currentSlide, setCurrentSlide] = useState<number>(0);

  // Touch Swipe State
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  useEffect(() => {
    if (!studentId) return;
    const storageKey = `onboarding_seen_${studentId}`;
    try {
      const seen = localStorage.getItem(storageKey);
      if (!seen) {
        setIsOpen(true);
      }
    } catch {
      // In case localStorage is blocked
      setIsOpen(false);
    }
  }, [studentId]);

  const handleDismiss = () => {
    if (studentId) {
      try {
        localStorage.setItem(`onboarding_seen_${studentId}`, 'true');
      } catch (err) {
        console.warn('[Onboarding LocalStorage Set Error]:', err);
      }
    }
    setIsOpen(false);
  };

  const handleNext = () => {
    if (currentSlide < 3) {
      setCurrentSlide(prev => prev + 1);
    } else {
      handleDismiss();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        if (currentSlide < 3) setCurrentSlide(prev => prev + 1);
      } else if (e.key === 'ArrowLeft') {
        if (currentSlide > 0) setCurrentSlide(prev => prev - 1);
      } else if (e.key === 'Escape') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentSlide]);

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchEndX(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return;
    const distance = touchStartX - touchEndX;
    if (distance > 45 && currentSlide < 3) {
      setCurrentSlide(prev => prev + 1);
    } else if (distance < -45 && currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  if (!isOpen) return null;

  const slides = [
    {
      icon: (
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-2xl animate-pulse">
          <GraduationCap className="w-10 h-10 sm:w-12 sm:h-12" />
        </div>
      ),
      heading: `Welcome, ${studentName ? studentName.split(' ')[0] : 'dear student'}`,
      subtitle: 'Your personal academic workspace is ready.',
      body: 'Welcome, dear student',
    },
    {
      icon: (
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shadow-2xl">
          <CalendarCheck className="w-10 h-10 sm:w-12 sm:h-12" />
        </div>
      ),
      heading: 'Daily Attendance & Schedule',
      subtitle: 'Real-time classroom monitoring',
      body: 'Want to check your attendance and follow your information?',
    },
    {
      icon: (
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-2xl">
          <Trophy className="w-10 h-10 sm:w-12 sm:h-12" />
        </div>
      ),
      heading: 'Academic Performance',
      subtitle: 'Exams, classwork & merit standings',
      body: 'Hard to track your monthly score?',
    },
    {
      icon: (
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shadow-2xl animate-bounce">
          <Sparkles className="w-10 h-10 sm:w-12 sm:h-12" />
        </div>
      ),
      heading: 'Your Study Companion',
      subtitle: 'Convenient & secure academic access',
      body: "Want an app that's secure and easy to follow all your daily study, in your hand? This app is for you.",
    },
  ];

  const activeSlide = slides[currentSlide];

  return (
    <div
      className="fixed inset-0 z-[200] bg-black text-white flex flex-col items-center justify-between p-6 sm:p-10 select-none overflow-hidden animate-in fade-in duration-300"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-label="Student Onboarding Welcome Intro"
    >
      {/* Top Bar: Skip button */}
      <div className="w-full max-w-lg flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400">Student Intro</span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
        >
          Skip
        </button>
      </div>

      {/* Main Slide Content Area */}
      <div className="w-full max-w-md flex-1 flex flex-col items-center justify-center text-center space-y-6 my-auto px-4">
        {activeSlide.icon}

        <div className="space-y-3">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest block">
            {activeSlide.subtitle}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
            {activeSlide.body}
          </h2>
        </div>

        {/* Final Slide CTA */}
        {currentSlide === 3 && (
          <div className="pt-4 animate-in fade-in slide-in-from-bottom-3 duration-300 w-full">
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 text-slate-950 font-black text-base rounded-2xl shadow-2xl hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Let&apos;s Go!</span>
              <CheckCircle2 className="w-5 h-5 text-slate-950" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom Controls: Navigation Arrows & Slide Dots */}
      <div className="w-full max-w-lg flex items-center justify-between pb-4 gap-4">
        {/* Back Arrow */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentSlide === 0}
          className={`w-10 h-10 rounded-full border border-white/20 flex items-center justify-center transition-all ${
            currentSlide === 0
              ? 'opacity-0 pointer-events-none'
              : 'hover:bg-white/10 text-white cursor-pointer active:scale-90'
          }`}
          title="Previous slide"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* 4 Progress Dots */}
        <div className="flex items-center gap-2">
          {[0, 1, 2, 3].map(idx => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentSlide(idx)}
              className={`transition-all rounded-full cursor-pointer ${
                currentSlide === idx
                  ? 'w-8 h-2.5 bg-emerald-400 shadow-md shadow-emerald-500/50'
                  : 'w-2.5 h-2.5 bg-white/30 hover:bg-white/60'
              }`}
              title={`Go to slide ${idx + 1}`}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>

        {/* Next Arrow / Check */}
        {currentSlide < 3 ? (
          <button
            type="button"
            onClick={handleNext}
            className="w-10 h-10 rounded-full bg-white text-black font-bold flex items-center justify-center hover:bg-emerald-400 hover:text-black transition-all cursor-pointer active:scale-90 shadow-lg"
            title="Next slide"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-10 h-10" />
        )}
      </div>
    </div>
  );
};
