import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Gamepad2,
  Clock,
  CheckCircle2,
  XCircle,
  Volume2,
  VolumeX,
  Sparkles,
  Award,
  AlertTriangle,
  RotateCcw,
  Check,
  Flame,
  ArrowRight,
  ShieldAlert,
  Loader2,
  User,
  Radio,
  Trophy,
} from 'lucide-react';
import {
  CohostSession,
  CohostPlayer,
  StudentItem,
} from '../types';
import {
  subscribeToCohostSession,
  subscribeToCohostPlayers,
  syncJoinCohostSession,
  syncSubmitCohostAnswer,
  subscribeToActiveLiveGameForClasses,
} from '../utils/cohostSync';
import { cohostAudio } from '../utils/cohostAudio';
import { COHOST_OPTIONS, CohostShapeIcon } from '../components/CohostOptionShape';

interface StudentCohostViewProps {
  student?: StudentItem;
  enrolledClassIds?: string[];
  initialPin?: string;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onExit?: () => void;
  isGuestMode?: boolean;
}

export const StudentCohostView: React.FC<StudentCohostViewProps> = ({
  student,
  enrolledClassIds = [],
  initialPin = '',
  onShowToast,
  onExit,
  isGuestMode = false,
}) => {
  // Session join inputs
  const [pinInput, setPinInput] = useState(initialPin);
  const [nicknameInput, setNicknameInput] = useState(student?.name || '');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Active game session state
  const [joinedPin, setJoinedPin] = useState<string | null>(null);
  const [session, setSession] = useState<CohostSession | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [players, setPlayers] = useState<CohostPlayer[]>([]);

  // Selected answer for current question
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Active class live games found (for enrolled students)
  const [availableClassSessions, setAvailableClassSessions] = useState<CohostSession[]>([]);

  // Audio mute & volume
  const [isMuted, setIsMuted] = useState<boolean>(() => cohostAudio.getMuted());
  const [volume, setVolume] = useState<number>(() => cohostAudio.getVolume());

  // Connection health indicator & error message
  const [isConnected, setIsConnected] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Timer countdown on phone
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const timerRef = useRef<any>(null);

  // 1. Subscribe to active games for student's classes
  useEffect(() => {
    if (!student || enrolledClassIds.length === 0) return;
    const unsub = subscribeToActiveLiveGameForClasses(enrolledClassIds, sessions => {
      setAvailableClassSessions(sessions);
    });
    return () => unsub();
  }, [student, enrolledClassIds]);

  // 2. Pre-fill PIN if initialPin was passed in URL
  useEffect(() => {
    if (initialPin && initialPin.length === 6) {
      setPinInput(initialPin);
    }
  }, [initialPin]);

  // Keep nickname synced if student profile loads
  useEffect(() => {
    if (student?.name && !nicknameInput) {
      setNicknameInput(student.name);
    }
  }, [student?.name]);

  // 3. Subscribe to session once joined
  useEffect(() => {
    if (!joinedPin) {
      setSession(null);
      setPlayers([]);
      setSelectedOption(null);
      setConnectionError(null);
      return;
    }

    const unsubSession = subscribeToCohostSession(
      joinedPin,
      s => {
        setIsConnected(true);
        setConnectionError(null);
        setSession(s);
        if (!s) {
          setJoinError('The game session was ended or is no longer available.');
          setJoinedPin(null);
          cohostAudio.stopMusic();
        }
      },
      err => {
        console.warn('[StudentCohostView] Session error:', err);
        setIsConnected(false);
        setConnectionError(err.message || 'Connection lost. Reconnecting to game...');
      }
    );

    const unsubPlayers = subscribeToCohostPlayers(joinedPin, p => {
      setPlayers(p);
    });

    return () => {
      unsubSession();
      unsubPlayers();
    };
  }, [joinedPin]);

  // 4. Reset selectedOption when question index changes
  useEffect(() => {
    setSelectedOption(null);
    setSubmitError(null);
  }, [session?.currentQuestionIndex]);

  // 5. Sound & Countdown timer
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (session?.state === 'question' && session.currentQuestion) {
      const limit = session.timeLimitSeconds || 20;
      const startTime = session.questionStartTime || Date.now();
      const mood = session.currentQuestion.musicMood || 'Chill';

      cohostAudio.playMoodMusic(mood);

      const updateCountdown = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const remain = Math.max(0, Math.ceil(limit - elapsed));
        setTimeLeft(remain);

        if (remain <= 5 && remain > 0) {
          cohostAudio.playTick(true);
        }
      };

      updateCountdown();
      timerRef.current = setInterval(updateCountdown, 1000);
    } else if (session?.state === 'lobby') {
      cohostAudio.playMoodMusic('Party');
    } else if (session?.state === 'podium') {
      cohostAudio.stopMusic();
      cohostAudio.playPodiumFanfare();
    } else {
      cohostAudio.stopMusic();
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [session?.state, session?.currentQuestionIndex, session?.questionStartTime]);

  // Sound toggles
  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    cohostAudio.setMuted(next);
  };

  const handleChangeVolume = (v: number) => {
    setVolume(v);
    cohostAudio.setVolume(v);
    if (isMuted && v > 0) {
      setIsMuted(false);
      cohostAudio.setMuted(false);
    }
  };

  // Find my player object
  const myPlayer = useMemo(() => {
    if (!myPlayerId) return null;
    return players.find(p => p.id === myPlayerId) || null;
  }, [players, myPlayerId]);

  // Handle Joining
  const handleJoin = async (pinToJoin?: string) => {
    const pin = (pinToJoin || pinInput).trim();
    if (pin.length !== 6) {
      setJoinError('Please enter a valid 6-digit PIN.');
      return;
    }
    if (!nicknameInput.trim()) {
      setJoinError('Please enter your nickname.');
      return;
    }

    setJoinError(null);
    setIsJoining(true);

    try {
      // Tap Join starts the Web Audio engine
      cohostAudio.unlockAudio();

      const result = await syncJoinCohostSession(pin, nicknameInput, {
        studentId: student?.id,
        realName: student?.name,
        isGuest: !student || isGuestMode,
      });

      if (!result.success) {
        setJoinError(result.error || 'Failed to join game.');
        setIsJoining(false);
        return;
      }

      setMyPlayerId(result.playerId || null);
      setJoinedPin(pin);
      cohostAudio.playJoin();
      onShowToast(`Joined game as ${nicknameInput}!`, 'success');
    } catch (err: any) {
      setJoinError(err.message || 'Error connecting to game.');
    } finally {
      setIsJoining(false);
    }
  };

  // Handle Submitting Answer
  const handleSelectOption = async (optionIdx: number) => {
    if (selectedOption !== null || isSubmittingAnswer || !session || !myPlayerId) return;
    if (session.state !== 'question') return;

    setSelectedOption(optionIdx);
    setIsSubmittingAnswer(true);
    setSubmitError(null);

    try {
      cohostAudio.playLockAnswer();
      const res = await syncSubmitCohostAnswer(session.pin, session.currentQuestionIndex, myPlayerId, optionIdx);
      if (!res.success) {
        setSubmitError(res.error || 'Could not record answer');
        onShowToast('Could not record answer: ' + (res.error || 'Unknown error'), 'error');
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to lock in answer');
      onShowToast('Failed to lock in answer: ' + err.message, 'error');
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  // Podium calculations (top 3)
  const topThree = useMemo(() => {
    if (!players || players.length === 0) return [];
    const sorted = [...players].sort((a, b) => b.score - a.score || b.streak - a.streak);
    return sorted.slice(0, 3);
  }, [players]);

  return (
    <div className="max-w-md mx-auto w-full min-h-[85vh] flex flex-col justify-between p-3 sm:p-4 select-none pb-24">
      {/* Top Header / Audio controls */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
            <Gamepad2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-black text-slate-900 dark:text-white block leading-tight">
              Cohost Live
            </span>
            <span className="text-[10px] text-slate-400">
              {joinedPin ? `PIN: ${joinedPin}` : isGuestMode ? 'Guest Mode' : student?.name}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mute button */}
          <button
            type="button"
            onClick={handleToggleMute}
            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-purple-600 transition-colors cursor-pointer"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-emerald-500" />}
          </button>

          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white px-2 py-1 rounded-lg cursor-pointer"
            >
              Exit
            </button>
          )}
        </div>
      </div>

      {/* Disconnection Warning & Auto-reconnect message */}
      {!isConnected && (
        <div className="mt-2 p-2.5 rounded-2xl bg-rose-500 text-white text-xs font-bold flex items-center justify-between gap-2 shadow-md animate-pulse">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="truncate">{connectionError || 'Connection dropped. Reconnecting automatically...'}</span>
          </div>
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        </div>
      )}

      {/* =================================================================== */}
      {/* 1. SCREEN: JOIN LOBBY (PIN / NICKNAME) */}
      {/* =================================================================== */}
      {!joinedPin && (
        <div className="my-auto space-y-6 py-4">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Join Cohost Game
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isGuestMode || !student
                ? 'Guest mode: your score will not be saved.'
                : 'Enter game PIN or tap your active class game below.'}
            </p>
          </div>

          {/* Active Live Game Found for Student's Class */}
          {!isGuestMode && student && (
            availableClassSessions.length > 0 ? (
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 block px-1 flex items-center gap-1.5">
                  <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                  <span>Live Now for Your Class:</span>
                </span>
                {availableClassSessions.map(cs => (
                  <button
                    key={cs.pin}
                    type="button"
                    onClick={() => {
                      setPinInput(cs.pin);
                      handleJoin(cs.pin);
                    }}
                    className="w-full p-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white text-left shadow-lg shadow-purple-600/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-black block truncate">{cs.title}</span>
                      <span className="text-[10px] text-purple-200">
                        PIN: {cs.pin} · Status: <span className="uppercase font-bold">{cs.state}</span>
                      </span>
                    </div>
                    <span className="px-3 py-1 rounded-xl bg-white/20 text-xs font-black flex items-center gap-1 shrink-0">
                      <span>Join</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 text-center space-y-1">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  No live game right now
                </p>
                <p className="text-[11px] text-slate-400">
                  When your teacher starts a live quiz game, it will appear here automatically.
                </p>
              </div>
            )
          )}

          {/* Manual PIN and Nickname form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Game PIN</label>
              <input
                type="text"
                pattern="[0-9]*"
                maxLength={6}
                value={pinInput}
                onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit PIN"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-center text-2xl font-black font-mono tracking-widest text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Nickname <span className="text-[10px] font-normal text-slate-400">(2-20 characters)</span>
              </label>
              <input
                type="text"
                maxLength={20}
                value={nicknameInput}
                onChange={e => setNicknameInput(e.target.value)}
                placeholder="Enter game nickname"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              {student && (
                <p className="text-[10px] text-slate-400 italic">
                  Note: The teacher will always see your real name ({student.name}).
                </p>
              )}
            </div>

            {joinError && (
              <div className="text-xs text-rose-500 font-bold bg-rose-50 dark:bg-rose-950/40 p-3 rounded-2xl border border-rose-200 dark:border-rose-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{joinError}</span>
              </div>
            )}

            <button
              type="button"
              disabled={isJoining}
              onClick={() => handleJoin()}
              className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-sm font-black shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <span>Join Game</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. SCREEN: LOBBY ("You're in! Waiting for the teacher") */}
      {/* =================================================================== */}
      {joinedPin && session?.state === 'lobby' && (
        <div className="my-auto text-center space-y-6 py-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-500 flex items-center justify-center animate-bounce shadow-xl">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">You're in!</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Waiting for the teacher to start the game...
            </p>
            <div className="pt-2">
              <span className="px-4 py-1.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-black text-base inline-block">
                {nicknameInput}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <p className="font-semibold">Game Title: <strong>{session.title}</strong></p>
            <p className="text-[10px] text-slate-400">Keep this screen open. Get ready to tap fast for extra points!</p>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. SCREEN: QUESTION (4 BIG BUTTONS, SHAPES, COUNTDOWN) */}
      {/* =================================================================== */}
      {joinedPin && session?.state === 'question' && session.currentQuestion && (
        <div className="flex-1 flex flex-col justify-between py-2 space-y-3">
          {/* Top Timer Bar & Question indicator */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>Question {session.currentQuestionIndex + 1} of {session.totalQuestions}</span>
              <span className="font-mono text-purple-600 dark:text-purple-400 font-black">
                {timeLeft}s
              </span>
            </div>

            {/* Visual countdown progress bar */}
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ${
                  timeLeft <= 5 ? 'bg-rose-500 animate-pulse' : 'bg-purple-600'
                }`}
                style={{ width: `${Math.min(100, (timeLeft / (session.timeLimitSeconds || 20)) * 100)}%` }}
              />
            </div>
          </div>

          {/* Question text & optional image */}
          <div className="text-center space-y-2 py-1">
            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white line-clamp-3">
              {session.currentQuestion.text}
            </h3>
            {session.currentQuestion.image && (
              <div className="max-h-36 max-w-xs mx-auto rounded-xl overflow-hidden bg-slate-950">
                <img
                  src={session.currentQuestion.image}
                  alt="Question"
                  className="w-full h-full object-contain"
                />
              </div>
            )}
          </div>

          {/* Submission error message if failed */}
          {submitError && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 font-bold text-center">
              {submitError}
            </div>
          )}

          {/* If answer is locked in */}
          {selectedOption !== null ? (
            <div className="my-auto py-8 text-center space-y-3 bg-purple-50 dark:bg-purple-950/40 rounded-3xl border border-purple-200 dark:border-purple-800 p-6">
              <div className="w-14 h-14 mx-auto rounded-full bg-purple-600 text-white flex items-center justify-center shadow-md">
                <Check className="w-7 h-7" />
              </div>
              <h4 className="text-base font-black text-purple-900 dark:text-purple-100">
                Answer locked in, waiting...
              </h4>
              <p className="text-xs text-purple-700 dark:text-purple-300">
                Hang tight while others answer and the timer ends!
              </p>
            </div>
          ) : (
            /* BUTTONS WITH SHAPES (NO SCROLLING): 2 for True/False, 4 for Multi */
            <div
              className={`grid ${
                session.currentQuestion.options.length <= 2 ? 'grid-cols-2' : 'grid-cols-2'
              } gap-2.5 sm:gap-3 flex-1 min-h-[220px]`}
            >
              {session.currentQuestion.options.map((optText, optIdx) => {
                const style = COHOST_OPTIONS[optIdx] || COHOST_OPTIONS[0];
                return (
                  <button
                    key={optIdx}
                    type="button"
                    disabled={isSubmittingAnswer || selectedOption !== null}
                    onClick={() => handleSelectOption(optIdx)}
                    className={`w-full h-full min-h-[90px] rounded-2xl ${style.bgClass} ${style.hoverClass} ${style.activeClass} text-white p-3 flex flex-col items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer`}
                  >
                    <CohostShapeIcon index={optIdx} className="w-8 h-8 text-white drop-shadow-sm" />
                    <span className="text-xs sm:text-sm font-black line-clamp-2 text-center">
                      {optText}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. SCREEN: REVEAL (CORRECT / WRONG / POINTS / RANK) */}
      {/* =================================================================== */}
      {joinedPin && session?.state === 'reveal' && session.currentQuestion && (
        <div className="my-auto py-6 text-center space-y-5">
          {myPlayer?.lastAnswerCorrect ? (
            <div className="space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-500 flex items-center justify-center shadow-lg animate-bounce">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  Correct!
                </h3>
                <span className="text-lg font-mono font-black text-slate-800 dark:text-white block">
                  +{myPlayer.lastPointsEarned || 0} pts
                </span>
                {myPlayer.streak >= 3 && (
                  <span className="text-xs font-bold text-amber-500 flex items-center justify-center gap-1">
                    <Flame className="w-4 h-4 fill-current" />
                    <span>Answer Streak: {myPlayer.streak}!</span>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center shadow-lg">
                <XCircle className="w-9 h-9" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400">
                  Wrong
                </h3>
                <span className="text-xs text-slate-400">Better luck on the next question!</span>
              </div>
            </div>
          )}

          {/* Explanation if host provided */}
          {session.explanation && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 text-left">
              <strong className="block text-purple-600 dark:text-purple-400 mb-0.5">Explanation:</strong>
              {session.explanation}
            </div>
          )}

          {/* Score & Rank */}
          <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center justify-around">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Score</span>
              <span className="text-base font-black font-mono text-purple-600 dark:text-purple-400 block">
                {myPlayer?.score || 0} pts
              </span>
            </div>
            {myPlayer?.rank && (
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Current Rank</span>
                <span className="text-base font-black font-mono text-slate-800 dark:text-white block">
                  #{myPlayer.rank}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 5. SCREEN: LEADERBOARD WAIT */}
      {/* =================================================================== */}
      {joinedPin && session?.state === 'leaderboard' && (
        <div className="my-auto py-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center shadow-md animate-pulse">
            <Award className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white">
            Leaderboard on Screen!
          </h3>
          <p className="text-xs text-slate-400">
            Look up at the teacher's screen to see the top standings.
          </p>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 max-w-xs mx-auto space-y-1">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Your Score</span>
            <span className="text-xl font-black font-mono text-purple-600 dark:text-purple-400 block">
              {myPlayer?.score || 0} pts
            </span>
            {myPlayer?.rank && (
              <span className="text-xs text-slate-400 block">Current Rank: #{myPlayer.rank}</span>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 6. SCREEN: PODIUM / GAME FINISHED (FINAL RANK, TOTAL POINTS, PODIUM) */}
      {/* =================================================================== */}
      {joinedPin && session?.state === 'podium' && (
        <div className="my-auto py-6 text-center space-y-5">
          <Sparkles className="w-10 h-10 text-amber-400 mx-auto animate-bounce" />
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Game Finished!</h2>

          {/* Student's Final Result */}
          <div className="p-5 rounded-3xl bg-gradient-to-tr from-purple-900 to-indigo-900 text-white space-y-2 shadow-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
              Your Standing
            </span>
            <div className="text-4xl font-black font-mono">
              #{myPlayer?.rank || '-'}
            </div>
            <div className="text-sm font-bold text-purple-200">
              Total Points: {myPlayer?.score || 0} pts
            </div>
          </div>

          {/* Podium for Top 3 */}
          {topThree.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Top 3 Podium
              </span>
              <div className="grid grid-cols-3 gap-2 items-end pt-2">
                {/* 2nd Place */}
                {topThree[1] ? (
                  <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1 flex flex-col items-center">
                    <span className="text-base">🥈</span>
                    <span className="text-xs font-black truncate max-w-full text-slate-800 dark:text-white">
                      {topThree[1].nickname}
                    </span>
                    <span className="text-[10px] font-mono text-purple-600 font-bold">
                      {topThree[1].score} pts
                    </span>
                  </div>
                ) : <div />}

                {/* 1st Place */}
                {topThree[0] ? (
                  <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 space-y-1 flex flex-col items-center shadow-lg -translate-y-2">
                    <span className="text-2xl">👑</span>
                    <span className="text-xs font-black truncate max-w-full text-amber-900 dark:text-amber-200">
                      {topThree[0].nickname}
                    </span>
                    <span className="text-[11px] font-mono text-amber-600 font-black">
                      {topThree[0].score} pts
                    </span>
                  </div>
                ) : <div />}

                {/* 3rd Place */}
                {topThree[2] ? (
                  <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1 flex flex-col items-center">
                    <span className="text-base">🥉</span>
                    <span className="text-xs font-black truncate max-w-full text-slate-800 dark:text-white">
                      {topThree[2].nickname}
                    </span>
                    <span className="text-[10px] font-mono text-purple-600 font-bold">
                      {topThree[2].score} pts
                    </span>
                  </div>
                ) : <div />}
              </div>
            </div>
          )}

          <p className="text-xs text-slate-400">
            Thanks for playing Cohost Live!
          </p>
        </div>
      )}
    </div>
  );
};
