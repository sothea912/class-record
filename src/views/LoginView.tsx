import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GraduationCap,
  ShieldCheck,
  User,
  Lock,
  ArrowRight,
  ArrowLeft,
  Sun,
  Moon,
  AlertCircle,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle2,
  HelpCircle,
  X,
} from 'lucide-react';
import { AppState, AuthUser } from '../types';
import {
  signInTeacherWithGoogle,
  loginTeacherWithPassword,
  linkTeacherPasswordAccount,
  checkTeacherHasPasswordProvider,
  loginStudentDirect,
  ALLOWED_TEACHER_EMAILS,
  fetchAppLogo,
  fetchAppWallpaper,
  subscribeToAppBranding,
} from '../utils/firestoreSync';

interface LoginViewProps {
  state: AppState;
  onLoginSuccess: (user: AuthUser) => void;
  onUpdateTeacherPassword: (newPassword: string, teacherName: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  firestoreStatus?: 'connected' | 'connecting' | 'offline';
}

export const LoginView: React.FC<LoginViewProps> = ({
  state,
  onLoginSuccess,
  onUpdateTeacherPassword,
  isDark,
  onToggleTheme,
  firestoreStatus = 'connected',
}) => {
  const [isLoadingSplash, setIsLoadingSplash] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    // 3.5s loading splash animation
    const startTime = Date.now();
    const duration = 3500;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.round((elapsed / duration) * 100));
      setLoadingProgress(progress);

      if (elapsed >= duration) {
        clearInterval(interval);
        setIsLoadingSplash(false);
      }
    }, 40);

    return () => clearInterval(interval);
  }, []);

  const [selectedRole, setSelectedRole] = useState<'teacher' | 'student' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [appLogo, setAppLogo] = useState<string | null>(null);
  const [appWallpaperDark, setAppWallpaperDark] = useState<string | null>(null);
  const [appWallpaperLight, setAppWallpaperLight] = useState<string | null>(null);
  const [appHeading, setAppHeading] = useState<string | null>(null);
  const [appSubtitle, setAppSubtitle] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAppBranding((branding) => {
      setAppLogo(branding.logo !== undefined ? branding.logo : null);
      setAppWallpaperDark(branding.wallpaperDark !== undefined ? branding.wallpaperDark : null);
      setAppWallpaperLight(branding.wallpaperLight !== undefined ? branding.wallpaperLight : null);
      setAppHeading(branding.heading !== undefined ? branding.heading : null);
      setAppSubtitle(branding.subtitle !== undefined ? branding.subtitle : null);
    });
    return () => unsubscribe();
  }, []);

  // Teacher Form State
  const [teacherEmailOrName, setTeacherEmailOrName] = useState(
    state.profile.name || ALLOWED_TEACHER_EMAILS[0] || 'sotheasoth812@gmail.com'
  );
  const [teacherPassword, setTeacherPassword] = useState('');
  const [showTeacherPassword, setShowTeacherPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Teacher Setup
  const [teacherSetupStep, setTeacherSetupStep] = useState<{
    googleEmail: string;
    uid: string;
    isFirstTime: boolean;
    name: string;
  } | null>(null);
  const [setupName, setSetupName] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
  const [showSetupPassword, setShowSetupPassword] = useState(false);

  // Student Form State
  const [studentIdentifier, setStudentIdentifier] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [showStudentPassword, setShowStudentPassword] = useState(false);

  const handleTeacherPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!teacherEmailOrName.trim() || !teacherPassword.trim()) {
      setErrorMessage('Incorrect email or password');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await loginTeacherWithPassword(teacherEmailOrName.trim(), teacherPassword.trim());
      onLoginSuccess({ role: 'teacher', name: res.name });
    } catch (err: any) {
      setErrorMessage('Incorrect email or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const res = await signInTeacherWithGoogle();
      const hasPassword = checkTeacherHasPasswordProvider();
      const hasExistingProfile = Boolean(state.profile.name && state.profile.name.trim().length > 0);
      if (!hasPassword) {
        setTeacherSetupStep({
          googleEmail: res.email,
          uid: res.uid,
          isFirstTime: !hasExistingProfile,
          name: state.profile.name || res.name || 'Instructor',
        });
        setSetupName(state.profile.name || res.name || 'Instructor');
        setIsSubmitting(false);
        return;
      }
      onLoginSuccess({ role: 'teacher', name: res.name });
    } catch (err: any) {
      setErrorMessage('Google sign-in failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteTeacherSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (setupPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters');
      return;
    }
    if (setupPassword !== setupConfirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }
    setIsSubmitting(true);
    try {
      const finalName = setupName.trim() || teacherSetupStep?.name || 'Instructor';
      await linkTeacherPasswordAccount(setupPassword, finalName);
      onUpdateTeacherPassword(setupPassword, finalName);
      onLoginSuccess({ role: 'teacher', name: finalName });
    } catch (err: any) {
      setErrorMessage('Setup failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!studentIdentifier.trim() || !studentPassword.trim()) {
      setErrorMessage('Incorrect name/ID or password');
      return;
    }
    setIsSubmitting(true);
    try {
      const studentInfo = await loginStudentDirect(studentIdentifier.trim(), studentPassword.trim(), state.students);
      onLoginSuccess({ role: 'student', studentId: studentInfo.studentId, name: studentInfo.name });
    } catch (err: any) {
      setErrorMessage('Incorrect name/ID or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isConnected = firestoreStatus === 'connected';
  const activeWallpaper = isDark ? appWallpaperDark : appWallpaperLight;

  // Track whether this browser has visited before (first load: "Welcome", subsequent: "Welcome back")
  const [isReturningVisitor] = useState<boolean>(() => {
    try {
      const visited = localStorage.getItem('has_visited_before');
      if (visited) {
        return true;
      }
      localStorage.setItem('has_visited_before', 'true');
      return false;
    } catch {
      return false;
    }
  });

  return (
    <div className="relative min-h-screen min-h-[100dvh] flex flex-col text-slate-900 dark:text-white transition-colors p-3 sm:p-6 select-none overflow-hidden">
      {/* Background (Custom Wallpaper/Video if set, black if explicitly removed, default fluid video otherwise) */}
      {activeWallpaper ? (
        activeWallpaper.includes('video') || activeWallpaper.startsWith('data:video') ? (
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 -z-10 w-full h-full object-cover"
            src={activeWallpaper}
          />
        ) : (
          <div
            className="absolute inset-0 -z-10 w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url(${activeWallpaper})` }}
          />
        )
      ) : activeWallpaper === null && activeWallpaper !== undefined ? (
        <div className="absolute inset-0 -z-10 bg-black" />
      ) : activeWallpaper === null ? (
        <div className="absolute inset-0 -z-10 bg-black" />
      ) : (
        <>
          <div className="absolute inset-0 -z-20 bg-gradient-to-br from-blue-600 via-teal-400 to-sky-800 dark:from-[#230940] dark:via-[#16042b] dark:to-[#0c0218] animate-fluid-gradient bg-[length:400%_400%]" />
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 -z-10 w-full h-full object-cover opacity-80 dark:opacity-30"
            src="https://assets.mixkit.co/videos/preview/mixkit-liquid-soap-bubble-surface-abstract-background-42171-large.mp4"
          />
        </>
      )}
      <div className="absolute inset-0 -z-10 bg-black/15 dark:bg-[#130524]/60 backdrop-blur-[1px]" />

      <style>{`
        @keyframes fluidGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-fluid-gradient {
          animation: fluidGradient 15s ease infinite;
        }
      `}</style>

      {/* Initial Loading Splash Screen */}
      <AnimatePresence>
        {isLoadingSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xl text-white p-6"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="flex flex-col items-center space-y-6 max-w-xs w-full text-center"
            >
              {appLogo ? (
                <img src={appLogo} alt="School App Logo" className="w-20 h-20 rounded-2xl object-cover shadow-2xl ring-4 ring-white/20 animate-pulse" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-2xl ring-4 ring-white/20 animate-pulse">
                  <GraduationCap className="w-10 h-10" />
                </div>
              )}
              <div className="space-y-1.5 w-full">
                <h2 className="text-base font-extrabold tracking-tight text-white">{appHeading || 'Class Record & Academic Prep'}</h2>
                <p className="text-xs text-sky-200 font-medium">{appSubtitle || 'Running smooth initializations...'}</p>
              </div>

              {/* Loading Bar */}
              <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden p-0.5 backdrop-blur-md shadow-inner">
                <motion.div
                  className="bg-gradient-to-r from-emerald-400 to-teal-300 h-full rounded-full"
                  style={{ width: `${loadingProgress}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
              <span className="text-[11px] font-mono text-white/70">{loadingProgress}%</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header: Anchors directly to screen edges without any box/background */}
      <header className="login-header w-full flex items-center justify-between gap-4 py-2 sm:py-4 px-2 sm:px-6 relative z-10 transition-all shrink-0">
        {/* Logo/Branding on Left */}
        <div className="flex items-center gap-3">
          {appLogo ? (
            <img src={appLogo} alt="Logo" className="w-10 h-10 rounded-2xl object-cover shadow-sm ring-1 ring-white/30 dark:ring-white/20 shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-[#4BA95F] flex items-center justify-center text-white font-bold text-xs shadow-sm ring-1 ring-white/30 dark:ring-white/20 shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
          )}
          {(appHeading || appSubtitle) && (
            <div className="flex flex-col text-left">
              {appHeading && <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight leading-tight">{appHeading}</span>}
              {appSubtitle && <span className="text-[10px] sm:text-xs text-slate-600 dark:text-white/80 font-medium leading-none mt-0.5">{appSubtitle}</span>}
            </div>
          )}
        </div>

        {/* Controls on Right */}
        <div className="flex items-center gap-3">
          {/* Cloud Connecting Status Dot (Icon-only) */}
          <div className="w-10 h-10 rounded-full border border-white/20 dark:border-white/10 bg-black/20 dark:bg-black/30 backdrop-blur-md flex items-center justify-center shadow-xs shrink-0" title={isConnected ? 'Cloud Connected' : 'Offline'}>
            <span
              className={`w-2 h-2 rounded-full shadow-sm ${isConnected ? 'bg-emerald-400 ring-4 ring-emerald-400/30 animate-pulse' : 'bg-rose-500 ring-4 ring-rose-500/30'}`}
              aria-label={isConnected ? 'Cloud Connected' : 'Offline'}
            />
          </div>

          {/* Light/Dark Mode Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-10 h-10 rounded-full border border-white/20 dark:border-white/10 bg-black/20 dark:bg-black/30 backdrop-blur-md text-white/90 hover:text-white transition-colors cursor-pointer shadow-xs flex items-center justify-center"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-4.5 h-4.5 text-[#FEA339]" /> : <Moon className="w-4.5 h-4.5 text-white/90" />}
          </button>
        </div>
      </header>

      {/* Main Form Container: Centered vertically and horizontally */}
      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-[420px] mx-auto py-4 relative z-10">
        <AnimatePresence mode="wait">
          {selectedRole === null ? (
            /* Role Selection Screen */
            <motion.div
              key="role"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="w-full space-y-4"
            >
              {/* Welcome Line Above the Card */}
              <div className="text-center space-y-1 mb-2">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white drop-shadow-xs">
                  {isReturningVisitor ? 'Welcome back' : 'Welcome'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-white/80 font-medium">
                  Choose how you want to continue
                </p>
              </div>

              {/* Card Container with soft glass look */}
              <div className="w-full bg-white/75 dark:bg-[#160a2c]/75 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-900/5 dark:shadow-2xl space-y-3.5">
                <h2 className="text-base font-extrabold text-center text-slate-900 dark:text-white">
                  Sign in as
                </h2>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => { setSelectedRole('teacher'); setErrorMessage(''); setTeacherSetupStep(null); }}
                    className="group w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-white/80 dark:bg-[#251347]/70 hover:bg-white dark:hover:bg-[#31195d]/85 border border-slate-200/80 dark:border-white/10 hover:border-emerald-400/50 dark:hover:border-emerald-400/40 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] text-left"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* 44px Rounded Icon Badge */}
                      <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                          Teacher
                        </span>
                        <span className="text-[11px] sm:text-xs text-slate-600 dark:text-purple-200/70 font-medium truncate mt-0.5">
                          Manage classes, attendance and scores
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 dark:text-white/60 group-hover:text-slate-800 dark:group-hover:text-white group-hover:translate-x-1 group-active:translate-x-1 transition-all shrink-0 ml-2" />
                  </button>

                  <button
                    type="button"
                    onClick={() => { setSelectedRole('student'); setErrorMessage(''); }}
                    className="group w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-white/80 dark:bg-[#251347]/70 hover:bg-white dark:hover:bg-[#31195d]/85 border border-slate-200/80 dark:border-white/10 hover:border-sky-400/50 dark:hover:border-sky-400/40 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] text-left"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* 44px Rounded Icon Badge */}
                      <div className="w-11 h-11 rounded-2xl bg-sky-500/15 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/20 group-hover:scale-105 transition-transform">
                        <GraduationCap className="w-6 h-6" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                          Student
                        </span>
                        <span className="text-[11px] sm:text-xs text-slate-600 dark:text-purple-200/70 font-medium truncate mt-0.5">
                          View your attendance and results
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 dark:text-white/60 group-hover:text-slate-800 dark:group-hover:text-white group-hover:translate-x-1 group-active:translate-x-1 transition-all shrink-0 ml-2" />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Login Forms */
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="w-full bg-white/80 dark:bg-[#160a2c]/75 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl dark:shadow-2xl space-y-4 relative text-slate-900 dark:text-white"
            >
              {/* Help icon on top right for student */}
              {selectedRole === 'student' && (
                <button
                  type="button"
                  onClick={() => setShowHelpModal(true)}
                  className="absolute right-4 top-4 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-[#251347]/80 dark:hover:bg-[#31195d] text-slate-700 dark:text-white transition-colors cursor-pointer shadow-sm"
                  title="Help"
                >
                  <HelpCircle className="w-4 h-4 text-slate-700 dark:text-white" />
                </button>
              )}

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { setSelectedRole(null); setErrorMessage(''); setTeacherSetupStep(null); }}
                  className="p-1.5 rounded-xl text-slate-800 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-4 h-4 text-slate-800 dark:text-white" />
                </button>
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  {selectedRole === 'teacher' ? 'Teacher' : 'Student'}
                </h2>
                <div className={selectedRole === 'student' ? 'w-6' : 'w-6'} />
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-800 dark:text-rose-100 font-medium text-center backdrop-blur-md">
                  {errorMessage}
                </div>
              )}

              {selectedRole === 'teacher' ? (
                teacherSetupStep ? (
                  <form onSubmit={handleCompleteTeacherSetup} className="space-y-3">
                    <input
                      type="text"
                      required
                      value={setupName}
                      onChange={e => setSetupName(e.target.value)}
                      placeholder="Teacher Name"
                      className="w-full h-11 px-3 bg-white dark:bg-[#0b0318]/70 border border-slate-300 dark:border-white/15 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-purple-200/50 placeholder:italic focus:outline-none focus:border-blue-500 font-medium"
                    />
                    <input
                      type={showSetupPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={setupPassword}
                      onChange={e => setSetupPassword(e.target.value)}
                      placeholder="Password (min 8 chars)"
                      className="w-full h-11 px-3 bg-white dark:bg-[#0b0318]/70 border border-slate-300 dark:border-white/15 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-purple-200/50 placeholder:italic focus:outline-none focus:border-blue-500 font-medium"
                    />
                    <input
                      type={showSetupPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={setupConfirmPassword}
                      onChange={e => setSetupConfirmPassword(e.target.value)}
                      placeholder="Confirm Password"
                      className="w-full h-11 px-3 bg-white dark:bg-[#0b0318]/70 border border-slate-300 dark:border-white/15 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-purple-200/50 placeholder:italic focus:outline-none focus:border-blue-500 font-medium"
                    />
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-11 bg-[#4BA95F] hover:bg-[#3e8f50] text-white font-bold rounded-xl text-xs transition-transform active:scale-95 shadow-lg cursor-pointer"
                    >
                      Complete Setup
                    </button>
                  </form>
                ) : (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isSubmitting}
                      className="w-full h-11 bg-white hover:bg-slate-50 dark:bg-[#251347]/70 dark:hover:bg-[#31195d]/85 border border-slate-200/90 dark:border-white/15 text-slate-800 dark:text-white font-semibold rounded-xl text-xs transition-transform active:scale-95 shadow-md flex items-center justify-center gap-2.5 cursor-pointer backdrop-blur-md"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                      <span>Continue with Google</span>
                    </button>

                    <div className="pt-2 border-t border-slate-200 dark:border-white/10">
                      <form onSubmit={handleTeacherPasswordSubmit} className="space-y-2.5">
                        <input
                          type="text"
                          value={teacherEmailOrName}
                          onChange={e => setTeacherEmailOrName(e.target.value)}
                          placeholder="Name or Email"
                          className="w-full h-10 px-3 bg-white dark:bg-[#0b0318]/70 border border-slate-300 dark:border-white/15 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-purple-200/50 placeholder:italic focus:outline-none focus:border-blue-500 font-medium"
                        />
                        <div className="relative">
                          <input
                            type={showTeacherPassword ? 'text' : 'password'}
                            value={teacherPassword}
                            onChange={e => setTeacherPassword(e.target.value)}
                            placeholder="Password"
                            className="w-full h-10 pl-3 pr-9 bg-white dark:bg-[#0b0318]/70 border border-slate-300 dark:border-white/15 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-purple-200/50 placeholder:italic focus:outline-none focus:border-blue-500 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowTeacherPassword(!showTeacherPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                          >
                            {showTeacherPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full h-10 bg-slate-900 hover:bg-slate-800 dark:bg-purple-600 dark:hover:bg-purple-500 text-white font-semibold rounded-xl text-xs transition-transform active:scale-95 shadow-lg cursor-pointer"
                        >
                          Login
                        </button>
                      </form>
                    </div>
                  </div>
                )
              ) : (
                <form onSubmit={handleStudentSubmit} className="space-y-3">
                  <input
                    type="text"
                    disabled={isSubmitting}
                    value={studentIdentifier}
                    onChange={e => setStudentIdentifier(e.target.value)}
                    placeholder="Name or ID"
                    className="w-full h-11 px-3 bg-white dark:bg-[#0b0318]/70 border border-slate-300 dark:border-white/15 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-purple-200/50 placeholder:italic focus:outline-none focus:border-blue-500 font-medium"
                  />
                  <div className="relative">
                    <input
                      type={showStudentPassword ? 'text' : 'password'}
                      disabled={isSubmitting}
                      value={studentPassword}
                      onChange={e => setStudentPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full h-11 pl-3 pr-10 bg-white dark:bg-[#0b0318]/70 border border-slate-300 dark:border-white/15 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-purple-200/50 placeholder:italic focus:outline-none focus:border-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStudentPassword(!showStudentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      {showStudentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-11 bg-[#4BA95F] hover:bg-[#3e8f50] text-white font-bold rounded-xl text-xs transition-transform active:scale-95 shadow-lg cursor-pointer"
                  >
                    Login
                  </button>
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="max-w-xs w-full bg-slate-900/95 border border-white/25 rounded-3xl p-5 shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-sky-400" />
                <span>Student Login Help</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed font-medium">
              &quot;Don&apos;t know how to login? You must have both the Login Name or your student ID and Student Login Code to login and use your app, if you have questions contact your Homeroom Teacher.&quot;
            </p>
            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="w-full h-10 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl text-xs transition-transform active:scale-95 shadow-md cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full text-center py-2 text-[10px] text-slate-700/80 dark:text-white/70 font-mono relative z-10 shrink-0">
        UI Build V.0.1.0.026
      </footer>
    </div>
  );
};
