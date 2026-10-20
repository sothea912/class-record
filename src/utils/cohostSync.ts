import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from './firebase';
import {
  CohostGame,
  CohostGameKeys,
  CohostQuestion,
  CohostSession,
  CohostPlayer,
  CohostAnswer,
  CohostLeaderboardEntry,
  CohostSavedResult,
} from '../types';

// ==========================================
// OFFENSIVE WORDS BLOCKLIST & NICKNAME RULES
// ==========================================

const OFFENSIVE_TERMS = [
  'admin', 'moderator', 'teacher', 'centralacademy', 'fuck', 'shit', 'bitch', 'asshole',
  'dick', 'pussy', 'nigger', 'nigga', 'faggot', 'cunt', 'retard', 'bastard', 'slut', 'whore',
  'kill', 'die', 'nazi', 'hitler', 'terrorist', 'porn', 'sex', 'penis', 'vagina'
];

export function validateNickname(nickname: string, existingNicknames: string[] = []): { valid: boolean; reason?: string } {
  const trimmed = nickname.trim();
  if (trimmed.length < 2) {
    return { valid: false, reason: 'Nickname must be at least 2 characters long.' };
  }
  if (trimmed.length > 20) {
    return { valid: false, reason: 'Nickname cannot exceed 20 characters.' };
  }

  const lower = trimmed.toLowerCase();
  for (const term of OFFENSIVE_TERMS) {
    if (lower.includes(term)) {
      return { valid: false, reason: 'Please choose an appropriate nickname.' };
    }
  }

  const isDuplicate = existingNicknames.some(n => n.trim().toLowerCase() === lower);
  if (isDuplicate) {
    return { valid: false, reason: 'That nickname is already taken in this session. Please pick another.' };
  }

  return { valid: true };
}

// Generate unique 6-digit PIN
export function generatePin(): string {
  const min = 100000;
  const max = 999999;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

// Browser-based image compression for Cohost question images (keeps doc < 1MB)
export function compressCohostImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please select an image file (PNG, JPG, JPEG, WEBP).'));
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 640;
        const maxHeight = 360;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image for processing'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

// ==========================================
// GAME LIBRARY (CRUD)
// ==========================================

export async function syncSaveCohostGame(
  game: CohostGame,
  secretAnswers: Record<string, number>
): Promise<void> {
  const now = new Date().toISOString();
  const gameData: CohostGame = {
    ...game,
    updatedAt: now,
    createdAt: game.createdAt || now,
    questionsCount: game.questions.length,
  };

  // 1. Save game metadata & questions (public template, no secret answers)
  await setDoc(doc(db, 'cohost_games', game.id), gameData);

  // 2. Save secret answers in teacher-only collection
  const keysData: CohostGameKeys = {
    id: game.id,
    answers: secretAnswers,
  };
  await setDoc(doc(db, 'cohost_keys', game.id), keysData);
}

export async function syncDeleteCohostGame(gameId: string): Promise<void> {
  await deleteDoc(doc(db, 'cohost_games', gameId));
  await deleteDoc(doc(db, 'cohost_keys', gameId));
}

export async function syncFetchCohostGames(): Promise<CohostGame[]> {
  try {
    const snap = await getDocs(collection(db, 'cohost_games'));
    const list: CohostGame[] = [];
    snap.forEach(d => {
      list.push(d.data() as CohostGame);
    });
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (err) {
    console.warn('[Cohost] Error fetching games:', err);
    throw err;
  }
}

export async function syncFetchCohostGameKeys(gameId: string): Promise<Record<string, number> | null> {
  try {
    const snap = await getDoc(doc(db, 'cohost_keys', gameId));
    if (snap.exists()) {
      return (snap.data() as CohostGameKeys).answers;
    }
    return null;
  } catch (err) {
    console.warn('[Cohost] Error fetching game keys:', err);
    throw err;
  }
}

// ==========================================
// LIVE SESSIONS & REAL-TIME HOSTING
// ==========================================

export async function syncCreateCohostSession(
  game: CohostGame,
  allowGuests: boolean,
  teacherUid: string
): Promise<{ pin: string; secretKeys: Record<string, number> }> {
  // 1. Fetch secret answer keys
  const keysSnap = await syncFetchCohostGameKeys(game.id);
  const secretKeys: Record<string, number> = keysSnap || {};

  // 2. Optionally shuffle questions
  let questionsToPlay = [...game.questions];
  if (game.shuffleQuestions) {
    questionsToPlay = questionsToPlay.sort(() => Math.random() - 0.5);
  }

  // 3. Find unique 6-digit PIN
  let pin = generatePin();
  let attempts = 0;
  while (attempts < 5) {
    const checkSnap = await getDoc(doc(db, 'cohost_sessions', pin));
    if (!checkSnap.exists()) break;
    pin = generatePin();
    attempts++;
  }

  const nowMs = Date.now();
  const nowISO = new Date().toISOString();

  const sessionData: CohostSession = {
    pin,
    gameId: game.id,
    title: game.name,
    classIds: game.classIds || [],
    state: 'lobby',
    allowGuests,
    currentQuestionIndex: 0,
    totalQuestions: questionsToPlay.length,
    questionStartTime: 0,
    timeLimitSeconds: questionsToPlay[0]?.time || 20,
    currentQuestion: questionsToPlay[0] || undefined,
    teacherUid,
    streakBonus: game.streakBonus ?? true,
    leaderboard: [],
    createdAt: nowISO,
    updatedAt: nowISO,
  };

  // 4. Save session doc (ID IS THE PIN!)
  await setDoc(doc(db, 'cohost_sessions', pin), sessionData);

  // 5. Save session secret answers in teacher-only subcollection
  await setDoc(doc(db, 'cohost_sessions', pin, 'keys', 'secret'), {
    pin,
    answers: secretKeys,
    questionsOrder: questionsToPlay.map(q => q.id),
  });

  return { pin, secretKeys };
}

export function subscribeToCohostSession(
  pin: string,
  callback: (session: CohostSession | null) => void,
  onError?: (err: Error) => void
): () => void {
  const sessionRef = doc(db, 'cohost_sessions', pin);
  return onSnapshot(
    sessionRef,
    snap => {
      if (snap.exists()) {
        callback(snap.data() as CohostSession);
      } else {
        callback(null);
      }
    },
    err => {
      console.warn('[Cohost] Error subscribing to session:', err);
      if (onError) onError(err);
      callback(null);
    }
  );
}

export function subscribeToActiveLiveGameForClasses(
  classIds: string[],
  callback: (sessions: CohostSession[]) => void
): () => void {
  if (!classIds || classIds.length === 0) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'cohost_sessions'),
    where('state', 'in', ['lobby', 'question', 'reveal', 'leaderboard'])
  );

  return onSnapshot(
    q,
    snap => {
      const active: CohostSession[] = [];
      snap.forEach(d => {
        const data = d.data() as CohostSession;
        // Check if session shares any classId with student's enrolled classes
        if (data.classIds?.some(c => classIds.includes(c)) || data.classIds?.includes('all')) {
          active.push(data);
        }
      });
      callback(active);
    },
    err => {
      console.warn('[Cohost] Error checking live sessions for class:', err);
      callback([]);
    }
  );
}

export function subscribeToCohostPlayers(
  pin: string,
  callback: (players: CohostPlayer[]) => void
): () => void {
  const playersRef = collection(db, 'cohost_sessions', pin, 'players');
  return onSnapshot(
    playersRef,
    snap => {
      const players: CohostPlayer[] = [];
      snap.forEach(d => {
        players.push(d.data() as CohostPlayer);
      });
      // Sort by score descending, then streak descending
      players.sort((a, b) => b.score - a.score || b.streak - a.streak);
      callback(players);
    },
    err => {
      console.warn('[Cohost] Error subscribing to players:', err);
      callback([]);
    }
  );
}

export function subscribeToCohostAnswers(
  pin: string,
  callback: (answers: CohostAnswer[]) => void
): () => void {
  const answersRef = collection(db, 'cohost_sessions', pin, 'answers');
  return onSnapshot(
    answersRef,
    snap => {
      const answers: CohostAnswer[] = [];
      snap.forEach(d => {
        answers.push(d.data() as CohostAnswer);
      });
      callback(answers);
    },
    err => {
      console.warn('[Cohost] Error subscribing to answers:', err);
      callback([]);
    }
  );
}

// Student or Guest joining a session
export async function syncJoinCohostSession(
  pin: string,
  nickname: string,
  options: {
    studentId?: string;
    realName?: string;
    isGuest?: boolean;
  }
): Promise<{ success: boolean; error?: string; playerId?: string }> {
  try {
    // 1. Fetch session to verify it exists and is open
    const sessionDoc = await getDoc(doc(db, 'cohost_sessions', pin));
    if (!sessionDoc.exists()) {
      return { success: false, error: 'Session with this PIN was not found.' };
    }

    const session = sessionDoc.data() as CohostSession;
    if (session.state === 'ended') {
      return { success: false, error: 'This game has already ended.' };
    }

    if (options.isGuest && !session.allowGuests) {
      return { success: false, error: 'This game does not allow guest players.' };
    }

    // 2. Auth: if guest or no auth user, sign in anonymously
    let currentAuthUser = auth.currentUser;
    if (!currentAuthUser) {
      const cred = await signInAnonymously(auth);
      currentAuthUser = cred.user;
    }

    const playerId = currentAuthUser.uid;

    // 3. Fetch existing players in session to check nickname uniqueness
    const playersSnap = await getDocs(collection(db, 'cohost_sessions', pin, 'players'));
    const existingNicknames: string[] = [];
    playersSnap.forEach(d => {
      const p = d.data() as CohostPlayer;
      if (p.id !== playerId) {
        existingNicknames.push(p.nickname);
      }
    });

    const validation = validateNickname(nickname, existingNicknames);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    // 4. Create or update player document
    const nowISO = new Date().toISOString();
    const playerData: CohostPlayer = {
      id: playerId,
      nickname: nickname.trim(),
      realName: options.realName || undefined,
      studentId: options.studentId || undefined,
      isGuest: Boolean(options.isGuest || currentAuthUser.isAnonymous),
      score: 0,
      streak: 0,
      joinedAt: nowISO,
    };

    await setDoc(doc(db, 'cohost_sessions', pin, 'players', playerId), playerData);

    return { success: true, playerId };
  } catch (err: any) {
    console.error('[Cohost] Join error:', err);
    return { success: false, error: err.message || 'Failed to join session.' };
  }
}

// Remove / Kick player (Teacher only)
export async function syncRemoveCohostPlayer(pin: string, playerId: string): Promise<void> {
  await deleteDoc(doc(db, 'cohost_sessions', pin, 'players', playerId));
}

// Submit Answer by Player
export async function syncSubmitCohostAnswer(
  pin: string,
  questionIndex: number,
  playerId: string,
  selectedOption: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const answerId = `${questionIndex}_${playerId}`;

    const answerData: any = {
      id: answerId,
      pin,
      questionIndex,
      playerId,
      selectedOption,
      submittedAt: serverTimestamp(),
      clientTimestamp: Date.now(),
    };

    await setDoc(doc(db, 'cohost_sessions', pin, 'answers', answerId), answerData);
    return { success: true };
  } catch (err: any) {
    console.error('[Cohost] Submit answer error:', err);
    return { success: false, error: err.message || 'Failed to record answer.' };
  }
}

// ==========================================
// SCORING IN TEACHER'S BROWSER
// ==========================================

export async function syncTeacherLockAndScoreQuestion(
  session: CohostSession,
  correctAnswerIndex: number,
  answers: CohostAnswer[],
  players: CohostPlayer[]
): Promise<void> {
  const pin = session.pin;
  const qIndex = session.currentQuestionIndex;
  const qStartTime = session.questionStartTime || Date.now();
  const timeLimit = session.timeLimitSeconds || 20;
  const multiplier = session.currentQuestion?.points || 'standard';
  const multFactor = multiplier === 'double' ? 2 : multiplier === 'none' ? 0 : 1;
  const hasStreakBonus = session.streakBonus ?? true;

  // Filter answers for current question
  const currentAnswers = answers.filter(a => a.questionIndex === qIndex);

  // Tally options counts
  const optionCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  currentAnswers.forEach(a => {
    if (a.selectedOption >= 0 && a.selectedOption <= 3) {
      optionCounts[a.selectedOption] = (optionCounts[a.selectedOption] || 0) + 1;
    }
  });

  // Score each player
  const batch = writeBatch(db);
  const updatedPlayers: CohostPlayer[] = [];

  for (const player of players) {
    const playerAns = currentAnswers.find(a => a.playerId === player.id);
    let isCorrect = false;
    let pointsEarned = 0;
    let newStreak = player.streak || 0;

    if (playerAns && playerAns.selectedOption === correctAnswerIndex) {
      isCorrect = true;
      newStreak += 1;

      if (multFactor > 0) {
        // Linear reduction from 1000 down to 500 based on server elapsed time
        let answerTimeMs = qStartTime;
        if (playerAns.submittedAt) {
          if (typeof playerAns.submittedAt.toMillis === 'function') {
            answerTimeMs = playerAns.submittedAt.toMillis();
          } else if (typeof playerAns.submittedAt === 'string') {
            answerTimeMs = new Date(playerAns.submittedAt).getTime() || qStartTime;
          } else if (typeof playerAns.submittedAt === 'number') {
            answerTimeMs = playerAns.submittedAt;
          }
        } else if ((playerAns as any).clientTimestamp) {
          answerTimeMs = (playerAns as any).clientTimestamp;
        }

        const elapsedSec = Math.max(0, Math.min(timeLimit, (answerTimeMs - qStartTime) / 1000));
        const fraction = elapsedSec / timeLimit;
        const basePoints = Math.round(1000 - fraction * 500); // 1000 down to 500

        pointsEarned = basePoints * multFactor;

        // Streak bonus: +100 per consecutive correct from the 3rd
        if (hasStreakBonus && newStreak >= 3) {
          const streakBonus = (newStreak - 2) * 100;
          pointsEarned += streakBonus;
        }
      }
    } else {
      isCorrect = false;
      newStreak = 0;
      pointsEarned = 0;
    }

    const updatedScore = (player.score || 0) + pointsEarned;
    const updatedP: CohostPlayer = {
      ...player,
      score: updatedScore,
      streak: newStreak,
      lastAnswerCorrect: isCorrect,
      lastPointsEarned: pointsEarned,
    };
    updatedPlayers.push(updatedP);

    // Add player update to batch
    const playerDocRef = doc(db, 'cohost_sessions', pin, 'players', player.id);
    batch.update(playerDocRef, {
      score: updatedScore,
      streak: newStreak,
      lastAnswerCorrect: isCorrect,
      lastPointsEarned: pointsEarned,
    });
  }

  // Sort players for leaderboard & assign ranks
  updatedPlayers.sort((a, b) => b.score - a.score || b.streak - a.streak);
  const leaderboard: CohostLeaderboardEntry[] = updatedPlayers.slice(0, 5).map((p, idx) => ({
    playerId: p.id,
    nickname: p.nickname,
    score: p.score,
    rank: idx + 1,
    streak: p.streak,
    isGuest: p.isGuest,
    realName: p.realName,
    studentId: p.studentId,
  }));

  // Update session state to 'reveal'
  const sessionDocRef = doc(db, 'cohost_sessions', pin);
  batch.update(sessionDocRef, {
    state: 'reveal',
    revealedAnswerIndex: correctAnswerIndex,
    explanation: session.currentQuestion?.explanation || '',
    optionCounts,
    totalAnswersCount: currentAnswers.length,
    leaderboard,
    updatedAt: new Date().toISOString(),
  });

  await batch.commit();
}

// Teacher advances to Leaderboard
export async function syncTeacherShowLeaderboard(pin: string): Promise<void> {
  await updateDoc(doc(db, 'cohost_sessions', pin), {
    state: 'leaderboard',
    updatedAt: new Date().toISOString(),
  });
}

// Teacher advances to Next Question
export async function syncTeacherNextQuestion(
  pin: string,
  nextIndex: number,
  nextQuestion: CohostQuestion
): Promise<void> {
  const nowMs = Date.now();
  await updateDoc(doc(db, 'cohost_sessions', pin), {
    state: 'question',
    currentQuestionIndex: nextIndex,
    currentQuestion: nextQuestion,
    timeLimitSeconds: nextQuestion.time || 20,
    questionStartTime: nowMs,
    revealedAnswerIndex: -1,
    explanation: '',
    optionCounts: { 0: 0, 1: 0, 2: 0, 3: 0 },
    totalAnswersCount: 0,
    updatedAt: new Date().toISOString(),
  });
}

// Teacher shows Podium (Final top 3)
export async function syncTeacherShowPodium(pin: string, players: CohostPlayer[]): Promise<void> {
  // Sort players to create full leaderboard
  const sorted = [...players].sort((a, b) => b.score - a.score || b.streak - a.streak);
  const leaderboard: CohostLeaderboardEntry[] = sorted.slice(0, 10).map((p, idx) => ({
    playerId: p.id,
    nickname: p.nickname,
    score: p.score,
    rank: idx + 1,
    streak: p.streak,
    isGuest: p.isGuest,
    realName: p.realName,
    studentId: p.studentId,
  }));

  await updateDoc(doc(db, 'cohost_sessions', pin), {
    state: 'podium',
    leaderboard,
    updatedAt: new Date().toISOString(),
  });
}

// Teacher saves results (enrolled students only, guests never included)
export async function syncTeacherSaveResults(
  session: CohostSession,
  players: CohostPlayer[]
): Promise<void> {
  const enrolledOnly = players.filter(p => !p.isGuest && p.studentId);
  if (enrolledOnly.length === 0) return;

  const nowISO = new Date().toISOString();
  const dateStr = nowISO.split('T')[0];
  const resultId = `cohost_${session.pin}_${dateStr}`;

  const savedResult: CohostSavedResult = {
    id: resultId,
    gameId: session.gameId,
    gameTitle: session.title,
    pin: session.pin,
    classIds: session.classIds || [],
    date: dateStr,
    results: enrolledOnly.map((p, idx) => ({
      studentId: p.studentId!,
      studentName: p.realName || p.nickname,
      score: p.score,
      rank: idx + 1,
      correctCount: 0, // Recorded in total score
      totalQuestions: session.totalQuestions,
    })),
    savedAt: nowISO,
  };

  await setDoc(doc(db, 'cohost_saved_results', resultId), savedResult);
}

// Teacher ends game & deletes all guest player and answer documents
export async function syncTeacherEndGame(pin: string): Promise<void> {
  try {
    // 1. Fetch all players and delete guest player documents
    const playersSnap = await getDocs(collection(db, 'cohost_sessions', pin, 'players'));
    const guestPlayerIds: string[] = [];

    const deleteBatch = writeBatch(db);
    playersSnap.forEach(d => {
      const p = d.data() as CohostPlayer;
      if (p.isGuest) {
        guestPlayerIds.push(p.id);
        deleteBatch.delete(d.ref);
      }
    });

    // 2. Fetch all answers and delete guest answer documents
    const answersSnap = await getDocs(collection(db, 'cohost_sessions', pin, 'answers'));
    answersSnap.forEach(d => {
      const a = d.data() as CohostAnswer;
      if (guestPlayerIds.includes(a.playerId)) {
        deleteBatch.delete(d.ref);
      }
    });

    // 3. Update session state to 'ended'
    const sessionRef = doc(db, 'cohost_sessions', pin);
    deleteBatch.update(sessionRef, {
      state: 'ended',
      updatedAt: new Date().toISOString(),
    });

    await deleteBatch.commit();
  } catch (err) {
    console.error('[Cohost] Error ending game and cleaning guest data:', err);
  }
}

// Pause/Resume game when teacher tab is minimized or closed
export async function syncTeacherUpdatePause(pin: string, isPaused: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'cohost_sessions', pin), {
      isPaused,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Cohost] Error updating pause state:', err);
  }
}
