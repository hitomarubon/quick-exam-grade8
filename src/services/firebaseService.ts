import { FirebaseApp, deleteApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth, signInAnonymously } from 'firebase/auth';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import {
  AppSettings,
  DailyStatus,
  FirebaseConfigData,
  KanjiItem,
  Question,
  StudyLog,
  SyncConnectionState,
  Unit,
  VocabWord,
} from '../types/quiz';

const STORAGE_FIREBASE_CONFIG = 'quickexam_firebase_config_v1';
const STORAGE_FAMILY_ID = 'quickexam_family_id_v1';
const STORAGE_SYNC_QUEUE = 'quickexam_sync_queue_v1';

interface SyncQueueItem {
  id: string;
  kind: 'study_log' | 'daily_status' | 'settings';
  familyId: string;
  payload: unknown;
  createdAt: string;
}

interface FamilySubscriptionCallbacks {
  onSettings?: (settings: Partial<AppSettings>) => void;
  onUnits?: (units: Unit[]) => void;
  onQuestions?: (questions: Question[]) => void;
  onKanji?: (items: KanjiItem[]) => void;
  onVocab?: (words: VocabWord[]) => void;
  onStudyLogs?: (logs: StudyLog[]) => void;
  onDailyStatuses?: (statuses: DailyStatus[]) => void;
  onError?: (error: Error) => void;
}

let activeApp: FirebaseApp | null = null;
let activeDb: Firestore | null = null;
let activeAuth: Auth | null = null;
let activeConfigSignature = '';

function stripUndefined<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        cleaned[key] = stripUndefined(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

export function isValidFamilyId(familyId: string): boolean {
  return /^[a-zA-Z0-9_-]{8,64}$/.test(familyId.trim());
}

export function generateDefaultFamilyId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  for (let i = 0; i < 8; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `family_${suffix}`;
}

export function loadSavedFamilyId(): string {
  try {
    const saved = window.localStorage.getItem(STORAGE_FAMILY_ID);
    if (saved && saved.trim()) return saved.trim();
  } catch {
    // ignore
  }
  return '';
}

export function saveFamilyId(familyId: string): void {
  try {
    window.localStorage.setItem(STORAGE_FAMILY_ID, familyId.trim());
  } catch {
    // ignore
  }
}

export function loadFirebaseConfig(): FirebaseConfigData | null {
  const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  const envAppId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;
  const envAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;

  if (envApiKey && envProjectId && envAppId) {
    return {
      apiKey: envApiKey,
      authDomain: envAuthDomain || `${envProjectId}.firebaseapp.com`,
      projectId: envProjectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
      appId: envAppId,
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_FIREBASE_CONFIG);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FirebaseConfigData>;
    if (parsed.apiKey && parsed.projectId && parsed.appId) {
      return {
        apiKey: parsed.apiKey,
        authDomain: parsed.authDomain || `${parsed.projectId}.firebaseapp.com`,
        projectId: parsed.projectId,
        storageBucket: parsed.storageBucket,
        messagingSenderId: parsed.messagingSenderId,
        appId: parsed.appId,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveFirebaseConfig(config: FirebaseConfigData | null): void {
  try {
    if (!config) {
      window.localStorage.removeItem(STORAGE_FIREBASE_CONFIG);
    } else {
      window.localStorage.setItem(STORAGE_FIREBASE_CONFIG, JSON.stringify(config));
    }
  } catch {
    // ignore
  }
}

/**
 * Firebase Console のコードスニペット（const firebaseConfig = {...};）または純粋なJSONを解析する
 */
export function parseFirebaseConfigText(rawText: string): FirebaseConfigData {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('Firebase設定が空です。');
  }

  // Extract object block between { and }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('{ ... } の形式でFirebase設定を貼り付けてください。');
  }

  let objText = trimmed.slice(start, end + 1);
  // Remove trailing commas and quote unquoted JS keys
  objText = objText
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":')
    .replace(/:\s*'([^']*)'/g, ': "$1"')
    .replace(/,\s*}/g, '}');

  const parsed = JSON.parse(objText) as Partial<FirebaseConfigData>;
  if (!parsed.apiKey || !parsed.projectId || !parsed.appId) {
    throw new Error('apiKey, projectId, appId が含まれていることを確認してください。');
  }

  return {
    apiKey: String(parsed.apiKey).trim(),
    authDomain: String(parsed.authDomain || `${parsed.projectId}.firebaseapp.com`).trim(),
    projectId: String(parsed.projectId).trim(),
    storageBucket: parsed.storageBucket ? String(parsed.storageBucket).trim() : undefined,
    messagingSenderId: parsed.messagingSenderId ? String(parsed.messagingSenderId).trim() : undefined,
    appId: String(parsed.appId).trim(),
  };
}

export async function initFirebase(
  configOverride?: FirebaseConfigData
): Promise<{ state: SyncConnectionState; error?: string }> {
  const config = configOverride || loadFirebaseConfig();
  if (!config) {
    return { state: 'unconfigured' };
  }

  const signature = `${config.apiKey}|${config.projectId}|${config.appId}`;

  try {
    if (!activeApp || activeConfigSignature !== signature) {
      for (const app of getApps()) {
        await deleteApp(app);
      }
      activeApp = initializeApp(config, 'quickexam-hub');
      activeDb = getFirestore(activeApp);
      activeAuth = getAuth(activeApp);
      activeConfigSignature = signature;
    }

    if (activeAuth && !activeAuth.currentUser) {
      await signInAnonymously(activeAuth);
    }

    if (!navigator.onLine) {
      return { state: 'offline' };
    }

    return { state: 'connected' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      state: navigator.onLine ? 'error' : 'offline',
      error: message,
    };
  }
}

export async function testFirebaseConnection(
  config: FirebaseConfigData,
  familyId: string
): Promise<{ ok: boolean; message: string }> {
  if (!isValidFamilyId(familyId)) {
    return {
      ok: false,
      message: '家族IDは8〜64文字の半角英数字・ハイフン(-)・アンダースコア(_)で入力してください。',
    };
  }

  const res = await initFirebase(config);
  if (res.state !== 'connected' || !activeDb) {
    return {
      ok: false,
      message: res.error || 'Firebaseへの接続または匿名認証に失敗しました。設定を確認してください。',
    };
  }

  try {
    const snap = await getDocs(query(collection(activeDb, 'families', familyId, 'study_logs'), limit(1)));
    return {
      ok: true,
      message: `接続成功！（プロジェクト: ${config.projectId} / 既存ログ確認: ${snap.size}件取得可）`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `Firestore読み取りエラー: ${message}（Anonymous Auth有効化やfirestore.rulesの設定を確認してください）`,
    };
  }
}

// ============================================================
// オフライン送信キュー管理
// ============================================================
export function getSyncQueue(): SyncQueueItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_SYNC_QUEUE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSyncQueue(items: SyncQueueItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_SYNC_QUEUE, JSON.stringify(items.slice(-200)));
  } catch {
    // ignore
  }
}

function enqueueSyncItem(item: Omit<SyncQueueItem, 'createdAt'>): void {
  const queue = getSyncQueue();
  const filtered = queue.filter((q) => !(q.kind === item.kind && q.id === item.id));
  filtered.push({
    ...item,
    createdAt: new Date().toISOString(),
  });
  saveSyncQueue(filtered);
}

export async function pushStudyLog(familyId: string, log: StudyLog): Promise<boolean> {
  if (!familyId || !isValidFamilyId(familyId)) return false;

  if (!activeDb || !navigator.onLine) {
    enqueueSyncItem({ id: log.id, kind: 'study_log', familyId, payload: log });
    return false;
  }

  try {
    if (activeAuth && !activeAuth.currentUser) {
      await signInAnonymously(activeAuth);
    }
    await setDoc(doc(activeDb, 'families', familyId, 'study_logs', log.id), stripUndefined(log));
    return true;
  } catch {
    enqueueSyncItem({ id: log.id, kind: 'study_log', familyId, payload: log });
    return false;
  }
}

export async function upsertDailyStatus(familyId: string, dailyStatus: DailyStatus): Promise<boolean> {
  if (!familyId || !isValidFamilyId(familyId)) return false;

  if (!activeDb || !navigator.onLine) {
    enqueueSyncItem({
      id: dailyStatus.dateKey,
      kind: 'daily_status',
      familyId,
      payload: dailyStatus,
    });
    return false;
  }

  try {
    if (activeAuth && !activeAuth.currentUser) {
      await signInAnonymously(activeAuth);
    }
    await setDoc(
      doc(activeDb, 'families', familyId, 'daily_status', dailyStatus.dateKey),
      stripUndefined(dailyStatus),
      { merge: true }
    );
    return true;
  } catch {
    enqueueSyncItem({
      id: dailyStatus.dateKey,
      kind: 'daily_status',
      familyId,
      payload: dailyStatus,
    });
    return false;
  }
}

export async function saveFamilySettings(familyId: string, settings: AppSettings): Promise<boolean> {
  if (!familyId || !isValidFamilyId(familyId)) return false;

  const payload: AppSettings = {
    ...settings,
    updatedAt: new Date().toISOString(),
  };

  if (!activeDb || !navigator.onLine) {
    enqueueSyncItem({ id: 'main', kind: 'settings', familyId, payload });
    return false;
  }

  try {
    if (activeAuth && !activeAuth.currentUser) {
      await signInAnonymously(activeAuth);
    }
    await setDoc(doc(activeDb, 'families', familyId, 'settings', 'main'), stripUndefined(payload), {
      merge: true,
    });
    return true;
  } catch {
    enqueueSyncItem({ id: 'main', kind: 'settings', familyId, payload });
    return false;
  }
}

export async function flushSyncQueue(familyId: string): Promise<number> {
  if (!activeDb || !navigator.onLine || !familyId || !isValidFamilyId(familyId)) {
    return 0;
  }

  const queue = getSyncQueue();
  if (queue.length === 0) return 0;

  if (activeAuth && !activeAuth.currentUser) {
    try {
      await signInAnonymously(activeAuth);
    } catch {
      return 0;
    }
  }

  const remaining: SyncQueueItem[] = [];
  let syncedCount = 0;

  for (const item of queue) {
    const targetFamily = item.familyId || familyId;
    if (!isValidFamilyId(targetFamily)) continue;

    try {
      if (item.kind === 'study_log') {
        await setDoc(
          doc(activeDb, 'families', targetFamily, 'study_logs', item.id),
          stripUndefined(item.payload as Record<string, unknown>)
        );
      } else if (item.kind === 'daily_status') {
        await setDoc(
          doc(activeDb, 'families', targetFamily, 'daily_status', item.id),
          stripUndefined(item.payload as Record<string, unknown>),
          { merge: true }
        );
      } else if (item.kind === 'settings') {
        await setDoc(
          doc(activeDb, 'families', targetFamily, 'settings', 'main'),
          stripUndefined(item.payload as Record<string, unknown>),
          { merge: true }
        );
      }
      syncedCount++;
    } catch {
      remaining.push(item);
    }
  }

  saveSyncQueue(remaining);
  return syncedCount;
}

// ============================================================
// カスタム単元・問題・漢字・英単語の登録・削除
// ============================================================
export async function addCustomUnitsToCloud(familyId: string, units: Unit[]): Promise<void> {
  if (!activeDb || !isValidFamilyId(familyId) || units.length === 0) return;
  const batch = writeBatch(activeDb);
  for (const unit of units) {
    batch.set(doc(activeDb, 'families', familyId, 'units', unit.id), stripUndefined(unit));
  }
  await batch.commit();
}

export async function deleteCustomUnitFromCloud(familyId: string, unitId: string): Promise<void> {
  if (!activeDb || !isValidFamilyId(familyId)) return;
  await deleteDoc(doc(activeDb, 'families', familyId, 'units', unitId));
}

export async function addCustomQuestionsToCloud(
  familyId: string,
  questions: Question[]
): Promise<void> {
  if (!activeDb || !isValidFamilyId(familyId) || questions.length === 0) return;
  const batch = writeBatch(activeDb);
  for (const q of questions) {
    batch.set(doc(activeDb, 'families', familyId, 'questions', q.id), stripUndefined(q));
  }
  await batch.commit();
}

export async function addCustomKanjiToCloud(familyId: string, items: KanjiItem[]): Promise<void> {
  if (!activeDb || !isValidFamilyId(familyId) || items.length === 0) return;
  const batch = writeBatch(activeDb);
  for (const item of items) {
    batch.set(doc(activeDb, 'families', familyId, 'kanji', item.id), stripUndefined(item));
  }
  await batch.commit();
}

export async function addCustomVocabToCloud(familyId: string, words: VocabWord[]): Promise<void> {
  if (!activeDb || !isValidFamilyId(familyId) || words.length === 0) return;
  const batch = writeBatch(activeDb);
  for (const word of words) {
    batch.set(doc(activeDb, 'families', familyId, 'vocab', word.id), stripUndefined(word));
  }
  await batch.commit();
}

// ============================================================
// リアルタイム購読
// ============================================================
export function subscribeFamilyData(
  familyId: string,
  callbacks: FamilySubscriptionCallbacks
): () => void {
  if (!activeDb || !isValidFamilyId(familyId)) {
    return () => {};
  }

  const unsubscribers: Unsubscribe[] = [];
  const handleError = (err: Error) => {
    callbacks.onError?.(err);
  };

  unsubscribers.push(
    onSnapshot(
      doc(activeDb, 'families', familyId, 'settings', 'main'),
      (snap) => {
        if (snap.exists()) {
          callbacks.onSettings?.(snap.data() as Partial<AppSettings>);
        }
      },
      handleError
    )
  );

  unsubscribers.push(
    onSnapshot(
      collection(activeDb, 'families', familyId, 'units'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Unit);
        callbacks.onUnits?.(list);
      },
      handleError
    )
  );

  unsubscribers.push(
    onSnapshot(
      collection(activeDb, 'families', familyId, 'questions'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Question);
        callbacks.onQuestions?.(list);
      },
      handleError
    )
  );

  unsubscribers.push(
    onSnapshot(
      collection(activeDb, 'families', familyId, 'kanji'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as KanjiItem);
        callbacks.onKanji?.(list);
      },
      handleError
    )
  );

  unsubscribers.push(
    onSnapshot(
      collection(activeDb, 'families', familyId, 'vocab'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as VocabWord);
        callbacks.onVocab?.(list);
      },
      handleError
    )
  );

  unsubscribers.push(
    onSnapshot(
      query(
        collection(activeDb, 'families', familyId, 'study_logs'),
        orderBy('completedAt', 'desc'),
        limit(100)
      ),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as StudyLog);
        callbacks.onStudyLogs?.(list);
      },
      handleError
    )
  );

  unsubscribers.push(
    onSnapshot(
      query(
        collection(activeDb, 'families', familyId, 'daily_status'),
        orderBy('dateKey', 'desc'),
        limit(30)
      ),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as DailyStatus);
        callbacks.onDailyStatuses?.(list);
      },
      handleError
    )
  );

  return () => {
    for (const unsub of unsubscribers) {
      unsub();
    }
  };
}
