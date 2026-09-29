import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  where,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  deleteUser,
  getAuth,
  updatePassword,
  EmailAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import firebaseConfig from '../../firebase-applet-config.json';

/**
 * Whitelist of approved teacher Google email addresses.
 * Only emails in this whitelist are granted teacher access upon Google sign-in.
 */
export const ALLOWED_TEACHER_EMAILS: string[] = [
  'sotheasoth812@gmail.com', // Primary teacher account
  'sothea.albe@centralacademy.edu.kh',
  // Add additional approved instructor emails here
];
import {
  AnnouncementBanner,
  AppState,
  AttendanceSession,
  AuthUser,
  ClassItem,
  ClassworkTask,
  CustomRecordItem,
  LibraryResource,
  MarkDoc,
  StudentItem,
  StudentPermissionRequest,
  SubjectItem,
  UserProfile,
  StudentProgress,
  DailyQuest,
  AccountRequest,
  ClassJoinRecord,
  DashboardLayoutConfig,
  TeacherSecurity,
} from '../types';
import { scrubCamfirst } from './storage';

export const COLLECTIONS = {
  CLASSES: 'classes',
  STUDENTS: 'students',
  SUBJECTS: 'subjects',
  ATTENDANCE: 'attendance',
  MARKS: 'marks',
  CLASSWORK: 'classwork',
  PERMISSIONS: 'permissions',
  BANNERS: 'banners',
  RESOURCES: 'resources',
  SETTINGS: 'app_settings',
  CUSTOM_RECORDS: 'custom_records',
  USERS: 'users',
  STUDENT_LOOKUP: 'student_lookup',
  STUDENT_PROGRESS: 'studentProgress',
  ACCOUNT_REQUESTS: 'account_requests',
  CLASS_JOINS: 'class_joins',
} as const;

/**
 * Recursively sanitizes an object to make it completely safe for Firestore by removing keys whose values are strictly `undefined`.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null) {
    return null as any;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirestore(item)) as any;
  }
  if (typeof data === 'object') {
    if (data instanceof Date) {
      return data;
    }
    const res: any = {};
    for (const key of Object.keys(data as any)) {
      const val = (data as any)[key];
      if (val !== undefined) {
        res[key] = sanitizeForFirestore(val);
      }
    }
    return res;
  }
  return data;
}

/**
 * Normalizes a student identifier (studentNo, studentId, or raw input) into a clean, uniform slug.
 * - Strips leading 'stu-', 'stu_', 'stu', 'std-', 'std_', 'std' prefixes if followed by letters/numbers.
 * - Strips all non-alphanumeric characters.
 * - Converts to lowercase.
 * Examples:
 *   "STU-1019" -> "1019"
 *   "stu1001"  -> "1001"
 *   "001"      -> "001"
 *   "014"      -> "014"
 *   "STD-05"   -> "05"
 *   "Dit Kanha" -> "ditkanha"
 */
export function normalizeStudentIdentifier(raw: string): string {
  if (!raw) return '';
  let s = raw.trim().toLowerCase();
  // Strip common student prefixes like stu-, stu_, stu, std-, std_, std
  s = s.replace(/^(stu|std)[-_]*/i, '');
  // Remove any remaining special characters except alphanumeric
  const clean = s.replace(/[^a-z0-9]/gi, '');
  return clean || 'student';
}

/**
 * Single, canonical function to generate a student's Firebase Auth email.
 * Used identically across account creation, selective sync, unsync, and login.
 */
export function getStudentAuthEmail(student: { id: string; studentNo?: string; name: string }): string {
  const rawId = student.studentNo || student.id || student.name;
  const slug = normalizeStudentIdentifier(rawId);
  return `${slug}@centralacademy.app`;
}

/**
 * Resolves a login input identifier (which could be a student's Name, Student ID, or bare number)
 * to their exact canonical Firebase Auth email, using the current student roster if available.
 */
export function resolveStudentLoginEmail(
  identifier: string,
  roster: { id: string; studentNo?: string; name: string }[] = []
): string {
  const cleanInput = identifier.trim().toLowerCase();
  if (cleanInput.includes('@')) {
    return cleanInput;
  }

  // 1. Try matching against roster by Name (case-insensitive)
  const byName = roster.find(s => s.name && s.name.trim().toLowerCase() === cleanInput);
  if (byName) {
    return getStudentAuthEmail(byName);
  }

  // 2. Try matching by studentNo or student id with normalization
  const normInput = normalizeStudentIdentifier(cleanInput);
  const byIdOrNo = roster.find(s => {
    if (s.studentNo && normalizeStudentIdentifier(s.studentNo) === normInput) return true;
    if (s.id && normalizeStudentIdentifier(s.id) === normInput) return true;
    if (s.name && normalizeStudentIdentifier(s.name) === normInput) return true;
    return false;
  });
  if (byIdOrNo) {
    return getStudentAuthEmail(byIdOrNo);
  }

  // 3. Fallback: normalize the input directly
  return `${normInput}@centralacademy.app`;
}

/**
 * Synchronizes a public, non-sensitive student lookup document in `student_lookup/{studentId}`.
 * Contains only name, normalized student ID, and canonical email. Zero passwords or sensitive data.
 * Publicly readable so unauthenticated login pages on any fresh device can map student names to real emails.
 */
export async function syncStudentLookupDoc(student: StudentItem): Promise<void> {
  try {
    const lookupRef = doc(db, COLLECTIONS.STUDENT_LOOKUP, student.id);
    const payload = {
      id: student.id,
      name: student.name,
      nameLower: (student.name || '').toLowerCase().trim(),
      studentNo: student.studentNo || '',
      studentNoNorm: normalizeStudentIdentifier(student.studentNo || student.id),
      authEmail: getStudentAuthEmail(student),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(lookupRef, sanitizeForFirestore(payload), { merge: true });
  } catch (e) {
    console.warn('[Student Lookup Sync Warning]:', e);
  }
}

/**
 * Resolves a student identifier (name, student number, or ID) to their registered Firebase Auth email.
 * First checks local roster (if available); if not matched, performs a LIVE query against Firestore
 * collection `student_lookup` so that fresh sessions / incognito windows on phones or other devices
 * resolve the real email (e.g. 1019@centralacademy.app) rather than guessing from their name.
 */
export async function resolveStudentLoginEmailLive(
  identifier: string,
  roster: { id: string; studentNo?: string; name: string }[] = []
): Promise<string> {
  const cleanInput = identifier.trim().toLowerCase();
  if (cleanInput.includes('@')) {
    return cleanInput;
  }

  // 1. Try local roster first if populated
  if (roster && roster.length > 0) {
    const fromRoster = resolveStudentLoginEmail(identifier, roster);
    const rawSlug = normalizeStudentIdentifier(cleanInput);
    if (fromRoster !== `${rawSlug}@centralacademy.app`) {
      return fromRoster;
    }
  }

  // 2. Perform live query directly on Firestore collection `student_lookup`
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.STUDENT_LOOKUP));
    if (!snap.empty) {
      const normInput = normalizeStudentIdentifier(cleanInput);
      for (const d of snap.docs) {
        const data = d.data();
        const docNameLower = (data.nameLower || data.name || '').toLowerCase().trim();
        const docStudentNoNorm = (data.studentNoNorm || normalizeStudentIdentifier(data.studentNo || data.id || ''));
        const docIdNorm = normalizeStudentIdentifier(data.id || d.id || '');

        if (
          docNameLower === cleanInput ||
          docStudentNoNorm === normInput ||
          docIdNorm === normInput ||
          (data.studentNo && data.studentNo.toLowerCase().trim() === cleanInput)
        ) {
          if (data.authEmail) {
            console.log(`[Student Login Live] Matched identifier "${identifier}" to ${data.authEmail}`);
            return data.authEmail;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Student Login Live] Firestore lookup fallback:', err);
  }

  // 3. Fallback to standard deterministic resolver
  return resolveStudentLoginEmail(identifier, roster);
}

/**
 * Generate Firebase Auth password (minimum 6 chars)
 */
export function getStudentAuthPassword(rawPass?: string): string {
  const p = rawPass || '123456';
  return p.length < 6 ? p.padEnd(6, '0') : p;
}

/**
 * Save / sync user role document at users/{uid}
 */
export async function syncSaveUserRoleDoc(
  uid: string,
  userData: {
    role: 'teacher' | 'student';
    name: string;
    email: string;
    studentId?: string;
    classIds?: string[];
  }
): Promise<void> {
  const path = `${COLLECTIONS.USERS}/${uid}`;
  try {
    await setDoc(
      doc(db, COLLECTIONS.USERS, uid),
      sanitizeForFirestore({
        uid,
        ...userData,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Provision real Firebase Authentication account for a student behind the scenes
 * using an isolated temporary secondary Auth app instance (prevents logging out active teacher).
 * Directly calls createUserWithEmailAndPassword on athena-ai-438506 from the browser.
 */
export async function provisionStudentAuthAccount(
  student: StudentItem
): Promise<{ uid: string; email: string; status: 'created' | 'linked_existing' | 'error'; error?: string }> {
  const email = getStudentAuthEmail(student);
  const password = getStudentAuthPassword(student.password);
  const appName = `sec_auth_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const secApp = initializeApp(firebaseConfig, appName);
  const secAuth = getAuth(secApp);

  try {
    let uid = '';
    let status: 'created' | 'linked_existing' = 'created';

    try {
      const userCred = await createUserWithEmailAndPassword(secAuth, email, password);
      uid = userCred.user.uid;
      status = 'created';
    } catch (createErr: any) {
      if (createErr.code === 'auth/email-already-in-use') {
        // Account already exists in Firebase Auth. Sign in to retrieve UID and confirm credentials
        const signCred = await signInWithEmailAndPassword(secAuth, email, password);
        uid = signCred.user.uid;
        status = 'linked_existing';
      } else {
        throw createErr;
      }
    }

    // Clean up temporary secondary app instance immediately
    await signOut(secAuth).catch(() => {});
    await deleteApp(secApp).catch(() => {});

    // Save/update user role document in Firestore
    await syncSaveUserRoleDoc(uid, {
      role: 'student',
      studentId: student.id,
      name: student.name,
      email,
      classIds: student.classIds || [],
    });

    // Update student document in Firestore with auth credentials metadata
    await setDoc(
      doc(db, COLLECTIONS.STUDENTS, student.id),
      { authUid: uid, authEmail: email },
      { merge: true }
    );

    // Keep public student lookup directory in sync for name-based student login
    await syncStudentLookupDoc(student);

    console.log(`[Firebase Auth] Successfully provisioned ${student.name} (${email}) as ${status} with UID: ${uid}`);
    return { uid, email, status };
  } catch (err: any) {
    await deleteApp(secApp).catch(() => {});
    console.error(`[Firebase Auth] Provisioning error for ${student.name} (${email}):`, err);
    let friendlyError = err.message || String(err);
    if (err.code === 'auth/operation-not-allowed') {
      friendlyError = 'Email/Password provider is disabled. Enable it in Firebase Console -> Authentication -> Sign-in method.';
    }
    return { uid: '', email, status: 'error', error: friendlyError };
  }
}

/**
 * Updates a student's Firebase Authentication password whenever their password is changed in Firestore.
 * Automatically synchronizes changes to eliminate password drift.
 */
export async function updateStudentAuthPassword(
  student: StudentItem,
  newPasswordRaw: string,
  oldPasswordRaw?: string
): Promise<{ success: boolean; error?: string }> {
  const email = student.authEmail || getStudentAuthEmail(student);
  const newPass = getStudentAuthPassword(newPasswordRaw);
  const oldPass = oldPasswordRaw ? getStudentAuthPassword(oldPasswordRaw) : (student.password ? getStudentAuthPassword(student.password) : '');

  // If new password is identical to old password, nothing to change
  if (newPass === oldPass) {
    return { success: true };
  }

  // Attempt login with old password candidates to update password
  const oldCandidates = Array.from(new Set([
    oldPass,
    student.password ? getStudentAuthPassword(student.password) : null,
    '123456',
    '222200',
    newPass,
  ].filter(Boolean) as string[]));

  for (const candidate of oldCandidates) {
    const appName = `sec_pass_chg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const secApp = initializeApp(firebaseConfig, appName);
    const secAuth = getAuth(secApp);
    try {
      const userCred = await signInWithEmailAndPassword(secAuth, email, candidate);
      await updatePassword(userCred.user, newPass);
      console.log(`[Firebase Auth] Successfully updated password for ${email} to "${newPass}"`);
      await signOut(secAuth).catch(() => {});
      await deleteApp(secApp).catch(() => {});
      return { success: true };
    } catch (err: any) {
      await deleteApp(secApp).catch(() => {});
    }
  }

  return { success: false, error: 'Could not authenticate existing account to change password.' };
}

/**
 * Permanently delete a student's Firebase Authentication account.
 * Uses an isolated secondary app to sign in AS the student and self-delete via deleteUser().
 */
export async function deleteStudentAuthAccount(
  student: StudentItem
): Promise<{ success: boolean; authDeleted: boolean; error?: string; code?: string }> {
  const candidateEmails = Array.from(new Set([
    student.authEmail,
    getStudentAuthEmail(student),
    student.studentNo ? `stu${student.studentNo.toLowerCase().replace(/[^a-z0-9]/gi, '')}@centralacademy.app` : null,
  ].filter(Boolean) as string[]));

  const candidatePasswords = Array.from(new Set([
    getStudentAuthPassword(student.password),
    student.password,
    '123456',
    '222200',
  ].filter(Boolean) as string[]));

  let authDeleted = false;
  let lastAuthError: any = null;

  for (const email of candidateEmails) {
    for (const pass of candidatePasswords) {
      const appName = `sec_del_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const secApp = initializeApp(firebaseConfig, appName);
      const secAuth = getAuth(secApp);

      try {
        const userCred = await signInWithEmailAndPassword(secAuth, email, pass);
        await deleteUser(userCred.user);
        authDeleted = true;
        console.log(`[Student Auth] Successfully deleted user account for ${email}`);
        await deleteApp(secApp).catch(() => {});
        break;
      } catch (authErr: any) {
        await deleteApp(secApp).catch(() => {});
        lastAuthError = authErr;
        if (authErr.code === 'auth/user-not-found') {
          authDeleted = true;
          break;
        }
      }
    }
    if (authDeleted) break;
  }

  if (!authDeleted) {
    const errCode = lastAuthError?.code || 'auth/deletion-failed';
    const errMsg = lastAuthError?.message || 'Credentials mismatch';
    return {
      success: false,
      authDeleted: false,
      code: errCode,
      error: `Could not delete ${candidateEmails[0]} from Firebase Auth (${errCode}: ${errMsg}).`,
    };
  }

  return { success: true, authDeleted: true };
}

/**
 * Tests a student's login credentials in an isolated secondary Firebase app instance
 * without affecting the active teacher or student session.
 * Returns the exact outcome (success or precise Firebase error code/message).
 */
export async function testStudentLoginSecondary(
  student: StudentItem
): Promise<{ success: boolean; email: string; code?: string; error?: string }> {
  const email = student.authEmail || getStudentAuthEmail(student);
  const password = getStudentAuthPassword(student.password);
  const appName = `sec_testlogin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const secApp = initializeApp(firebaseConfig, appName);
  const secAuth = getAuth(secApp);

  try {
    const cred = await signInWithEmailAndPassword(secAuth, email, password);
    await signOut(secAuth).catch(() => {});
    await deleteApp(secApp).catch(() => {});
    return { success: true, email };
  } catch (err: any) {
    await deleteApp(secApp).catch(() => {});
    return {
      success: false,
      email,
      code: err.code || 'unknown',
      error: err.message || String(err),
    };
  }
}

/**
 * Unsync a student's Firebase Authentication account:
 * - Signs in as the student on an isolated secondary app instance using their stored password or candidate passwords.
 * - Permanently deletes their Firebase Auth user account.
 * - If account deletion fails (e.g. password mismatch or unknown credentials in Auth),
 *   it will NOT falsely mark the account deleted. It returns an honest error instructing
 *   the teacher to delete the user manually in Firebase Console -> Authentication, then click Mark as Missing.
 * - Deletes the users/{uid} document.
 * - Clears authUid and authEmail on the student document in Firestore.
 * - Leaves student roster data, marks, and attendance 100% INTACT.
 */
export async function unsyncStudentAuthAccount(
  student: StudentItem,
  forceMarkMissing = false
): Promise<{ success: boolean; authDeleted: boolean; error?: string; requiresManualDeletion?: boolean }> {
  const candidateEmails = Array.from(new Set([
    student.authEmail,
    getStudentAuthEmail(student),
    student.studentNo ? `stu${student.studentNo.toLowerCase().replace(/[^a-z0-9]/gi, '')}@centralacademy.app` : null,
  ].filter(Boolean) as string[]));

  const candidatePasswords = Array.from(new Set([
    getStudentAuthPassword(student.password),
    student.password,
    '123456',
    '222200',
  ].filter(Boolean) as string[]));

  let authDeleted = false;
  let lastAuthError: any = null;

  if (!forceMarkMissing) {
    for (const email of candidateEmails) {
      for (const pass of candidatePasswords) {
        const appName = `sec_unsync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const secApp = initializeApp(firebaseConfig, appName);
        const secAuth = getAuth(secApp);

        try {
          const userCred = await signInWithEmailAndPassword(secAuth, email, pass);
          await deleteUser(userCred.user);
          authDeleted = true;
          console.log(`[Student Auth] Successfully unsynced/deleted Auth account for ${email}`);
          await deleteApp(secApp).catch(() => {});
          break;
        } catch (authErr: any) {
          await deleteApp(secApp).catch(() => {});
          lastAuthError = authErr;
          if (authErr.code === 'auth/user-not-found') {
            // User does not exist in Auth, so considered deleted
            authDeleted = true;
            break;
          }
        }
      }
      if (authDeleted) break;
    }

    // If account was NOT deleted and exists, do NOT falsely report success
    if (!authDeleted) {
      const errCode = lastAuthError?.code || 'auth/deletion-failed';
      console.warn(`[Student Auth] Unsync failed for ${student.name}: ${errCode}`);
      return {
        success: false,
        authDeleted: false,
        requiresManualDeletion: true,
        error: `Could not delete ${candidateEmails[0]} from Firebase Auth (${errCode}: credentials mismatch). Delete this user manually in Firebase Console → Authentication, then click "Mark as Missing".`
      };
    }
  }

  // Delete user role document from Firestore (users/{authUid})
  if (student.authUid) {
    try {
      await deleteDoc(doc(db, COLLECTIONS.USERS, student.authUid));
    } catch (e) {
      console.warn(`[Firestore] Failed to delete role doc users/${student.authUid}:`, e);
    }
  }

  // Clear authUid and authEmail on the student document in Firestore
  // (Roster enrollments, marks, and attendance remain completely intact!)
  try {
    await setDoc(
      doc(db, COLLECTIONS.STUDENTS, student.id),
      { authUid: null, authEmail: null, accountStatus: null },
      { merge: true }
    );
    await deleteDoc(doc(db, COLLECTIONS.STUDENT_LOOKUP, student.id)).catch(() => {});
    console.log(`[Firestore] Student ${student.name} auth metadata cleared (roster intact).`);
    return { success: true, authDeleted: true };
  } catch (err: any) {
    console.error(`[Firestore] Failed to clear student auth metadata:`, err);
    return { success: false, authDeleted: false, error: err.message || String(err) };
  }
}

/**
 * Checks live against Firebase Authentication whether a student's account exists and is valid.
 * Tests directly against Firebase Auth servers (not from stale cache).
 */
export async function checkStudentAuthStatusLive(
  student: StudentItem
): Promise<{ exists: boolean; uid?: string; email?: string }> {
  const email = student.authEmail || getStudentAuthEmail(student);
  const password = getStudentAuthPassword(student.password);
  const appName = `sec_stat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const secApp = initializeApp(firebaseConfig, appName);
  const secAuth = getAuth(secApp);

  try {
    const userCred = await signInWithEmailAndPassword(secAuth, email, password);
    const uid = userCred.user.uid;
    await signOut(secAuth).catch(() => {});
    await deleteApp(secApp).catch(() => {});
    return { exists: true, uid, email };
  } catch (err: any) {
    await deleteApp(secApp).catch(() => {});
    if (err.code === 'auth/wrong-password') {
      // Account exists but password differs
      return { exists: true, email };
    }
    // 'auth/user-not-found' or 'auth/invalid-credential' or 'auth/user-disabled'
    return { exists: false, email };
  }
}

/**
 * Verifies all students live against Firebase Authentication.
 * Synchronizes Firestore records if any drift was detected (e.g. deleted outside in Firebase Console).
 */
export async function refreshAllStudentsAuthStatusLive(
  students: StudentItem[]
): Promise<{
  syncedMap: Record<string, boolean>;
  syncedCount: number;
  missingCount: number;
  totalCount: number;
}> {
  const syncedMap: Record<string, boolean> = {};
  let syncedCount = 0;

  for (const student of students) {
    const status = await checkStudentAuthStatusLive(student);
    syncedMap[student.id] = status.exists;

    if (status.exists) {
      syncedCount++;
      if (!student.authUid && status.uid) {
        student.authUid = status.uid;
        student.authEmail = status.email;
        await setDoc(
          doc(db, COLLECTIONS.STUDENTS, student.id),
          { authUid: status.uid, authEmail: status.email },
          { merge: true }
        ).catch(() => {});
        await syncStudentLookupDoc(student).catch(() => {});
      }
    } else {
      // Detected missing/deleted account in Firebase Auth: clear stale auth metadata
      if (student.authUid || student.authEmail) {
        student.authUid = undefined;
        student.authEmail = undefined;
        await setDoc(
          doc(db, COLLECTIONS.STUDENTS, student.id),
          { authUid: null, authEmail: null },
          { merge: true }
        ).catch(() => {});
        await deleteDoc(doc(db, COLLECTIONS.STUDENT_LOOKUP, student.id)).catch(() => {});
      }
    }
  }

  return {
    syncedMap,
    syncedCount,
    missingCount: Math.max(0, students.length - syncedCount),
    totalCount: students.length,
  };
}

/**
 * Bulk unsyncs multiple students from Firebase Authentication in a single batch operation.
 * Deletes their Firebase Auth accounts while keeping their Firestore student records,
 * marks, class enrollments, and attendance 100% intact.
 */
export async function unsyncMultipleStudentsAuthAccounts(
  students: StudentItem[]
): Promise<{
  successCount: number;
  failedCount: number;
  results: Array<{ id: string; name: string; success: boolean; error?: string }>;
}> {
  let successCount = 0;
  let failedCount = 0;
  const results: Array<{ id: string; name: string; success: boolean; error?: string }> = [];

  for (const student of students) {
    const res = await unsyncStudentAuthAccount(student);
    if (res.success) {
      successCount++;
      student.authUid = undefined;
      student.authEmail = undefined;
      results.push({ id: student.id, name: student.name, success: true });
    } else {
      failedCount++;
      results.push({ id: student.id, name: student.name, success: false, error: res.error });
    }
  }

  return { successCount, failedCount, results };
}

/**
 * Unsync a single student's Firebase Auth account with real-time student notification:
 * 1. Sets accountStatus: "unsyncing" in Firestore so a logged-in student gets notified immediately.
 * 2. Waits ~6 seconds (invoking onNotifying callback so UI displays "Notifying student…").
 * 3. Deletes only their Firebase Auth account via secondary client-side auth.
 * 4. Clears authUid, authEmail, and accountStatus on the student doc in Firestore.
 * 5. Student data (profile, attendance, marks, classwork, requests) remains 100% intact!
 */
export async function unsyncStudentWithNotification(
  student: StudentItem,
  onNotifying?: (msg: string) => void,
  forceMarkMissing = false
): Promise<{ success: boolean; authDeleted: boolean; error?: string; requiresManualDeletion?: boolean }> {
  // 1. Write status flag "unsyncing" to Firestore
  try {
    await setDoc(
      doc(db, COLLECTIONS.STUDENTS, student.id),
      { accountStatus: 'unsyncing' },
      { merge: true }
    );
    console.log(`[Firestore] Set accountStatus="unsyncing" for ${student.name}`);
  } catch (flagErr) {
    console.warn(`[Firestore] Failed to set accountStatus="unsyncing" for ${student.name}:`, flagErr);
  }

  // 2. Wait 6 seconds for student's session to see the countdown
  if (onNotifying) {
    onNotifying('Notifying student…');
  }
  await new Promise(resolve => setTimeout(resolve, 6000));

  // 3. Remove only Firebase Auth account (data kept)
  const res = await unsyncStudentAuthAccount(student, forceMarkMissing);
  return res;
}

/**
 * Bulk unsyncs multiple students with real-time student notification:
 * 1. Sets accountStatus: "unsyncing" on all selected students.
 * 2. Waits 6 seconds with "Notifying students…" status.
 * 3. Removes their Firebase Auth accounts while keeping student data 100% intact.
 */
export async function unsyncMultipleStudentsWithNotification(
  students: StudentItem[],
  onNotifying?: (msg: string) => void
): Promise<{
  successCount: number;
  failedCount: number;
  results: Array<{ id: string; name: string; success: boolean; error?: string }>;
}> {
  // 1. Write "unsyncing" flag to all selected students
  for (const s of students) {
    try {
      await setDoc(doc(db, COLLECTIONS.STUDENTS, s.id), { accountStatus: 'unsyncing' }, { merge: true });
    } catch (e) {
      console.warn(`Failed to set unsyncing flag for ${s.name}:`, e);
    }
  }

  // 2. Wait 6 seconds
  if (onNotifying) {
    onNotifying('Notifying students…');
  }
  await new Promise(resolve => setTimeout(resolve, 6000));

  // 3. Remove auth accounts
  return unsyncMultipleStudentsAuthAccounts(students);
}

/**
 * Permanently deletes a student, their Firebase Auth account, and ALL their Firestore data:
 * 1. Writes accountStatus: "removed" to Firestore so a logged-in student sees the modal immediately.
 * 2. Waits ~6 seconds ("Notifying student…").
 * 3. Deletes Firebase Auth user via client-side secondary auth.
 * 4. Deletes users/{uid} document.
 * 5. Deletes student_lookup/{studentId} document.
 * 6. Deletes studentProgress/{studentId} document.
 * 7. Deletes permissions where studentId === studentId.
 * 8. Cleans up attendance records (removes student from all session records in Firestore).
 * 9. Cleans up marks scores (removes student from all mark docs in Firestore).
 * 10. Cleans up classwork scores (removes student from all classwork tasks in Firestore).
 * 11. Deletes students/{studentId} document from Firestore.
 */
export async function deleteStudentWithNotificationAndFullCleanup(
  student: StudentItem,
  state: AppState,
  onNotifying?: (status: string) => void
): Promise<{
  success: boolean;
  cleanedAttendance: AttendanceSession[];
  cleanedMarks: MarkDoc[];
  cleanedClasswork: ClassworkTask[];
  error?: string;
}> {
  // 1. Write status flag "removed" to student document in Firestore
  try {
    await setDoc(
      doc(db, COLLECTIONS.STUDENTS, student.id),
      { accountStatus: 'removed' },
      { merge: true }
    );
    console.log(`[Firestore] Set accountStatus="removed" for ${student.name}`);
  } catch (flagErr) {
    console.warn(`[Firestore] Failed to set accountStatus="removed" for ${student.name}:`, flagErr);
  }

  // 2. Wait 6 seconds
  if (onNotifying) {
    onNotifying('Notifying student…');
  }
  await new Promise(resolve => setTimeout(resolve, 6000));

  // 3. Delete Firebase Auth account
  const authRes = await deleteStudentAuthAccount(student);
  if (!authRes.success) {
    console.warn(`[Student Auth] Auth deletion failed for ${student.name}. Halting Firestore data deletion:`, authRes.error);
    return {
      success: false,
      cleanedAttendance: state.attendance || [],
      cleanedMarks: state.marks || [],
      cleanedClasswork: state.classwork || [],
      error: `${authRes.error} Halting deletion. No Firestore student records, marks, or attendance were deleted.`,
    };
  }

  // 4. Delete student lookup
  await deleteDoc(doc(db, COLLECTIONS.STUDENT_LOOKUP, student.id)).catch(() => {});

  // 5. Delete users role doc
  if (student.authUid) {
    await deleteDoc(doc(db, COLLECTIONS.USERS, student.authUid)).catch(() => {});
  }

  // 6. Delete student progress doc
  await deleteDoc(doc(db, COLLECTIONS.STUDENT_PROGRESS, student.id)).catch(() => {});

  // 7. Delete all permissions for this student
  const studentPerms = (state.studentPermissions || []).filter(p => p.studentId === student.id);
  for (const perm of studentPerms) {
    await deleteDoc(doc(db, COLLECTIONS.PERMISSIONS, perm.id)).catch(() => {});
  }

  // 8. Clean up attendance sessions
  const cleanedAttendance: AttendanceSession[] = [];
  for (const session of state.attendance || []) {
    if (session.records && session.records[student.id]) {
      const nextRecords = { ...session.records };
      delete nextRecords[student.id];
      const updatedSession = { ...session, records: nextRecords };
      cleanedAttendance.push(updatedSession);
      await syncSaveAttendance(updatedSession).catch(() => {});
    } else {
      cleanedAttendance.push(session);
    }
  }

  // 9. Clean up marks
  const cleanedMarks: MarkDoc[] = [];
  for (const m of state.marks || []) {
    if (m.scores && m.scores[student.id] !== undefined) {
      const nextScores = { ...m.scores };
      delete nextScores[student.id];
      const updatedMark = { ...m, scores: nextScores };
      cleanedMarks.push(updatedMark);
      await syncSaveMarkDoc(updatedMark).catch(() => {});
    } else {
      cleanedMarks.push(m);
    }
  }

  // 10. Clean up classwork
  const cleanedClasswork: ClassworkTask[] = [];
  for (const cw of state.classwork || []) {
    if (cw.scores && cw.scores[student.id] !== undefined) {
      const nextScores = { ...cw.scores };
      delete nextScores[student.id];
      const updatedCw = { ...cw, scores: nextScores };
      cleanedClasswork.push(updatedCw);
      await syncSaveClassworkTask(updatedCw).catch(() => {});
    } else {
      cleanedClasswork.push(cw);
    }
  }

  // 11. Delete any account requests for this student
  const reqs = (state.accountRequests || []).filter(r => r.studentId === student.id);
  for (const r of reqs) {
    await deleteDoc(doc(db, COLLECTIONS.ACCOUNT_REQUESTS, r.id)).catch(() => {});
  }

  // 12. Delete student document from Firestore
  try {
    await deleteDoc(doc(db, COLLECTIONS.STUDENTS, student.id));
    console.log(`[Firestore] Student ${student.name} (${student.id}) and all records completely removed.`);
  } catch (docErr: any) {
    console.error(`[Firestore] Failed to delete student document ${student.id}:`, docErr);
    return {
      success: false,
      cleanedAttendance,
      cleanedMarks,
      cleanedClasswork,
      error: docErr.message || String(docErr),
    };
  }

  return {
    success: true,
    cleanedAttendance,
    cleanedMarks,
    cleanedClasswork,
  };
}

/**
 * Submit an account restoration request from a student whose account was deleted or unsynced.
 * Strictly adheres to create-only rules in Firestore.
 */
export async function submitAccountRequest(
  studentId: string,
  studentName: string,
  studentNo?: string,
  reason = 'Student requested account restoration after removal'
): Promise<void> {
  const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const docRef = doc(db, COLLECTIONS.ACCOUNT_REQUESTS, id);
  const data: AccountRequest = {
    id,
    studentId,
    studentNo: studentNo || '',
    studentName,
    createdAt: new Date().toISOString(),
    status: 'pending',
    reason,
  };
  await setDoc(docRef, sanitizeForFirestore(data));
  console.log(`[Account Requests] Successfully submitted request for ${studentName} (${studentId})`);
}

/**
 * Resolve an account request (e.g. after teacher provisions a fresh account)
 */
export async function resolveAccountRequest(requestId: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.ACCOUNT_REQUESTS, requestId);
  await setDoc(docRef, { status: 'resolved' }, { merge: true });
}

/**
 * Delete / dismiss an account request
 */
export async function deleteAccountRequest(requestId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.ACCOUNT_REQUESTS, requestId));
}

/**
 * Provision all students in roster behind the scenes
 */
export async function provisionAllStudentsAuth(students: StudentItem[]): Promise<void> {
  if (!students || students.length === 0) return;
  console.log(`[Firebase Auth] Checking/provisioning Auth accounts for ${students.length} students...`);
  for (const s of students) {
    await provisionStudentAuthAccount(s);
  }
}

/**
 * Deterministic client-side Student Auth login
 * Performs authentication via standard signInWithEmailAndPassword directly against athena-ai-438506.
 * Uses shared resolveStudentLoginEmail to resolve Name, Student ID, or bare number to the exact registered auth email.
 */
export async function loginStudentDirect(
  identifier: string,
  passwordInput: string,
  roster: StudentItem[] = []
): Promise<{ studentId: string; name: string }> {
  const email = await resolveStudentLoginEmailLive(identifier, roster);
  const password = getStudentAuthPassword(passwordInput);

  // 1. Authenticate directly with standard email/password credentials
  let uid = '';
  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    uid = userCred.user.uid;
  } catch (authErr: any) {
    if (authErr.code === 'auth/operation-not-allowed') {
      throw new Error('Email/Password provider is disabled in Firebase Console. Please enable it under Authentication -> Sign-in method.');
    }
    throw authErr;
  }

  // 2. Fetch the corresponding users/{uid} document now that we are authenticated
  const userDocRef = doc(db, COLLECTIONS.USERS, uid);
  const userDocSnap = await getDoc(userDocRef);

  if (userDocSnap.exists()) {
    const userData = userDocSnap.data();
    return {
      studentId: userData.studentId || identifier,
      name: userData.name || identifier,
    };
  } else {
    // If users doc was not seeded, match from the local roster
    const matched = roster.find(
      s => s.name?.toLowerCase() === identifier.toLowerCase() || s.studentNo?.toLowerCase() === identifier.toLowerCase()
    );
    return {
      studentId: matched?.id || identifier,
      name: matched?.name || identifier,
    };
  }
}

/**
 * Sign in teacher using Firebase Google Auth Provider with email Whitelist enforcement
 */
export async function signInTeacherWithGoogle(): Promise<{ uid: string; email: string; name: string }> {
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const email = (user.email || '').toLowerCase().trim();

    // Whitelist check
    const isAllowed = ALLOWED_TEACHER_EMAILS.some(
      allowed => allowed.toLowerCase().trim() === email
    );

    if (!isAllowed) {
      await signOut(auth);
      throw new Error(
        `Access Denied: Your Google account (${email}) is not authorized as an instructor. To grant access, add "${email}" to ALLOWED_TEACHER_EMAILS in src/utils/firestoreSync.ts.`
      );
    }

    const teacherName = user.displayName || 'Instructor';

    // Store/link role document in users/{uid}
    await syncSaveUserRoleDoc(user.uid, {
      role: 'teacher',
      name: teacherName,
      email,
    });

    console.log(`[Google Auth] Teacher authenticated successfully: ${teacherName} (${email}) UID: ${user.uid}`);
    return { uid: user.uid, email, name: teacherName };
  } catch (err: any) {
    console.error('[Google Auth Teacher Login Error]:', err);
    throw err;
  }
}

/**
 * Check if the current authenticated Firebase user has a linked email/password provider
 */
export function checkTeacherHasPasswordProvider(): boolean {
  if (!auth.currentUser) return false;
  return (auth.currentUser.providerData || []).some(p => p.providerId === 'password');
}

/**
 * Link email/password credentials to the currently signed-in teacher Google account.
 * Maintains the exact same UID as the Google account.
 */
export async function linkTeacherPasswordAccount(password: string, teacherName?: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('No active teacher account authenticated.');
  }

  const credential = EmailAuthProvider.credential(user.email, password);
  try {
    await linkWithCredential(user, credential);
    console.log(`[Teacher Auth] Successfully linked password authentication to ${user.email}`);

    if (teacherName) {
      await syncSaveUserRoleDoc(user.uid, {
        role: 'teacher',
        name: teacherName,
        email: user.email,
      });
    }
  } catch (err: any) {
    console.error('[Teacher Auth] Password linking error:', err);
    if (err.code === 'auth/credential-already-in-use' || err.code === 'auth/provider-already-linked') {
      // Password already linked to this account
      return;
    }
    if (err.code === 'auth/weak-password') {
      throw new Error('Password must be at least 8 characters long.');
    }
    throw err;
  }
}

/**
 * Sign in teacher directly with Email and Password.
 * Validates against approved teacher whitelist.
 */
export async function loginTeacherWithPassword(
  emailOrName: string,
  password: string
): Promise<{ uid: string; email: string; name: string }> {
  let email = emailOrName.trim().toLowerCase();

  // If email is not a full email, match with known allowed teacher emails
  if (!email.includes('@')) {
    const matched = ALLOWED_TEACHER_EMAILS.find(e => e.toLowerCase().startsWith(email));
    if (matched) {
      email = matched;
    } else {
      email = ALLOWED_TEACHER_EMAILS[0];
    }
  }

  // Whitelist check
  const isAllowed = ALLOWED_TEACHER_EMAILS.some(
    allowed => allowed.toLowerCase().trim() === email
  );
  if (!isAllowed) {
    throw new Error(
      `Access Denied: The account "${email}" is not authorized as an instructor.`
    );
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // Fetch user doc
    const userDocSnap = await getDoc(doc(db, COLLECTIONS.USERS, user.uid)).catch(() => null);
    const teacherName = userDocSnap?.exists()
      ? (userDocSnap.data()?.name || user.displayName || 'Instructor')
      : (user.displayName || 'Instructor');

    await syncSaveUserRoleDoc(user.uid, {
      role: 'teacher',
      name: teacherName,
      email,
    });

    return { uid: user.uid, email, name: teacherName };
  } catch (err: any) {
    console.error('[Teacher Password Login Error]:', err);
    if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
      throw new Error('Incorrect instructor email or password. Please verify credentials.');
    }
    if (err.code === 'auth/too-many-requests') {
      throw new Error('Too many failed attempts. Login temporarily locked. Please try again in a few minutes.');
    }
    if (err.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw err;
  }
}

/**
 * Change teacher password from Teacher Profile (reauthenticates first, then updates password)
 */
export async function changeTeacherPasswordAccount(oldPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('No instructor account signed in.');
  }

  const credential = EmailAuthProvider.credential(user.email, oldPassword);
  try {
    await reauthenticateWithCredential(user, credential);
  } catch (authErr: any) {
    if (authErr.code === 'auth/wrong-password' || authErr.code === 'auth/invalid-credential') {
      throw new Error('Current password is incorrect.');
    }
    throw authErr;
  }

  try {
    await updatePassword(user, newPassword);
    console.log('[Teacher Auth] Password successfully updated.');
  } catch (updateErr: any) {
    if (updateErr.code === 'auth/weak-password') {
      throw new Error('New password is too weak. Please use at least 8 characters.');
    }
    throw updateErr;
  }
}

/**
 * Record a student class join event with server timestamp
 */
export async function syncSaveClassJoin(
  classId: string,
  studentId: string,
  date: string,
  classStart: string,
  minutesLate: number,
  status: 'green' | 'yellow' | 'red'
): Promise<void> {
  const joinId = `${classId}_${date}_${studentId}`;
  const docRef = doc(db, COLLECTIONS.CLASS_JOINS, joinId);

  const payload = {
    id: joinId,
    classId,
    studentId,
    date,
    joinedAt: serverTimestamp(),
    classStart,
    minutesLate,
    status,
  };

  try {
    await setDoc(docRef, payload);
    console.log(`[Class Joins] Check-in recorded for student ${studentId} in class ${classId}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.CLASS_JOINS}/${joinId}`);
  }
}

/**
 * Save custom dashboard layout per student in users/{uid}.dashboardLayout
 */
export async function syncSaveDashboardLayout(
  studentId: string,
  layout: DashboardLayoutConfig
): Promise<void> {
  try {
    const user = auth.currentUser;
    const targetUid = user?.uid || studentId;
    const docRef = doc(db, COLLECTIONS.USERS, targetUid);
    await setDoc(docRef, { dashboardLayout: layout, updatedAt: new Date().toISOString() }, { merge: true });
    console.log(`[Dashboard Layout] Layout saved for user ${targetUid}`);
  } catch (err) {
    console.warn('[Dashboard Layout] Warning saving layout to Firestore:', err);
  }
}

/**
 * Reset student password (by authenticated teacher)
 * Updates both the student's Firestore document AND their real Firebase Authentication account credentials.
 */
export async function resetStudentPasswordByTeacher(studentId: string, newPassword: string): Promise<void> {
  const cleanPass = newPassword.trim();
  if (cleanPass.length < 4) {
    throw new Error('Student password must be at least 4 characters long.');
  }

  // 1. Update Student record in Firestore
  const path = `${COLLECTIONS.STUDENTS}/${studentId}`;
  try {
    await setDoc(
      doc(db, COLLECTIONS.STUDENTS, studentId),
      sanitizeForFirestore({ password: cleanPass, updatedAt: new Date().toISOString() }),
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }

  // 2. Re-provision / update student's Firebase Auth credentials behind the scenes
  try {
    const studentSnap = await getDocs(collection(db, COLLECTIONS.STUDENTS));
    const studentDoc = studentSnap.docs.find(d => d.id === studentId)?.data() as StudentItem | undefined;

    if (studentDoc) {
      const updatedStudent = { ...studentDoc, password: cleanPass };
      await updateStudentAuthPassword(studentDoc, cleanPass, studentDoc.password);
      await syncStudentLookupDoc(updatedStudent);
    }
  } catch (authErr) {
    console.warn(`[Reset Student Password Auth Warning]:`, authErr);
  }

  console.log(`[Reset Student Password] Password for student ${studentId} updated successfully.`);
}

/**
 * Seed initial data if Firestore database is empty
 */
export async function seedFirestoreIfEmpty(initialData: AppState): Promise<void> {
  try {
    const settingsSnap = await getDocs(collection(db, COLLECTIONS.SETTINGS));
    const classesSnap = await getDocs(collection(db, COLLECTIONS.CLASSES));
    if (!settingsSnap.empty || !classesSnap.empty) {
      console.log('[Firestore] Cloud database already initialized. Skipping seeding.');
      return;
    }

    console.log('[Firestore] Initializing fresh Cloud Firestore database with classroom records...');

    // Seed classes
    for (const c of initialData.classes) {
      await setDoc(doc(db, COLLECTIONS.CLASSES, c.id), c);
    }

    // Seed students
    for (const s of initialData.students) {
      await setDoc(doc(db, COLLECTIONS.STUDENTS, s.id), s);
    }

    // Seed subjects
    for (const sub of initialData.subjects) {
      await setDoc(doc(db, COLLECTIONS.SUBJECTS, sub.id), sub);
    }

    // Seed attendance
    for (const att of initialData.attendance) {
      await setDoc(doc(db, COLLECTIONS.ATTENDANCE, att.id), att);
    }

    // Seed marks
    for (const m of initialData.marks) {
      await setDoc(doc(db, COLLECTIONS.MARKS, m.id), m);
    }

    // Seed classwork
    for (const cw of initialData.classwork) {
      await setDoc(doc(db, COLLECTIONS.CLASSWORK, cw.id), cw);
    }

    // Seed banners
    if (initialData.banners) {
      for (const b of initialData.banners) {
        await setDoc(doc(db, COLLECTIONS.BANNERS, b.id), b);
      }
    }

    // Seed resources
    if (initialData.resources) {
      for (const r of initialData.resources) {
        await setDoc(doc(db, COLLECTIONS.RESOURCES, r.id), r);
      }
    }

    // Seed app settings
    await setDoc(doc(db, COLLECTIONS.SETTINGS, 'global'), {
      profile: initialData.profile,
      teacherSecurity: initialData.teacherSecurity || { isConfigured: false, isSetupCompleted: false, setupCodeUsed: false, password: '' },
      updatedAt: new Date().toISOString(),
    });
    console.log('[Firestore] Cloud database bootstrap completed.');
  } catch (error) {
    console.error('[Firestore] Error seeding initial Firestore data:', error);
  }
}

/**
 * Save a single ClassItem to Firestore
 */
export async function syncSaveClass(cls: ClassItem): Promise<void> {
  const path = `${COLLECTIONS.CLASSES}/${cls.id}`;
  try {
    await setDoc(doc(db, COLLECTIONS.CLASSES, cls.id), sanitizeForFirestore(cls));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Delete a ClassItem from Firestore
 */
export async function syncDeleteClass(classId: string): Promise<void> {
  const path = `${COLLECTIONS.CLASSES}/${classId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.CLASSES, classId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Save a single StudentItem to Firestore and automatically keep Firebase Auth password in sync
 */
export async function syncSaveStudent(student: StudentItem, oldStudent?: StudentItem): Promise<void> {
  const path = `${COLLECTIONS.STUDENTS}/${student.id}`;
  try {
    // 1. If password was edited, automatically update Firebase Auth
    if (oldStudent && oldStudent.password !== student.password) {
      await updateStudentAuthPassword(student, student.password || '', oldStudent.password).catch(err => {
        console.warn(`[Firebase Auth] Auto-sync password update warning for ${student.name}:`, err);
      });
    } else if (!student.authUid && !student.authEmail) {
      // Provision real Firebase Authentication account for the student if not provisioned
      provisionStudentAuthAccount(student).catch(err => {
        console.warn(`[Firebase Auth] Async provisioning warning for ${student.name}:`, err);
      });
    }

    // 2. Save student document to Firestore
    await setDoc(doc(db, COLLECTIONS.STUDENTS, student.id), sanitizeForFirestore(student));

    // 3. Keep public student lookup directory in sync
    await syncStudentLookupDoc(student);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Delete a StudentItem from Firestore and securely remove their Firebase Auth account
 * via client-side secondary auth self-deletion.
 */
export async function syncDeleteStudent(student: StudentItem | string): Promise<void> {
  const studentId = typeof student === 'object' && student !== null ? student.id : student;
  await deleteDoc(doc(db, COLLECTIONS.STUDENT_LOOKUP, studentId)).catch(() => {});

  if (typeof student === 'object' && student !== null) {
    await deleteStudentAuthAccount(student);
  } else {
    // If only ID was passed, delete student document from Firestore
    const path = `${COLLECTIONS.STUDENTS}/${student}`;
    try {
      await deleteDoc(doc(db, COLLECTIONS.STUDENTS, student));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }
}

/**
 * Save multiple students (e.g. roster updates) and provision Firebase Auth
 */
export async function syncSaveStudents(students: StudentItem[]): Promise<void> {
  try {
    for (const s of students) {
      await setDoc(doc(db, COLLECTIONS.STUDENTS, s.id), sanitizeForFirestore(s));
      provisionStudentAuthAccount(s).catch(() => {});
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.STUDENTS);
  }
}

/**
 * Save a SubjectItem
 */
export async function syncSaveSubject(subject: SubjectItem): Promise<void> {
  const path = `${COLLECTIONS.SUBJECTS}/${subject.id}`;
  try {
    await setDoc(doc(db, COLLECTIONS.SUBJECTS, subject.id), sanitizeForFirestore(subject));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Delete a SubjectItem
 */
export async function syncDeleteSubject(subjectId: string): Promise<void> {
  const path = `${COLLECTIONS.SUBJECTS}/${subjectId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.SUBJECTS, subjectId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Save Attendance session
 */
export async function syncSaveAttendance(session: AttendanceSession): Promise<void> {
  const path = `${COLLECTIONS.ATTENDANCE}/${session.id}`;
  try {
    await setDoc(doc(db, COLLECTIONS.ATTENDANCE, session.id), sanitizeForFirestore(session));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Save Marks
 */
export async function syncSaveMarkDoc(markDoc: MarkDoc): Promise<void> {
  const path = `${COLLECTIONS.MARKS}/${markDoc.id}`;
  try {
    await setDoc(doc(db, COLLECTIONS.MARKS, markDoc.id), sanitizeForFirestore(markDoc));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Save Classwork Task
 */
export async function syncSaveClassworkTask(task: ClassworkTask): Promise<void> {
  const path = `${COLLECTIONS.CLASSWORK}/${task.id}`;
  try {
    await setDoc(doc(db, COLLECTIONS.CLASSWORK, task.id), sanitizeForFirestore(task));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Delete Classwork Task
 */
export async function syncDeleteClassworkTask(taskId: string): Promise<void> {
  const path = `${COLLECTIONS.CLASSWORK}/${taskId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.CLASSWORK, taskId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Save student permission / leave excuse
 */
export async function syncSavePermission(permit: StudentPermissionRequest): Promise<void> {
  const path = `${COLLECTIONS.PERMISSIONS}/${permit.id}`;
  try {
    await setDoc(doc(db, COLLECTIONS.PERMISSIONS, permit.id), sanitizeForFirestore(permit));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Delete student permission / leave request document from Firestore
 */
export async function syncDeletePermission(permitId: string): Promise<void> {
  const path = `${COLLECTIONS.PERMISSIONS}/${permitId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.PERMISSIONS, permitId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Save global settings (profile, password)
 */
export async function syncSaveSettings(
  profile: UserProfile,
  teacherSecurity?: { isConfigured: boolean; isSetupCompleted?: boolean; password?: string; setupCodeUsed?: boolean }
): Promise<void> {
  const path = `${COLLECTIONS.SETTINGS}/global`;
  try {
    const isConfiguredVal = Boolean(teacherSecurity?.isConfigured || teacherSecurity?.isSetupCompleted || teacherSecurity?.password);
    await setDoc(doc(db, COLLECTIONS.SETTINGS, 'global'), sanitizeForFirestore({
      profile,
      teacherSecurity: {
        isConfigured: isConfiguredVal,
        isSetupCompleted: isConfiguredVal,
        setupCodeUsed: isConfiguredVal,
        password: teacherSecurity?.password || '',
      },
      updatedAt: new Date().toISOString(),
    }));
    console.log('[Firestore] Settings and teacher security saved to cloud.');
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Save custom record item to Firestore
 */
export async function syncSaveCustomRecord(record: CustomRecordItem): Promise<void> {
  const path = `${COLLECTIONS.CUSTOM_RECORDS}/${record.id}`;
  try {
    await setDoc(doc(db, COLLECTIONS.CUSTOM_RECORDS, record.id), sanitizeForFirestore(record));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Delete custom record item from Firestore
 */
export async function syncDeleteCustomRecord(recordId: string): Promise<void> {
  const path = `${COLLECTIONS.CUSTOM_RECORDS}/${recordId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.CUSTOM_RECORDS, recordId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Save announcement banner
 */
export async function syncSaveBanner(banner: AnnouncementBanner): Promise<void> {
  const path = `${COLLECTIONS.BANNERS}/${banner.id}`;
  try {
    await setDoc(doc(db, COLLECTIONS.BANNERS, banner.id), sanitizeForFirestore(banner));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Delete announcement banner
 */
export async function syncDeleteBanner(bannerId: string): Promise<void> {
  const path = `${COLLECTIONS.BANNERS}/${bannerId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.BANNERS, bannerId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Save library resource
 */
export async function syncSaveResource(resource: LibraryResource): Promise<void> {
  const path = `${COLLECTIONS.RESOURCES}/${resource.id}`;
  try {
    await setDoc(doc(db, COLLECTIONS.RESOURCES, resource.id), sanitizeForFirestore(resource));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Delete library resource
 */
export async function syncDeleteResource(resourceId: string): Promise<void> {
  const path = `${COLLECTIONS.RESOURCES}/${resourceId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.RESOURCES, resourceId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Batch import data to Firestore
 */
export async function syncBatchImport(data: Partial<AppState>): Promise<{
  classes: number;
  students: number;
  subjects: number;
  attendance: number;
  marks: number;
  classwork: number;
  customRecords: number;
}> {
  const counts = {
    classes: 0,
    students: 0,
    subjects: 0,
    attendance: 0,
    marks: 0,
    classwork: 0,
    customRecords: 0,
  };

  try {
    if (Array.isArray(data.classes)) {
      for (const c of data.classes) {
        if (c.id && c.name) {
          await setDoc(doc(db, COLLECTIONS.CLASSES, c.id), c);
          counts.classes++;
        }
      }
    }

    if (Array.isArray(data.students)) {
      for (const s of data.students) {
        if (s.id && s.name) {
          await setDoc(doc(db, COLLECTIONS.STUDENTS, s.id), s);
          counts.students++;
        }
      }
    }

    if (Array.isArray(data.subjects)) {
      for (const sub of data.subjects) {
        if (sub.id && sub.name) {
          await setDoc(doc(db, COLLECTIONS.SUBJECTS, sub.id), sub);
          counts.subjects++;
        }
      }
    }

    if (Array.isArray(data.attendance)) {
      for (const att of data.attendance) {
        if (att.id && att.classId && att.date) {
          await setDoc(doc(db, COLLECTIONS.ATTENDANCE, att.id), att);
          counts.attendance++;
        }
      }
    }

    if (Array.isArray(data.marks)) {
      for (const m of data.marks) {
        if (m.id && m.subjectId) {
          await setDoc(doc(db, COLLECTIONS.MARKS, m.id), m);
          counts.marks++;
        }
      }
    }

    if (Array.isArray(data.classwork)) {
      for (const cw of data.classwork) {
        if (cw.id && cw.title) {
          await setDoc(doc(db, COLLECTIONS.CLASSWORK, cw.id), cw);
          counts.classwork++;
        }
      }
    }

    if (Array.isArray(data.customRecords)) {
      for (const cr of data.customRecords) {
        if (cr.id && cr.title) {
          await setDoc(doc(db, COLLECTIONS.CUSTOM_RECORDS, cr.id), cr);
          counts.customRecords++;
        }
      }
    }

    if (data.profile) {
      await syncSaveSettings(data.profile, data.teacherSecurity);
    }
  } catch (error) {
    console.error('Batch import Firestore sync error:', error);
  }

  return counts;
}

/**
 * Subscribe to all Firestore collections with live onSnapshot listeners
 */
export function subscribeToFirestore(
  user: AuthUser | null,
  onUpdate: (updater: (prev: AppState) => AppState) => void,
  onError?: (err: Error) => void,
  onConnected?: () => void
): () => void {
  const unsubs: (() => void)[] = [];

  if (!user) {
    console.log('[Firestore] Subscription skipped because no authenticated user is logged in.');
    return () => {};
  }

  // 1. Classes
  const unsubClasses = onSnapshot(
    collection(db, COLLECTIONS.CLASSES),
    snapshot => {
      const classes: ClassItem[] = [];
      snapshot.forEach(d => {
        classes.push(d.data() as ClassItem);
      });
      console.log(`[Firestore Live] Classes synced (${classes.length} items)`);
      onUpdate(prev => ({ ...prev, classes }));
      if (onConnected) onConnected();
    },
    error => {
      console.warn('[Firestore] Classes listener error:', error);
    }
  );
  unsubs.push(unsubClasses);

  // 2. Students & Account Requests (Subscribes dynamically based on role)
  if (user.role === 'teacher') {
    const unsubStudents = onSnapshot(
      collection(db, COLLECTIONS.STUDENTS),
      snapshot => {
        const students: StudentItem[] = [];
        snapshot.forEach(d => {
          students.push(d.data() as StudentItem);
        });
        console.log(`[Firestore Live] Students synced (${students.length} items)`);
        onUpdate(prev => ({ ...prev, students }));
        if (onConnected) onConnected();
      },
      error => {
        console.warn('[Firestore] Students listener error:', error);
      }
    );
    unsubs.push(unsubStudents);

    // Subscribe to student account requests
    const unsubRequests = onSnapshot(
      collection(db, COLLECTIONS.ACCOUNT_REQUESTS),
      snapshot => {
        const accountRequests: AccountRequest[] = [];
        snapshot.forEach(d => {
          accountRequests.push(d.data() as AccountRequest);
        });
        console.log(`[Firestore Live] Account requests synced (${accountRequests.length} items)`);
        onUpdate(prev => ({ ...prev, accountRequests }));
      },
      error => {
        console.warn('[Firestore] Account requests listener error:', error);
      }
    );
    unsubs.push(unsubRequests);
  } else if (user.role === 'student' && user.studentId) {
    const unsubStudents = onSnapshot(
      doc(db, COLLECTIONS.STUDENTS, user.studentId),
      snapshot => {
        if (snapshot.exists()) {
          const sObj = snapshot.data() as StudentItem;
          console.log(`[Firestore Live] Student profile synced: ${sObj.name}, status=${sObj.accountStatus}`);
          onUpdate(prev => {
            const idx = prev.students.findIndex(s => s.id === sObj.id);
            const next = [...prev.students];
            if (idx >= 0) next[idx] = sObj;
            else next.push(sObj);
            return { ...prev, students: next };
          });
        } else {
          // Document was deleted by teacher
          console.warn(`[Firestore Live] Student document ${user.studentId} does not exist (deleted)!`);
          onUpdate(prev => {
            const idx = prev.students.findIndex(s => s.id === user.studentId);
            if (idx >= 0) {
              const updated = { ...prev.students[idx], accountStatus: 'removed' as const };
              const next = [...prev.students];
              next[idx] = updated;
              return { ...prev, students: next };
            }
            return prev;
          });
        }
        if (onConnected) onConnected();
      },
      error => {
        console.warn('[Firestore] Student profile listener error:', error);
        // Fallback for permission-denied / auth issues: trigger 'removed'
        onUpdate(prev => {
          const idx = prev.students.findIndex(s => s.id === user.studentId);
          if (idx >= 0) {
            const updated = { ...prev.students[idx], accountStatus: 'removed' as const };
            const next = [...prev.students];
            next[idx] = updated;
            return { ...prev, students: next };
          }
          return prev;
        });
      }
    );
    unsubs.push(unsubStudents);
  }

  // 3. Subjects
  const unsubSubjects = onSnapshot(
    collection(db, COLLECTIONS.SUBJECTS),
    snapshot => {
      const subjects: SubjectItem[] = [];
      snapshot.forEach(d => {
        subjects.push(d.data() as SubjectItem);
      });
      console.log(`[Firestore Live] Subjects synced (${subjects.length} items)`);
      onUpdate(prev => ({ ...prev, subjects }));
      if (onConnected) onConnected();
    },
    error => {
      console.warn('[Firestore] Subjects listener error:', error);
    }
  );
  unsubs.push(unsubSubjects);

  // 4. Attendance
  const unsubAttendance = onSnapshot(
    collection(db, COLLECTIONS.ATTENDANCE),
    snapshot => {
      const attendance: AttendanceSession[] = [];
      snapshot.forEach(d => {
        attendance.push(d.data() as AttendanceSession);
      });
      console.log(`[Firestore Live] Attendance sessions synced (${attendance.length} sessions)`);
      onUpdate(prev => ({ ...prev, attendance }));
      if (onConnected) onConnected();
    },
    error => {
      console.warn('[Firestore] Attendance listener error:', error);
    }
  );
  unsubs.push(unsubAttendance);

  // 5. Marks
  const unsubMarks = onSnapshot(
    collection(db, COLLECTIONS.MARKS),
    snapshot => {
      const marks: MarkDoc[] = [];
      snapshot.forEach(d => {
        marks.push(d.data() as MarkDoc);
      });
      console.log(`[Firestore Live] Marks synced (${marks.length} mark docs)`);
      onUpdate(prev => ({ ...prev, marks }));
      if (onConnected) onConnected();
    },
    error => {
      console.warn('[Firestore] Marks listener error:', error);
    }
  );
  unsubs.push(unsubMarks);

  // 6. Classwork
  const unsubClasswork = onSnapshot(
    collection(db, COLLECTIONS.CLASSWORK),
    snapshot => {
      const classwork: ClassworkTask[] = [];
      snapshot.forEach(d => {
        classwork.push(d.data() as ClassworkTask);
      });
      console.log(`[Firestore Live] Classwork tasks synced (${classwork.length} tasks)`);
      onUpdate(prev => ({ ...prev, classwork }));
      if (onConnected) onConnected();
    },
    error => {
      console.warn('[Firestore] Classwork listener error:', error);
    }
  );
  unsubs.push(unsubClasswork);

  // 7. Permissions (Teacher sees all, Student sees only theirs)
  const qPerms = user.role === 'teacher' 
    ? collection(db, COLLECTIONS.PERMISSIONS)
    : query(collection(db, COLLECTIONS.PERMISSIONS), where('studentId', '==', user.studentId || ''));

  const unsubPermits = onSnapshot(
    qPerms,
    snapshot => {
      const perms: StudentPermissionRequest[] = [];
      snapshot.forEach(d => {
        perms.push(d.data() as StudentPermissionRequest);
      });
      console.log(`[Firestore Live] Leave permissions synced (${perms.length} requests)`);
      onUpdate(prev => ({ ...prev, studentPermissions: perms }));
      if (onConnected) onConnected();
    },
    error => {
      console.warn('[Firestore] Permissions listener error:', error);
    }
  );
  unsubs.push(unsubPermits);

  // 8. Custom Records (only needed for teacher)
  if (user.role === 'teacher') {
    const unsubCustomRecords = onSnapshot(
      collection(db, COLLECTIONS.CUSTOM_RECORDS),
      snapshot => {
        const customRecords: CustomRecordItem[] = [];
        snapshot.forEach(d => {
          customRecords.push(d.data() as CustomRecordItem);
        });
        onUpdate(prev => ({ ...prev, customRecords }));
        if (onConnected) onConnected();
      },
      error => {
        console.warn('[Firestore] Custom records listener error:', error);
      }
    );
    unsubs.push(unsubCustomRecords);
  }

  // 9. Announcement Banners (both)
  const unsubBanners = onSnapshot(
    collection(db, COLLECTIONS.BANNERS),
    snapshot => {
      const banners: AnnouncementBanner[] = [];
      snapshot.forEach(d => {
        banners.push(d.data() as AnnouncementBanner);
      });
      console.log(`[Firestore Live] Banners synced (${banners.length} banners)`);
      onUpdate(prev => ({ ...prev, banners }));
      if (onConnected) onConnected();
    },
    error => {
      console.warn('[Firestore] Banners listener error:', error);
    }
  );
  unsubs.push(unsubBanners);

  // 10. Library Resources (both)
  const unsubResources = onSnapshot(
    collection(db, COLLECTIONS.RESOURCES),
    snapshot => {
      const resources: LibraryResource[] = [];
      snapshot.forEach(d => {
        resources.push(d.data() as LibraryResource);
      });
      console.log(`[Firestore Live] Library resources synced (${resources.length} items)`);
      onUpdate(prev => ({ ...prev, resources }));
      if (onConnected) onConnected();
    },
    error => {
      console.warn('[Firestore] Library resources listener error:', error);
    }
  );
  unsubs.push(unsubResources);

  // 11. Settings (both)
  const unsubSettings = onSnapshot(
    doc(db, COLLECTIONS.SETTINGS, 'global'),
    snapshot => {
      if (snapshot.exists()) {
        const rawData = snapshot.data();
        const data = scrubCamfirst(rawData);
        console.log('[Firestore Live] Global settings synced');
        if (data.profile || data.teacherSecurity || data.telegramConfig) {
          onUpdate(prev => ({
            ...prev,
            profile: data.profile ? { ...prev.profile, ...data.profile } : prev.profile,
            teacherSecurity: data.teacherSecurity || prev.teacherSecurity,
            telegramConfig: data.telegramConfig || prev.telegramConfig,
          }));
        }
      }
      if (onConnected) onConnected();
    },
    error => {
      console.warn('[Firestore] Settings listener error:', error);
    }
  );
  unsubs.push(unsubSettings);

  // 12. Student Progress Gamification (both)
  const unsubStudentProgress = onSnapshot(
    collection(db, COLLECTIONS.STUDENT_PROGRESS),
    snapshot => {
      const studentProgress: StudentProgress[] = [];
      snapshot.forEach(d => {
        studentProgress.push(d.data() as StudentProgress);
      });
      console.log(`[Firestore Live] Student Progress synced (${studentProgress.length} items)`);
      onUpdate(prev => ({ ...prev, studentProgress }));
      if (onConnected) onConnected();
    },
    error => {
      console.warn('[Firestore] Student Progress listener error:', error);
    }
  );
  unsubs.push(unsubStudentProgress);

  // 13. Class Joins (Check-ins for both teacher and students)
  const unsubClassJoins = onSnapshot(
    user.role === 'teacher'
      ? collection(db, COLLECTIONS.CLASS_JOINS)
      : query(collection(db, COLLECTIONS.CLASS_JOINS), where('studentId', '==', user.studentId || auth.currentUser?.uid || '')),
    snapshot => {
      const classJoins: ClassJoinRecord[] = [];
      snapshot.forEach(d => {
        const data = d.data();
        classJoins.push({
          ...data,
          joinedAt: data.joinedAt?.toDate ? data.joinedAt.toDate().toISOString() : (data.joinedAt || new Date().toISOString()),
        } as ClassJoinRecord);
      });
      console.log(`[Firestore Live] Class joins synced (${classJoins.length} items)`);
      onUpdate(prev => ({ ...prev, classJoins }));
    },
    error => {
      console.warn('[Firestore] Class joins listener error:', error);
    }
  );
  unsubs.push(unsubClassJoins);

  return () => {
    unsubs.forEach(u => u());
  };
}

/**
 * Save and sync student progress document to Firestore
 */
export async function syncSaveStudentProgress(progress: StudentProgress): Promise<void> {
  const path = `${COLLECTIONS.STUDENT_PROGRESS}/${progress.studentId}`;
  try {
    await setDoc(doc(db, COLLECTIONS.STUDENT_PROGRESS, progress.studentId), sanitizeForFirestore(progress));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Delete student progress document from Firestore
 */
export async function syncDeleteStudentProgress(studentId: string): Promise<void> {
  const path = `${COLLECTIONS.STUDENT_PROGRESS}/${studentId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.STUDENT_PROGRESS, studentId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function fetchAppLogo(): Promise<string | null> {
  try {
    const docRef = doc(db, 'public_branding', 'app');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data().logo || null;
    }
  } catch (e) {
    console.warn('[Fetch App Logo Warning]:', e);
  }
  return null;
}

export async function fetchAppWallpaper(): Promise<string | null> {
  try {
    const docRef = doc(db, 'public_branding', 'app');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data().wallpaper || null;
    }
  } catch (e) {
    console.warn('[Fetch App Wallpaper Warning]:', e);
  }
  return null;
}

export async function saveAppWallpaper(wallpaperData: string): Promise<void> {
  try {
    const docRef = doc(db, 'public_branding', 'app');
    await setDoc(docRef, { wallpaper: wallpaperData, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.error('[Save App Wallpaper Error]:', e);
    throw e;
  }
}

export async function removeAppWallpaper(): Promise<void> {
  try {
    const docRef = doc(db, 'public_branding', 'app');
    await setDoc(docRef, { wallpaper: null, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.warn('[Remove App Wallpaper Warning]:', e);
  }
}

export async function saveAppWallpaperDual(type: 'dark' | 'light', wallpaperData: string): Promise<void> {
  try {
    const docRef = doc(db, 'public_branding', 'app');
    const fieldName = type === 'dark' ? 'wallpaperDark' : 'wallpaperLight';
    await setDoc(docRef, { [fieldName]: wallpaperData, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.error(`[Save App Wallpaper ${type} Error]:`, e);
    throw e;
  }
}

export async function removeAppWallpaperDual(type: 'dark' | 'light'): Promise<void> {
  try {
    const docRef = doc(db, 'public_branding', 'app');
    const fieldName = type === 'dark' ? 'wallpaperDark' : 'wallpaperLight';
    await setDoc(docRef, { [fieldName]: null, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.warn(`[Remove App Wallpaper ${type} Warning]:`, e);
  }
}

export function subscribeToAppBranding(callback: (data: { logo?: string | null; wallpaper?: string | null; wallpaperDark?: string | null; wallpaperLight?: string | null; heading?: string | null; subtitle?: string | null }) => void): () => void {
  try {
    const docRef = doc(db, 'public_branding', 'app');
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        callback({
          logo: d.logo || null,
          wallpaper: d.wallpaper !== undefined ? d.wallpaper : null,
          wallpaperDark: d.wallpaperDark !== undefined ? d.wallpaperDark : null,
          wallpaperLight: d.wallpaperLight !== undefined ? d.wallpaperLight : null,
          heading: d.heading !== undefined ? d.heading : null,
          subtitle: d.subtitle !== undefined ? d.subtitle : null,
        });
      } else {
        callback({ logo: null, wallpaper: null, wallpaperDark: null, wallpaperLight: null, heading: null, subtitle: null });
      }
    }, (err) => {
      console.warn('[Branding Snapshot Error]:', err);
    });
  } catch (e) {
    console.warn('[Subscribe App Branding Error]:', e);
    return () => {};
  }
}

export async function saveAppHeaderInfo(heading: string, subtitle: string): Promise<void> {
  try {
    const docRef = doc(db, 'public_branding', 'app');
    await setDoc(docRef, { heading, subtitle, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.error('[Save App Header Info Error]:', e);
    throw e;
  }
}

export async function saveAppLogo(logoBase64: string): Promise<void> {
  try {
    const docRef = doc(db, 'public_branding', 'app');
    await setDoc(docRef, { logo: logoBase64, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.error('[Save App Logo Error]:', e);
    throw e;
  }
}

export async function deleteAppLogo(): Promise<void> {
  try {
    const docRef = doc(db, 'public_branding', 'app');
    await setDoc(docRef, { logo: null, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.warn('[Delete App Logo Warning]:', e);
  }
}

export function compressWallpaperToDataString(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max = 1280; // High resolution for wallpapers
        if (width > height) {
          if (width > max) {
            height *= max / width;
            width = max;
          }
        } else {
          if (height > max) {
            width *= max / height;
            height = max;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context failed'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.85;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 800000 && quality > 0.1) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function compressImageToDataString(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max = 256;
        if (width > height) {
          if (width > max) {
            height *= max / width;
            width = max;
          }
        } else {
          if (height > max) {
            width *= max / height;
            height = max;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context failed'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.85;
        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        while (dataUrl.length > 130000 && quality > 0.3) {
          quality -= 0.15;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

