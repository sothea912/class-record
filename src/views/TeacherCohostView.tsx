import React, { useState, useEffect, useMemo, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Gamepad2,
  Plus,
  Play,
  Copy,
  Trash2,
  Edit,
  Users,
  Clock,
  Music,
  CheckCircle2,
  Sparkles,
  Award,
  AlertTriangle,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
  ChevronRight,
  Flame,
  UserCheck,
  UserX,
  ExternalLink,
  Shield,
  HelpCircle,
  Share2,
  Upload,
  ArrowRight,
  Save,
  Check,
} from 'lucide-react';
import {
  AppState,
  CohostGame,
  CohostQuestion,
  CohostSession,
  CohostPlayer,
  CohostAnswer,
  CohostMusicMood,
  CohostPointsMultiplier,
  CohostQuestionType,
} from '../types';
import {
  syncFetchCohostGames,
  syncSaveCohostGame,
  syncDeleteCohostGame,
  syncCreateCohostSession,
  subscribeToCohostSession,
  subscribeToCohostPlayers,
  subscribeToCohostAnswers,
  syncTeacherLockAndScoreQuestion,
  syncTeacherShowLeaderboard,
  syncTeacherNextQuestion,
  syncTeacherShowPodium,
  syncTeacherSaveResults,
  syncTeacherEndGame,
  syncTeacherUpdatePause,
  syncRemoveCohostPlayer,
  compressCohostImage,
  syncFetchCohostGameKeys,
} from '../utils/cohostSync';
import { cohostAudio } from '../utils/cohostAudio';
import { COHOST_OPTIONS, CohostShapeIcon } from '../components/CohostOptionShape';
import { Modal } from '../components/Modal';
import { uid } from '../utils/helpers';

interface TeacherCohostViewProps {
  state: AppState;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  authUserUid: string;
}

export const TeacherCohostView: React.FC<TeacherCohostViewProps> = ({
  state,
  onShowToast,
  authUserUid,
}) => {
  // Navigation Tabs: Library vs Active Session
  const [activeTab, setActiveTab] = useState<'library' | 'session'>('library');

  // Games list from Firestore
  const [games, setGames] = useState<CohostGame[]>([]);
  const [isLoadingGames, setIsLoadingGames] = useState(true);
  const [loadError, setLoadError] = useState<{ code?: string; message: string } | null>(null);

  // Active Session state
  const [activePin, setActivePin] = useState<string | null>(() => {
    try {
      return localStorage.getItem('cohost_active_pin');
    } catch {
      return null;
    }
  });
  const [session, setSession] = useState<CohostSession | null>(null);
  const [players, setPlayers] = useState<CohostPlayer[]>([]);
  const [answers, setAnswers] = useState<CohostAnswer[]>([]);
  const [secretKeys, setSecretKeys] = useState<Record<string, number>>({});
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Audio mute & volume state
  const [isMuted, setIsMuted] = useState<boolean>(() => cohostAudio.getMuted());
  const [volume, setVolume] = useState<number>(() => cohostAudio.getVolume());

  // Countdown timer for question
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const timerRef = useRef<any>(null);

  // Modal: Create/Edit Game
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [gameName, setGameName] = useState('');
  const [gameClassIds, setGameClassIds] = useState<string[]>([]);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [streakBonus, setStreakBonus] = useState(true);
  const [editorQuestions, setEditorQuestions] = useState<CohostQuestion[]>([]);
  const [editorAnswers, setEditorAnswers] = useState<Record<string, number>>({});

  // Question editing sub-panel
  const [activeQIndex, setActiveQIndex] = useState(0);

  // Modal: Delete confirmation
  const [deleteConfirmGame, setDeleteConfirmGame] = useState<CohostGame | null>(null);

  // Modal: End Game confirmation
  const [isEndGameModalOpen, setIsEndGameModalOpen] = useState(false);

  // Results saved state flag
  const [isResultsSaved, setIsResultsSaved] = useState(false);

  // 1. Load games on mount
  const loadGames = async () => {
    setIsLoadingGames(true);
    setLoadError(null);
    try {
      const list = await syncFetchCohostGames();
      setGames(list);
    } catch (err: any) {
      console.warn('Failed to load Cohost games:', err);
      const errorCode = err?.code || 'unknown';
      const errorMessage = err?.message || String(err);
      setLoadError({ code: errorCode, message: errorMessage });
      onShowToast(`Firestore read error (${errorCode}): ${errorMessage}`, 'error');
    } finally {
      setIsLoadingGames(false);
    }
  };

  useEffect(() => {
    loadGames();
  }, []);

  // 2. Subscribe to active session if PIN exists
  useEffect(() => {
    if (!activePin) {
      setSession(null);
      setPlayers([]);
      setAnswers([]);
      return;
    }

    const unsubSession = subscribeToCohostSession(activePin, s => {
      setSession(s);
      if (s) {
        if (s.state === 'ended') {
          setActivePin(null);
          localStorage.removeItem('cohost_active_pin');
          setActiveTab('library');
          cohostAudio.stopMusic();
        }
      }
    });

    const unsubPlayers = subscribeToCohostPlayers(activePin, p => {
      setPlayers(p);
    });

    const unsubAnswers = subscribeToCohostAnswers(activePin, a => {
      setAnswers(a);
    });

    return () => {
      unsubSession();
      unsubPlayers();
      unsubAnswers();
    };
  }, [activePin]);

  // Generate QR Code whenever PIN or origin changes
  useEffect(() => {
    if (activePin) {
      const joinUrl = `${window.location.origin}/?join=${activePin}`;
      QRCode.toDataURL(joinUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('QR code error:', err));
    }
  }, [activePin]);

  // Tab visibility / pause detection
  useEffect(() => {
    const handleVisibility = () => {
      if (!activePin) return;
      if (document.hidden) {
        syncTeacherUpdatePause(activePin, true);
        cohostAudio.stopMusic();
      } else {
        syncTeacherUpdatePause(activePin, false);
        if (session?.currentQuestion?.musicMood) {
          cohostAudio.playMoodMusic(session.currentQuestion.musicMood);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [activePin, session?.currentQuestion?.musicMood]);

  // Question timer logic in teacher's browser
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
        } else if (remain > 5 && remain % 2 === 0) {
          cohostAudio.playTick(false);
        }

        // Check if all players answered
        const currentQAnswers = answers.filter(a => a.questionIndex === session.currentQuestionIndex);
        const allAnswered = players.length > 0 && currentQAnswers.length >= players.length;

        if (remain <= 0 || allAnswered) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          handleLockAndReveal();
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
  }, [session?.state, session?.currentQuestionIndex, session?.questionStartTime, answers.length, players.length]);

  // Audio settings handlers
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

  // ==========================================
  // HOSTING CONTROLS
  // ==========================================

  // Start Lobby for a Game
  const handleStartLobby = async (game: CohostGame) => {
    if (!game.questions || game.questions.length === 0) {
      onShowToast('This game has no questions. Please add questions first.', 'error');
      return;
    }

    try {
      cohostAudio.unlockAudio();
      const { pin, secretKeys: keys } = await syncCreateCohostSession(game, false, authUserUid);
      setActivePin(pin);
      setSecretKeys(keys);
      localStorage.setItem('cohost_active_pin', pin);
      setActiveTab('session');
      setIsResultsSaved(false);
      onShowToast(`Lobby started! PIN: ${pin}`, 'success');
    } catch (err: any) {
      console.error('Failed to create session:', err);
      onShowToast('Failed to start lobby: ' + err.message, 'error');
    }
  };

  // Toggle Guest switch in Lobby
  const handleToggleAllowGuests = async () => {
    if (!session) return;
    try {
      const next = !session.allowGuests;
      // We will update the session doc
      setSession(prev => prev ? { ...prev, allowGuests: next } : null);
      const { updateDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../utils/firebase');
      await updateDoc(doc(db, 'cohost_sessions', session.pin), {
        allowGuests: next,
      });
      onShowToast(next ? 'Guest players enabled' : 'Guest players disabled', 'info');
    } catch (err: any) {
      onShowToast('Failed to toggle guests: ' + err.message, 'error');
    }
  };

  // Kick / Remove player
  const handleKickPlayer = async (playerId: string, nickname: string) => {
    if (!session) return;
    try {
      await syncRemoveCohostPlayer(session.pin, playerId);
      onShowToast(`Removed ${nickname} from game`, 'info');
    } catch (err: any) {
      onShowToast('Failed to remove player: ' + err.message, 'error');
    }
  };

  // Start Game from Lobby
  const handleStartGame = async () => {
    if (!session || !session.currentQuestion) return;
    cohostAudio.unlockAudio();
    try {
      await syncTeacherNextQuestion(session.pin, 0, session.currentQuestion);
      onShowToast('Game started! First question is live.', 'success');
    } catch (err: any) {
      onShowToast('Failed to start game: ' + err.message, 'error');
    }
  };

  // Lock and Reveal Answer
  const handleLockAndReveal = async () => {
    if (!session || !session.currentQuestion) return;
    try {
      // Find secret answer for current question
      let correctIdx = secretKeys[session.currentQuestion.id];
      if (correctIdx === undefined) {
        // Fetch from session keys subcollection
        const { getDoc, doc } = await import('firebase/firestore');
        const { db } = await import('../utils/firebase');
        const secretSnap = await getDoc(doc(db, 'cohost_sessions', session.pin, 'keys', 'secret'));
        if (secretSnap.exists()) {
          const sData = secretSnap.data();
          correctIdx = sData?.answers?.[session.currentQuestion.id] ?? 0;
          setSecretKeys(sData?.answers || {});
        } else {
          correctIdx = 0;
        }
      }

      cohostAudio.playReveal();
      await syncTeacherLockAndScoreQuestion(session, correctIdx, answers, players);
    } catch (err: any) {
      console.error('Failed to lock and score question:', err);
      onShowToast('Error calculating scores: ' + err.message, 'error');
    }
  };

  // Advance to Leaderboard
  const handleShowLeaderboard = async () => {
    if (!session) return;
    try {
      await syncTeacherShowLeaderboard(session.pin);
    } catch (err: any) {
      onShowToast('Failed to show leaderboard: ' + err.message, 'error');
    }
  };

  // Advance to Next Question or Podium
  const handleAdvanceNext = async () => {
    if (!session) return;
    const nextIdx = session.currentQuestionIndex + 1;

    // Check if that was the last question
    if (nextIdx >= session.totalQuestions) {
      // Show podium
      await syncTeacherShowPodium(session.pin, players);
      return;
    }

    // Find the next question from game template
    const currentGame = games.find(g => g.id === session.gameId);
    let nextQuestion = currentGame?.questions?.[nextIdx];
    if (!nextQuestion) {
      // Fallback: fetch game
      nextQuestion = session.currentQuestion; // fallback
    }

    if (nextQuestion) {
      await syncTeacherNextQuestion(session.pin, nextIdx, nextQuestion);
    }
  };

  // Save Results (enrolled students only)
  const handleSaveResults = async () => {
    if (!session) return;
    try {
      await syncTeacherSaveResults(session, players);
      setIsResultsSaved(true);
      onShowToast('Results saved successfully for enrolled students!', 'success');
    } catch (err: any) {
      onShowToast('Failed to save results: ' + err.message, 'error');
    }
  };

  // End Game (Clean up all guest player and answer documents)
  const handleConfirmEndGame = async () => {
    if (!session) return;
    try {
      await syncTeacherEndGame(session.pin);
      cohostAudio.stopMusic();
      setActivePin(null);
      localStorage.removeItem('cohost_active_pin');
      setIsEndGameModalOpen(false);
      setActiveTab('library');
      onShowToast('Game ended. Guest data has been cleared.', 'info');
    } catch (err: any) {
      onShowToast('Failed to end game: ' + err.message, 'error');
    }
  };

  // ==========================================
  // GAME EDITOR CONTROLS
  // ==========================================

  const handleOpenCreateModal = () => {
    setEditingGameId(null);
    setGameName('');
    setGameClassIds(state.classes.map(c => c.id));
    setShuffleQuestions(false);
    setStreakBonus(true);

    const defaultQ: CohostQuestion = {
      id: uid('cq'),
      text: 'What is the capital of France?',
      type: 'multi',
      options: ['Paris', 'London', 'Berlin', 'Madrid'],
      time: 20,
      points: 'standard',
      musicMood: 'Party',
      explanation: 'Paris has been the capital of France since 508 AD.',
    };
    setEditorQuestions([defaultQ]);
    setEditorAnswers({ [defaultQ.id]: 0 });
    setActiveQIndex(0);
    setIsEditorOpen(true);
  };

  const handleOpenEditModal = async (game: CohostGame) => {
    setEditingGameId(game.id);
    setGameName(game.name);
    setGameClassIds(game.classIds || []);
    setShuffleQuestions(game.shuffleQuestions || false);
    setStreakBonus(game.streakBonus ?? true);
    setEditorQuestions([...game.questions]);

    // Fetch secret answers
    const storedKeys = await syncFetchCohostGameKeys(game.id);
    setEditorAnswers(storedKeys || {});
    setActiveQIndex(0);
    setIsEditorOpen(true);
  };

  const handleDuplicateGame = async (game: CohostGame) => {
    try {
      const storedKeys = await syncFetchCohostGameKeys(game.id);
      const newGameId = uid('chg');
      const duplicatedGame: CohostGame = {
        ...game,
        id: newGameId,
        name: `${game.name} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await syncSaveCohostGame(duplicatedGame, storedKeys || {});
      await loadGames();
      onShowToast('Game duplicated successfully', 'success');
    } catch (err: any) {
      onShowToast('Failed to duplicate game: ' + err.message, 'error');
    }
  };

  const handleDeleteGame = async () => {
    if (!deleteConfirmGame) return;
    try {
      await syncDeleteCohostGame(deleteConfirmGame.id);
      setDeleteConfirmGame(null);
      await loadGames();
      onShowToast('Game deleted', 'info');
    } catch (err: any) {
      onShowToast('Failed to delete game: ' + err.message, 'error');
    }
  };

  const handleSaveGameFromEditor = async () => {
    if (!gameName.trim()) {
      onShowToast('Please enter a game name', 'error');
      return;
    }
    if (editorQuestions.length === 0) {
      onShowToast('Please add at least one question', 'error');
      return;
    }

    const gameId = editingGameId || uid('chg');
    const newGame: CohostGame = {
      id: gameId,
      name: gameName.trim(),
      classIds: gameClassIds,
      shuffleQuestions,
      streakBonus,
      questionsCount: editorQuestions.length,
      questions: editorQuestions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await syncSaveCohostGame(newGame, editorAnswers);
      setIsEditorOpen(false);
      await loadGames();
      onShowToast(editingGameId ? 'Game updated' : 'Game created successfully', 'success');
    } catch (err: any) {
      onShowToast('Failed to save game: ' + err.message, 'error');
    }
  };

  // Add question to editor
  const handleAddQuestion = () => {
    const newQ: CohostQuestion = {
      id: uid('cq'),
      text: `Question ${editorQuestions.length + 1}`,
      type: 'multi',
      options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
      time: 20,
      points: 'standard',
      musicMood: 'Party',
    };
    setEditorQuestions(prev => [...prev, newQ]);
    setEditorAnswers(prev => ({ ...prev, [newQ.id]: 0 }));
    setActiveQIndex(editorQuestions.length);
  };

  const handleRemoveQuestion = (idx: number) => {
    if (editorQuestions.length <= 1) {
      onShowToast('Game must have at least one question', 'error');
      return;
    }
    const qToRemove = editorQuestions[idx];
    const updated = editorQuestions.filter((_, i) => i !== idx);
    setEditorQuestions(updated);
    setEditorAnswers(prev => {
      const next = { ...prev };
      delete next[qToRemove.id];
      return next;
    });
    setActiveQIndex(Math.max(0, idx - 1));
  };

  const handleUploadQuestionImage = async (file: File) => {
    try {
      const dataUrl = await compressCohostImage(file);
      setEditorQuestions(prev => {
        const next = [...prev];
        next[activeQIndex] = { ...next[activeQIndex], image: dataUrl };
        return next;
      });
      onShowToast('Image attached', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to upload image', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full px-2 sm:px-4 pb-20">
      {/* =================================================================== */}
      {/* TOP BAR / HEADER */}
      {/* =================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-tr from-purple-900 via-indigo-900 to-slate-900 p-5 sm:p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/30 text-purple-200 border border-purple-400/30 flex items-center gap-1">
              <Gamepad2 className="w-3 h-3 text-purple-300" />
              <span>Cohost Live (Phase 1)</span>
            </span>
            {session && session.state !== 'ended' && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 animate-pulse">
                PIN: {session.pin} Live
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
            <span>Games</span>
            <span className="text-sm font-normal text-purple-200/80">· Cohost Live Interactive Quizzes</span>
          </h1>
          <p className="text-xs text-purple-200/80">
            Host live multiplayer quizzes with PINs, real-time leaderboard, and instant scoring.
          </p>
        </div>

        {/* Global Sound & Tab Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Sound Controls */}
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={handleToggleMute}
              className="p-1 text-white hover:text-purple-300 transition-colors cursor-pointer"
              title={isMuted ? 'Unmute game sounds' : 'Mute game sounds'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-300" /> : <Volume2 className="w-4 h-4 text-emerald-300" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={e => handleChangeVolume(parseFloat(e.target.value))}
              aria-label="Cohost audio volume"
              className="w-16 sm:w-20 accent-purple-400 cursor-pointer"
            />
          </div>

          {/* Tab Switcher: Library vs Active Session */}
          <div className="flex items-center p-1 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'library'
                  ? 'bg-white text-purple-900 shadow-md font-black'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Game Library
            </button>
            {activePin && (
              <button
                type="button"
                onClick={() => setActiveTab('session')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'session'
                    ? 'bg-white text-purple-900 shadow-md font-black'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Live Host</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Teacher Music Sharing Tip */}
      <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 text-xs text-purple-900 dark:text-purple-200">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
          <span>
            <strong>Pro Tip:</strong> To play your own royalty-free music, share your computer audio in Zoom or Google Meet.
          </span>
        </div>
      </div>

      {/* =================================================================== */}
      {/* VIEW: GAME LIBRARY */}
      {/* =================================================================== */}
      {activeTab === 'library' && (
        <div className="space-y-4">
          {/* Firestore Read Error Banner if error occurred */}
          {loadError && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-500/60 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-800 dark:text-rose-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-rose-900 dark:text-rose-100">
                    Firestore Error Loading Games ({loadError.code || 'error'})
                  </h4>
                  <p className="text-xs font-mono text-rose-700 dark:text-rose-300 mt-0.5 break-all">
                    {loadError.message}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={loadGames}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">Games</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Create new quiz templates or launch a live lobby with a 6-digit PIN.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Create Game</span>
            </button>
          </div>

          {isLoadingGames ? (
            <div className="p-12 text-center text-slate-400 text-xs">Loading game library...</div>
          ) : games.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
                <Gamepad2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No games yet. Create your first Cohost game</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Host live multiplayer quiz competitions with 4 colored shapes, countdown timer, sound effects, and instant podium rankings.
              </p>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="mt-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer transition-all shadow-md"
              >
                Create Game
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {games.map(game => (
                <div
                  key={game.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                        {game.questionsCount || game.questions.length} Questions
                      </span>
                      {game.streakBonus && (
                        <span className="text-[10px] font-bold text-amber-500 flex items-center gap-0.5">
                          <Flame className="w-3 h-3 text-amber-500" />
                          <span>Streak Bonus</span>
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white line-clamp-1 group-hover:text-purple-600 transition-colors">
                      {game.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Classes:{' '}
                      {game.classIds && game.classIds.length > 0
                        ? game.classIds
                            .map(cId => state.classes.find(c => c.id === cId)?.name || cId)
                            .join(', ')
                        : 'All Classes'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(game)}
                        className="p-2 rounded-xl text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors cursor-pointer"
                        title="Edit Game"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateGame(game)}
                        className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                        title="Duplicate Game"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmGame(game)}
                        className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Delete Game"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleStartLobby(game)}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start Lobby</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW: LIVE SESSION CONTROLLER (LOBBY / QUESTION / REVEAL / PODIUM) */}
      {/* =================================================================== */}
      {activeTab === 'session' && session && (
        <div className="space-y-6">
          {/* Pause Notice Banner */}
          {session.isPaused && (
            <div className="bg-amber-500 text-white px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between animate-pulse">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Game is paused because the teacher tab was minimized or closed. Keep this tab open during the game.</span>
              </span>
            </div>
          )}

          {/* 1. LOBBY VIEW */}
          {session.state === 'lobby' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-6">
              <div className="text-center space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Game Lobby • {session.title}
                </span>
                <h2 className="text-xs text-slate-500 dark:text-slate-400">
                  Join at <strong className="text-slate-800 dark:text-white">{window.location.host}</strong> or scan QR code
                </h2>
                {/* 6-Digit PIN Display */}
                <div className="py-2">
                  <span className="text-5xl sm:text-6xl font-black font-mono tracking-widest bg-gradient-to-r from-purple-600 via-indigo-600 to-fuchsia-600 bg-clip-text text-transparent select-all">
                    {session.pin}
                  </span>
                </div>
              </div>

              {/* QR Code and Guest Switch */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
                {qrDataUrl && (
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center gap-1">
                    <img src={qrDataUrl} alt={`QR Code for PIN ${session.pin}`} className="w-40 h-40" />
                    <span className="text-[10px] font-bold text-slate-500">Scan to join on phone</span>
                  </div>
                )}

                <div className="space-y-4 max-w-xs text-left">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Allow guests (not recorded)
                      </span>
                      <input
                        type="checkbox"
                        checked={session.allowGuests}
                        onChange={handleToggleAllowGuests}
                        className="w-4 h-4 accent-purple-600 cursor-pointer"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                      If enabled, anyone with the PIN or QR code can join using Anonymous login. Guest scores are never saved.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={players.length === 0}
                      onClick={handleStartGame}
                      className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white text-sm font-black shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Start Game ({players.length} Players)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Player Roster */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-purple-600" />
                    <span>Connected Players ({players.length})</span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {players.length === 0 ? 'Waiting for players to join...' : 'Teacher can remove any player'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {players.map(p => (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-1 group"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800 dark:text-white block truncate">
                          {p.nickname}
                        </span>
                        {p.isGuest ? (
                          <span className="text-[9px] font-bold text-amber-500 uppercase">Guest</span>
                        ) : p.realName ? (
                          <span className="text-[10px] text-slate-400 block truncate">{p.realName}</span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleKickPlayer(p.id, p.nickname)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                        title="Remove player"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. QUESTION SCREEN (Countdown & X of Y answered) */}
          {session.state === 'question' && session.currentQuestion && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-6">
              {/* Question Header: Countdown & Answered Counter */}
              <div className="flex items-center justify-between gap-4">
                <span className="px-3 py-1 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-xs font-black">
                  Question {session.currentQuestionIndex + 1} of {session.totalQuestions}
                </span>

                {/* Big Timer */}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-12 h-12 rounded-full border-4 flex items-center justify-center font-mono font-black text-lg transition-colors ${
                      timeLeft <= 5
                        ? 'border-rose-500 text-rose-500 animate-bounce'
                        : 'border-purple-600 text-purple-600 dark:text-purple-400'
                    }`}
                  >
                    {timeLeft}
                  </div>
                </div>

                {/* Answered tally */}
                <div className="text-right">
                  <span className="text-sm font-black text-slate-800 dark:text-white">
                    {answers.filter(a => a.questionIndex === session.currentQuestionIndex).length} of {players.length}
                  </span>
                  <span className="text-[10px] text-slate-400 block">Answers locked in</span>
                </div>
              </div>

              {/* Question text & optional image */}
              <div className="text-center space-y-4 py-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white max-w-2xl mx-auto leading-snug">
                  {session.currentQuestion.text}
                </h2>
                {session.currentQuestion.image && (
                  <div className="max-w-md mx-auto aspect-video rounded-2xl overflow-hidden bg-slate-950 shadow-md">
                    <img
                      src={session.currentQuestion.image}
                      alt="Question illustration"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
              </div>

              {/* Options display with shapes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {session.currentQuestion.options.map((optText, optIdx) => {
                  const style = COHOST_OPTIONS[optIdx];
                  return (
                    <div
                      key={optIdx}
                      className={`${style.bgClass} text-white p-4 rounded-2xl flex items-center gap-3 shadow-md`}
                    >
                      <CohostShapeIcon index={optIdx} className="w-6 h-6 text-white shrink-0" />
                      <span className="text-sm sm:text-base font-bold truncate">{optText}</span>
                    </div>
                  );
                })}
              </div>

              {/* Skip / Lock Question */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleLockAndReveal}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-white hover:bg-slate-700 text-xs font-bold cursor-pointer"
                >
                  Skip Timer & Reveal Answer
                </button>
              </div>
            </div>
          )}

          {/* 3. REVEAL SCREEN (Correct answer & options distribution) */}
          {session.state === 'reveal' && session.currentQuestion && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-600">
                  Question {session.currentQuestionIndex + 1} • Result Reveal
                </span>
                <button
                  type="button"
                  onClick={handleShowLeaderboard}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span>Show Leaderboard</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white text-center">
                {session.currentQuestion.text}
              </h2>

              {/* Bar graph breakdown of student choices */}
              <div className="space-y-3 max-w-xl mx-auto">
                {session.currentQuestion.options.map((optText, optIdx) => {
                  const isCorrect = session.revealedAnswerIndex === optIdx;
                  const count = session.optionCounts?.[optIdx] || 0;
                  const total = session.totalAnswersCount || 1;
                  const pct = Math.round((count / (total || 1)) * 100);
                  const style = COHOST_OPTIONS[optIdx];

                  return (
                    <div
                      key={optIdx}
                      className={`p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 ${
                        isCorrect
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-1.5 rounded-xl ${style.bgClass} text-white`}>
                          <CohostShapeIcon index={optIdx} className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-bold text-slate-800 dark:text-white truncate">
                          {optText}
                        </span>
                        {isCorrect && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white flex items-center gap-1">
                            <Check className="w-3 h-3" /> Correct
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                          {count} ({pct}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Explanation Card */}
              {session.explanation && (
                <div className="bg-purple-50 dark:bg-purple-950/40 p-4 rounded-2xl border border-purple-200 dark:border-purple-800 max-w-xl mx-auto space-y-1">
                  <span className="text-[11px] font-black text-purple-700 dark:text-purple-300 uppercase">
                    Explanation
                  </span>
                  <p className="text-xs text-purple-900 dark:text-purple-200">{session.explanation}</p>
                </div>
              )}
            </div>
          )}

          {/* 4. LEADERBOARD SCREEN */}
          {session.state === 'leaderboard' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-purple-600">
                  Top 5 Leaderboard
                </span>
                <button
                  type="button"
                  onClick={handleAdvanceNext}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span>
                    {session.currentQuestionIndex + 1 >= session.totalQuestions ? 'Final Podium' : 'Next Question'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 max-w-lg mx-auto">
                {(session.leaderboard || []).slice(0, 5).map((entry, idx) => (
                  <div
                    key={entry.playerId}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                          idx === 0
                            ? 'bg-amber-400 text-amber-950'
                            : idx === 1
                            ? 'bg-slate-300 text-slate-800'
                            : idx === 2
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white block">
                          {entry.nickname}
                        </span>
                        {entry.streak >= 3 && (
                          <span className="text-[10px] font-bold text-amber-500 flex items-center gap-0.5">
                            <Flame className="w-3 h-3 text-amber-500" />
                            <span>{entry.streak} in a row!</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-base font-black font-mono text-purple-600 dark:text-purple-400">
                      {entry.score} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. PODIUM SCREEN (Top 3 & Full Results) */}
          {session.state === 'podium' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-md space-y-8 text-center">
              <div className="space-y-1">
                <div className="w-12 h-12 mx-auto rounded-full bg-amber-400/20 text-amber-500 flex items-center justify-center">
                  <Award className="w-7 h-7" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Tournament Podium</h2>
                <p className="text-xs text-slate-500">Congratulations to the top performers!</p>
              </div>

              {/* 3-Step Podium Graphic */}
              <div className="flex items-end justify-center gap-3 pt-6 max-w-md mx-auto">
                {/* 2nd Place */}
                {players[1] && (
                  <div className="flex-1 flex flex-col items-center">
                    <span className="text-xs font-bold text-slate-800 dark:text-white mb-1 truncate max-w-[90px]">
                      {players[1].nickname}
                    </span>
                    <span className="text-[10px] font-mono text-purple-500 mb-2">{players[1].score} pts</span>
                    <div className="w-full h-24 bg-gradient-to-t from-slate-400 to-slate-300 rounded-t-2xl flex items-center justify-center text-slate-800 font-black text-xl shadow-md">
                      2
                    </div>
                  </div>
                )}

                {/* 1st Place */}
                {players[0] && (
                  <div className="flex-1 flex flex-col items-center">
                    <Sparkles className="w-6 h-6 text-amber-400 mb-1 animate-bounce" />
                    <span className="text-sm font-black text-slate-900 dark:text-white mb-1 truncate max-w-[100px]">
                      {players[0].nickname}
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-500 mb-2">{players[0].score} pts</span>
                    <div className="w-full h-32 bg-gradient-to-t from-amber-500 to-yellow-400 rounded-t-2xl flex items-center justify-center text-amber-950 font-black text-2xl shadow-xl">
                      1
                    </div>
                  </div>
                )}

                {/* 3rd Place */}
                {players[2] && (
                  <div className="flex-1 flex flex-col items-center">
                    <span className="text-xs font-bold text-slate-800 dark:text-white mb-1 truncate max-w-[90px]">
                      {players[2].nickname}
                    </span>
                    <span className="text-[10px] font-mono text-purple-500 mb-2">{players[2].score} pts</span>
                    <div className="w-full h-18 bg-gradient-to-t from-amber-700 to-amber-600 rounded-t-2xl flex items-center justify-center text-white font-black text-lg shadow-md">
                      3
                    </div>
                  </div>
                )}
              </div>

              {/* Actions: Save Results & End Game */}
              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={isResultsSaved}
                  onClick={handleSaveResults}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>{isResultsSaved ? 'Results Saved' : 'Save Results (Enrolled Only)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsEndGameModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <X className="w-4 h-4" />
                  <span>End Game & Clear Guests</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: CREATE / EDIT GAME */}
      {/* =================================================================== */}
      {isEditorOpen && (
        <Modal
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          title={editingGameId ? 'Edit Quiz Game' : 'Create Quiz Game'}
          size="lg"
        >
          <div className="space-y-6">
            {/* Game settings: Name, classes, streak bonus, shuffle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Game Name</label>
                <input
                  type="text"
                  value={gameName}
                  onChange={e => setGameName(e.target.value)}
                  placeholder="e.g. Science Revision Chapter 4"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-4 pt-5">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={streakBonus}
                    onChange={e => setStreakBonus(e.target.checked)}
                    className="accent-purple-600"
                  />
                  <span>Streak Bonus (+100 from 3rd)</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shuffleQuestions}
                    onChange={e => setShuffleQuestions(e.target.checked)}
                    className="accent-purple-600"
                  />
                  <span>Shuffle Questions</span>
                </label>
              </div>
            </div>

            {/* Questions Tabs and Question Editor */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  Questions ({editorQuestions.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Question</span>
                </button>
              </div>

              {/* Question selector tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
                {editorQuestions.map((q, idx) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setActiveQIndex(idx)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                      activeQIndex === idx
                        ? 'bg-purple-600 text-white font-black shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Q{idx + 1}
                  </button>
                ))}
              </div>

              {/* Active Question Editor */}
              {editorQuestions[activeQIndex] && (() => {
                const q = editorQuestions[activeQIndex];
                const qAns = editorAnswers[q.id] ?? 0;

                const updateCurrentQ = (patch: Partial<CohostQuestion>) => {
                  setEditorQuestions(prev => {
                    const next = [...prev];
                    next[activeQIndex] = { ...next[activeQIndex], ...patch };
                    return next;
                  });
                };

                return (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">Question {activeQIndex + 1} Settings</span>
                      {editorQuestions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(activeQIndex)}
                          className="text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Question</span>
                        </button>
                      )}
                    </div>

                    {/* Question text */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Question Text</label>
                      <input
                        type="text"
                        value={q.text}
                        onChange={e => updateCurrentQ({ text: e.target.value })}
                        placeholder="Type question prompt..."
                        className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white"
                      />
                    </div>

                    {/* Question Type, Time limit, Points, Mood */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-500">Type</label>
                        <select
                          value={q.type}
                          onChange={e => {
                            const t = e.target.value as CohostQuestionType;
                            updateCurrentQ({
                              type: t,
                              options: t === 'boolean' ? ['True', 'False'] : ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
                            });
                          }}
                          className="w-full mt-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                        >
                          <option value="multi">Multiple Choice</option>
                          <option value="boolean">True / False</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-500">Time Limit</label>
                        <select
                          value={q.time}
                          onChange={e => updateCurrentQ({ time: parseInt(e.target.value) as any })}
                          className="w-full mt-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                        >
                          <option value={5}>5 seconds</option>
                          <option value={10}>10 seconds</option>
                          <option value={20}>20 seconds</option>
                          <option value={30}>30 seconds</option>
                          <option value={60}>60 seconds</option>
                          <option value={90}>90 seconds</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-500">Points</label>
                        <select
                          value={q.points}
                          onChange={e => updateCurrentQ({ points: e.target.value as CohostPointsMultiplier })}
                          className="w-full mt-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                        >
                          <option value="standard">Standard (1000)</option>
                          <option value="double">Double Points (2x)</option>
                          <option value="none">No Points</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-500">Music Mood</label>
                        <select
                          value={q.musicMood}
                          onChange={e => updateCurrentQ({ musicMood: e.target.value as CohostMusicMood })}
                          className="w-full mt-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                        >
                          <option value="Chill">Chill</option>
                          <option value="Hype">Hype</option>
                          <option value="Mystery">Mystery</option>
                          <option value="Party">Party</option>
                          <option value="Epic">Epic</option>
                          <option value="Silent">Silent</option>
                        </select>
                      </div>
                    </div>

                    {/* Image Attachment */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500">Optional Image</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => {
                            if (e.target.files?.[0]) handleUploadQuestionImage(e.target.files[0]);
                          }}
                          className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-100 file:text-purple-700 cursor-pointer"
                        />
                        {q.image && (
                          <button
                            type="button"
                            onClick={() => updateCurrentQ({ image: undefined })}
                            className="text-xs text-rose-500 font-bold hover:underline cursor-pointer"
                          >
                            Remove image
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Options Editor & Secret Answer Picker */}
                    <div className="space-y-2 pt-2">
                      <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                        Answer Options & Correct Answer
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Select the radio button next to the correct answer. The correct answer is stored in a teacher-only document and never sent to students.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((optText, optIdx) => {
                          const style = COHOST_OPTIONS[optIdx];
                          const isCorrect = qAns === optIdx;

                          return (
                            <div
                              key={optIdx}
                              className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                                isCorrect
                                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`correct_ans_${q.id}`}
                                checked={isCorrect}
                                onChange={() => setEditorAnswers(prev => ({ ...prev, [q.id]: optIdx }))}
                                className="accent-emerald-600 cursor-pointer"
                                title="Mark as correct answer"
                              />
                              <CohostShapeIcon index={optIdx} className={`w-4 h-4 ${style.textClass} shrink-0`} />
                              <input
                                type="text"
                                value={optText}
                                disabled={q.type === 'boolean'}
                                onChange={e => {
                                  const newOpts = [...q.options];
                                  newOpts[optIdx] = e.target.value;
                                  updateCurrentQ({ options: newOpts });
                                }}
                                className="w-full text-xs font-bold bg-transparent border-0 focus:outline-none"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Explanation */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-500">
                        Explanation (Revealed after answers are locked)
                      </label>
                      <input
                        type="text"
                        value={q.explanation || ''}
                        onChange={e => updateCurrentQ({ explanation: e.target.value })}
                        placeholder="Optional explanation shown during results reveal..."
                        className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveGameFromEditor}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Save Game
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {deleteConfirmGame && (
        <Modal
          isOpen={!!deleteConfirmGame}
          onClose={() => setDeleteConfirmGame(null)}
          title="Delete Game"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to delete <strong>{deleteConfirmGame.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmGame(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteGame}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 cursor-pointer"
              >
                Delete Game
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: END GAME CONFIRMATION */}
      {isEndGameModalOpen && (
        <Modal
          isOpen={isEndGameModalOpen}
          onClose={() => setIsEndGameModalOpen(false)}
          title="End Game & Clear Guest Data"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Ending the game will close the live session and delete all guest player and answer documents from Firestore.
              {!isResultsSaved && (
                <span className="block mt-2 text-rose-500 font-bold">
                  Note: You have not saved enrolled student results yet.
                </span>
              )}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEndGameModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEndGame}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 cursor-pointer"
              >
                End Game
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
