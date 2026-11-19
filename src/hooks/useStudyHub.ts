import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import defaultQuestionsRaw from '../data/questions.json';
import extraQuestionsRaw from '../data/extraQuestions.json';
import defaultUnitsRaw from '../data/defaultUnits.json';
import kanjiDataRaw from '../data/kanjiData.json';
import vocabWordsRaw from '../data/vocabWords.json';
import {
  ALL_SUBJECTS,
  AppModuleId,
  AppSettings,
  DailyMissionPlan,
  DailyStatus,
  FirebaseConfigData,
  KanjiCategory,
  KanjiItem,
  MissionType,
  Question,
  StudyLog,
  StudyProgress,
  Subject,
  SyncConnectionState,
  TimetableConfig,
  Unit,
  VocabWord,
  WeekdayKey,
} from '../types/quiz';
import {
  addCustomKanjiToCloud,
  addCustomQuestionsToCloud,
  addCustomUnitsToCloud,
  addCustomVocabToCloud,
  deleteCustomUnitFromCloud,
  flushSyncQueue,
  generateDefaultFamilyId,
  getSyncQueue,
  initFirebase,
  isValidFamilyId,
  loadFirebaseConfig,
  loadSavedFamilyId,
  pushStudyLog,
  saveFamilyId,
  saveFamilySettings,
  saveFirebaseConfig,
  subscribeFamilyData,
  upsertDailyStatus,
} from '../services/firebaseService';

const STORAGE_PROGRESS = 'quickexam_progress_v1';
const STORAGE_SETTINGS = 'quickexam_settings_v1';
const STORAGE_CUSTOM_UNITS = 'quickexam_custom_units_v1';
const STORAGE_CUSTOM_QUESTIONS = 'quickexam_custom_questions_v1';
const STORAGE_CUSTOM_KANJI = 'quickexam_custom_kanji_v1';
const STORAGE_CUSTOM_VOCAB = 'quickexam_custom_vocab_v1';
const STORAGE_STUDY_LOGS = 'quickexam_study_logs_v1';
const STORAGE_DAILY_STATUS = 'quickexam_daily_status_v1';
const STORAGE_KANJI_WEAK = 'quickexam_kanji_weak_v1';
const STORAGE_VOCAB_WEAK = 'quickexam_vocab_weak_v1';

const WEEKDAY_ORDER: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: '月曜',
  tue: '火曜',
  wed: '水曜',
  thu: '木曜',
  fri: '金曜',
  sat: '土曜',
  sun: '日曜',
};

const DEFAULT_TIMETABLE: TimetableConfig = {
  mon: ['英語', '数学', '国語'],
  tue: ['理科', '歴史', '英語'],
  wed: ['数学', '地理', '国語'],
  thu: ['英語', '理科', '歴史'],
  fri: ['数学', '地理', '国語'],
  sat: [],
  sun: [],
};

const DEFAULT_CURRENT_UNITS: Record<Subject, string> = {
  英語: 'eng-4',
  数学: 'math-3',
  理科: 'sci-3',
  歴史: 'hist-3',
  地理: 'geo-2',
  国語: 'jpn-3',
};

const DEFAULT_SETTINGS: AppSettings = {
  studentName: '中2生',
  timetable: DEFAULT_TIMETABLE,
  currentUnitBySubject: DEFAULT_CURRENT_UNITS,
  dailyTargets: {
    reviewCount: 5,
    previewCount: 5,
    kanjiCount: 5,
    vocabCount: 10,
  },
  parentPin: '0000',
};

const INITIAL_PROGRESS: StudyProgress = {
  totalAnswered: 0,
  totalCorrect: 0,
  records: {},
  wrongQuestionIds: [],
  recentSessions: [],
};

export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, offset: number): Date {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + offset);
  return copy;
}

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonStorage<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function useStudyHub() {
  const [progress, setProgress] = useState<StudyProgress>(() => {
    const parsed = readJsonStorage<Partial<StudyProgress>>(STORAGE_PROGRESS, {});
    return {
      ...INITIAL_PROGRESS,
      ...parsed,
      records: parsed.records || {},
      wrongQuestionIds: Array.isArray(parsed.wrongQuestionIds) ? parsed.wrongQuestionIds : [],
      recentSessions: Array.isArray(parsed.recentSessions) ? parsed.recentSessions : [],
    };
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = readJsonStorage<Partial<AppSettings>>(STORAGE_SETTINGS, {});
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      timetable: { ...DEFAULT_TIMETABLE, ...(saved.timetable || {}) },
      currentUnitBySubject: {
        ...DEFAULT_CURRENT_UNITS,
        ...(saved.currentUnitBySubject || {}),
      },
      dailyTargets: { ...DEFAULT_SETTINGS.dailyTargets, ...(saved.dailyTargets || {}) },
    };
  });

  const [customUnits, setCustomUnits] = useState<Unit[]>(() =>
    readJsonStorage<Unit[]>(STORAGE_CUSTOM_UNITS, [])
  );
  const [customQuestions, setCustomQuestions] = useState<Question[]>(() =>
    readJsonStorage<Question[]>(STORAGE_CUSTOM_QUESTIONS, [])
  );
  const [customKanji, setCustomKanji] = useState<KanjiItem[]>(() =>
    readJsonStorage<KanjiItem[]>(STORAGE_CUSTOM_KANJI, [])
  );
  const [customVocab, setCustomVocab] = useState<VocabWord[]>(() =>
    readJsonStorage<VocabWord[]>(STORAGE_CUSTOM_VOCAB, [])
  );
  const [studyLogs, setStudyLogs] = useState<StudyLog[]>(() =>
    readJsonStorage<StudyLog[]>(STORAGE_STUDY_LOGS, [])
  );
  const [dailyStatusMap, setDailyStatusMap] = useState<Record<string, DailyStatus>>(() =>
    readJsonStorage<Record<string, DailyStatus>>(STORAGE_DAILY_STATUS, {})
  );
  const dailyStatusMapRef = useRef(dailyStatusMap);
  dailyStatusMapRef.current = dailyStatusMap;
  const [kanjiWeakIds, setKanjiWeakIds] = useState<string[]>(() =>
    readJsonStorage<string[]>(STORAGE_KANJI_WEAK, [])
  );
  const [vocabWeakIds, setVocabWeakIds] = useState<string[]>(() =>
    readJsonStorage<string[]>(STORAGE_VOCAB_WEAK, [])
  );

  // Firebase state
  const [familyId, setFamilyId] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paramFamily = urlParams.get('family')?.trim();
    if (paramFamily && isValidFamilyId(paramFamily)) {
      saveFamilyId(paramFamily);
      return paramFamily;
    }
    const existing = loadSavedFamilyId();
    if (existing) return existing;
    const generated = generateDefaultFamilyId();
    saveFamilyId(generated);
    return generated;
  });
  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConfigData | null>(() =>
    loadFirebaseConfig()
  );
  const [syncState, setSyncState] = useState<SyncConnectionState>(() =>
    loadFirebaseConfig() ? 'connecting' : 'unconfigured'
  );
  const [syncError, setSyncError] = useState<string>('');
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() => getSyncQueue().length);

  // Persist local states
  useEffect(() => writeJsonStorage(STORAGE_PROGRESS, progress), [progress]);
  useEffect(() => writeJsonStorage(STORAGE_SETTINGS, settings), [settings]);
  useEffect(() => writeJsonStorage(STORAGE_CUSTOM_UNITS, customUnits), [customUnits]);
  useEffect(() => writeJsonStorage(STORAGE_CUSTOM_QUESTIONS, customQuestions), [customQuestions]);
  useEffect(() => writeJsonStorage(STORAGE_CUSTOM_KANJI, customKanji), [customKanji]);
  useEffect(() => writeJsonStorage(STORAGE_CUSTOM_VOCAB, customVocab), [customVocab]);
  useEffect(() => writeJsonStorage(STORAGE_STUDY_LOGS, studyLogs), [studyLogs]);
  useEffect(() => writeJsonStorage(STORAGE_DAILY_STATUS, dailyStatusMap), [dailyStatusMap]);
  useEffect(() => writeJsonStorage(STORAGE_KANJI_WEAK, kanjiWeakIds), [kanjiWeakIds]);
  useEffect(() => writeJsonStorage(STORAGE_VOCAB_WEAK, vocabWeakIds), [vocabWeakIds]);

  // Firebase initialization & real-time subscription
  useEffect(() => {
    let unsubscribe = () => {};
    let cancelled = false;

    async function connect() {
      if (!firebaseConfig) {
        setSyncState('unconfigured');
        setSyncError('');
        return;
      }
      setSyncState('connecting');
      const res = await initFirebase(firebaseConfig);
      if (cancelled) return;
      setSyncState(res.state);
      setSyncError(res.error || '');

      if (res.state === 'connected' && isValidFamilyId(familyId)) {
        await flushSyncQueue(familyId);
        if (!cancelled) {
          setPendingSyncCount(getSyncQueue().length);
        }

        unsubscribe = subscribeFamilyData(familyId, {
          onSettings: (cloudSettings) => {
            setSettings((prev) => ({
              ...prev,
              ...cloudSettings,
              timetable: { ...prev.timetable, ...(cloudSettings.timetable || {}) },
              currentUnitBySubject: {
                ...prev.currentUnitBySubject,
                ...(cloudSettings.currentUnitBySubject || {}),
              },
              dailyTargets: { ...prev.dailyTargets, ...(cloudSettings.dailyTargets || {}) },
            }));
          },
          onUnits: (cloudUnits) => {
            setCustomUnits(cloudUnits);
          },
          onQuestions: (cloudQuestions) => {
            setCustomQuestions(cloudQuestions);
          },
          onKanji: (cloudKanji) => {
            setCustomKanji(cloudKanji);
          },
          onVocab: (cloudVocab) => {
            setCustomVocab(cloudVocab);
          },
          onStudyLogs: (cloudLogs) => {
            setStudyLogs((prev) => {
              const map = new Map<string, StudyLog>();
              for (const log of prev) map.set(log.id, log);
              for (const log of cloudLogs) map.set(log.id, log);
              return Array.from(map.values())
                .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
                .slice(0, 150);
            });
          },
          onDailyStatuses: (cloudStatuses) => {
            setDailyStatusMap((prev) => {
              const next = { ...prev };
              for (const st of cloudStatuses) {
                const existing = next[st.dateKey];
                if (!existing) {
                  next[st.dateKey] = st;
                } else {
                  next[st.dateKey] = {
                    dateKey: st.dateKey,
                    reviewDone: existing.reviewDone || st.reviewDone,
                    previewDone: existing.previewDone || st.previewDone,
                    kanjiDone: existing.kanjiDone || st.kanjiDone,
                    vocabDone: existing.vocabDone || st.vocabDone,
                    totalAnswered: Math.max(existing.totalAnswered || 0, st.totalAnswered || 0),
                    totalCorrect: Math.max(existing.totalCorrect || 0, st.totalCorrect || 0),
                    totalDurationSec: Math.max(
                      existing.totalDurationSec || 0,
                      st.totalDurationSec || 0
                    ),
                    updatedAt:
                      existing.updatedAt > st.updatedAt ? existing.updatedAt : st.updatedAt,
                  };
                }
              }
              return next;
            });
          },
          onError: (err) => {
            setSyncState(navigator.onLine ? 'error' : 'offline');
            setSyncError(err.message);
          },
        });
      }
    }

    connect();

    const handleOnline = async () => {
      if (firebaseConfig && isValidFamilyId(familyId)) {
        const res = await initFirebase(firebaseConfig);
        setSyncState(res.state);
        if (res.state === 'connected') {
          await flushSyncQueue(familyId);
          setPendingSyncCount(getSyncQueue().length);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener('online', handleOnline);
    };
  }, [firebaseConfig, familyId]);

  // Combined Units & Questions
  const allUnits = useMemo<Unit[]>(() => {
    const defaults = defaultUnitsRaw as Unit[];
    const merged = new Map<string, Unit>();
    for (const u of defaults) merged.set(u.id, u);
    for (const u of customUnits) merged.set(u.id, { ...u, isCustom: true });
    return Array.from(merged.values()).sort((a, b) => a.order - b.order);
  }, [customUnits]);

  const allQuestions = useMemo<Question[]>(() => {
    const legacyCategoryMap = new Map<string, string>();
    for (const u of allUnits) {
      if (u.legacyCategories) {
        for (const cat of u.legacyCategories) {
          legacyCategoryMap.set(`${u.subject}::${cat}`, u.id);
        }
      }
    }

    const base = [...(defaultQuestionsRaw as Question[]), ...(extraQuestionsRaw as Question[])].map(
      (q) => {
        if (q.unitId) return q;
        const mappedUnitId = legacyCategoryMap.get(`${q.subject}::${q.category}`);
        return mappedUnitId ? { ...q, unitId: mappedUnitId } : q;
      }
    );

    const map = new Map<string, Question>();
    for (const q of base) map.set(q.id, q);
    for (const q of customQuestions) map.set(q.id, { ...q, isCustom: true });
    return Array.from(map.values());
  }, [allUnits, customQuestions]);

  // Kanji Categories & Items
  const kanjiCategories = useMemo<KanjiCategory[]>(() => {
    const base = (kanjiDataRaw as { categories: KanjiCategory[] }).categories;
    const hasCustom = customKanji.length > 0;
    if (!hasCustom) return base;
    return [
      {
        id: 'custom_kanji',
        title: `カメラ・追加漢字（${customKanji.length}字）`,
        description: customKanji.map((k) => k.kanji).slice(0, 18).join('・'),
        icon: '📷',
        isCustom: true,
      },
      ...base,
    ];
  }, [customKanji]);

  const allKanjiItems = useMemo<KanjiItem[]>(() => {
    const base = (kanjiDataRaw as { items: KanjiItem[] }).items;
    const map = new Map<string, KanjiItem>();
    for (const k of base) map.set(k.id, k);
    for (const k of customKanji) map.set(k.id, { ...k, isCustom: true });
    return Array.from(map.values());
  }, [customKanji]);

  // Vocab Words
  const allVocabWords = useMemo<VocabWord[]>(() => {
    const base = vocabWordsRaw as VocabWord[];
    const map = new Map<string, VocabWord>();
    for (const w of base) map.set(w.id, w);
    for (const w of customVocab) map.set(w.id, { ...w, isCustom: true });
    return Array.from(map.values());
  }, [customVocab]);

  // Daily Mission Plan Calculation
  const dailyMissionPlan = useMemo<DailyMissionPlan>(() => {
    const now = new Date();
    const todayWeekday = WEEKDAY_ORDER[now.getDay()];
    const todaySubjectsRaw = settings.timetable[todayWeekday] || [];
    const todaySubjects: Subject[] =
      todaySubjectsRaw.length > 0 ? todaySubjectsRaw : ALL_SUBJECTS;

    // Find next school day for tomorrow preview (skip empty weekend days)
    let tomorrowDate = addDays(now, 1);
    let tomorrowWeekday = WEEKDAY_ORDER[tomorrowDate.getDay()];
    let tomorrowSubjects = settings.timetable[tomorrowWeekday] || [];
    if (tomorrowSubjects.length === 0) {
      for (let i = 2; i <= 7; i++) {
        const candidateDate = addDays(now, i);
        const candidateKey = WEEKDAY_ORDER[candidateDate.getDay()];
        const candidateSubjects = settings.timetable[candidateKey] || [];
        if (candidateSubjects.length > 0) {
          tomorrowWeekday = candidateKey;
          tomorrowSubjects = candidateSubjects;
          break;
        }
      }
      if (tomorrowSubjects.length === 0) {
        tomorrowSubjects = ALL_SUBJECTS;
      }
    }

    // Determine review units (current unit of today's subjects)
    const reviewUnits: Unit[] = [];
    for (const subj of todaySubjects) {
      const subjUnits = allUnits.filter((u) => u.subject === subj);
      const currentId = settings.currentUnitBySubject[subj];
      const found = subjUnits.find((u) => u.id === currentId) || subjUnits[0];
      if (found) reviewUnits.push(found);
    }

    // Determine preview units (next unit after current unit of tomorrow's subjects)
    const previewUnits: Unit[] = [];
    for (const subj of tomorrowSubjects) {
      const subjUnits = allUnits.filter((u) => u.subject === subj);
      const currentId = settings.currentUnitBySubject[subj];
      const currIdx = subjUnits.findIndex((u) => u.id === currentId);
      const nextUnit =
        currIdx >= 0 && currIdx + 1 < subjUnits.length
          ? subjUnits[currIdx + 1]
          : subjUnits[currIdx >= 0 ? currIdx : 0];
      if (nextUnit) previewUnits.push(nextUnit);
    }

    // Pick Review Questions (current units + wrong questions prioritized)
    const reviewUnitIds = new Set(reviewUnits.map((u) => u.id));
    const reviewCandidates = allQuestions.filter(
      (q) =>
        (q.unitId && reviewUnitIds.has(q.unitId)) ||
        progress.wrongQuestionIds.includes(q.id)
    );
    const reviewPrioritized = [
      ...shuffleArray(
        reviewCandidates.filter(
          (q) => progress.wrongQuestionIds.includes(q.id) || !progress.records[q.id]?.lastCorrect
        )
      ),
      ...shuffleArray(
        reviewCandidates.filter(
          (q) => !progress.wrongQuestionIds.includes(q.id) && progress.records[q.id]?.lastCorrect
        )
      ),
    ];
    let reviewQuestions = reviewPrioritized.slice(0, settings.dailyTargets.reviewCount);
    if (reviewQuestions.length < settings.dailyTargets.reviewCount) {
      const usedIds = new Set(reviewQuestions.map((q) => q.id));
      const fallback = shuffleArray(
        allQuestions.filter(
          (q) => !usedIds.has(q.id) && todaySubjects.includes(q.subject)
        )
      );
      reviewQuestions = [
        ...reviewQuestions,
        ...fallback.slice(0, settings.dailyTargets.reviewCount - reviewQuestions.length),
      ];
    }

    // Pick Preview Questions (next units, unanswered first)
    const previewUnitIds = new Set(previewUnits.map((u) => u.id));
    const previewCandidates = allQuestions.filter(
      (q) => q.unitId && previewUnitIds.has(q.unitId)
    );
    const previewPrioritized = [
      ...shuffleArray(previewCandidates.filter((q) => !progress.records[q.id])),
      ...shuffleArray(previewCandidates.filter((q) => Boolean(progress.records[q.id]))),
    ];
    let previewQuestions = previewPrioritized.slice(0, settings.dailyTargets.previewCount);
    if (previewQuestions.length < settings.dailyTargets.previewCount) {
      const usedIds = new Set(previewQuestions.map((q) => q.id));
      const fallback = shuffleArray(
        allQuestions.filter(
          (q) => !usedIds.has(q.id) && tomorrowSubjects.includes(q.subject)
        )
      );
      previewQuestions = [
        ...previewQuestions,
        ...fallback.slice(0, settings.dailyTargets.previewCount - previewQuestions.length),
      ];
    }

    // Pick Kanji Mission Items (custom & weak prioritized)
    const kanjiPool = [
      ...shuffleArray(allKanjiItems.filter((k) => kanjiWeakIds.includes(k.id))),
      ...shuffleArray(
        allKanjiItems.filter((k) => !kanjiWeakIds.includes(k.id) && k.isCustom)
      ),
      ...shuffleArray(
        allKanjiItems.filter((k) => !kanjiWeakIds.includes(k.id) && !k.isCustom)
      ),
    ];
    const kanjiItems = kanjiPool.slice(0, settings.dailyTargets.kanjiCount);

    // Pick Vocab Mission Words (custom + jhs2 + weak prioritized)
    const vocabWeakSet = new Set(vocabWeakIds);
    const vocabPool = [
      ...shuffleArray(allVocabWords.filter((w) => vocabWeakSet.has(w.id))),
      ...shuffleArray(
        allVocabWords.filter((w) => !vocabWeakSet.has(w.id) && w.category === 'custom')
      ),
      ...shuffleArray(
        allVocabWords.filter((w) => !vocabWeakSet.has(w.id) && w.category === 'jhs2')
      ),
      ...shuffleArray(
        allVocabWords.filter(
          (w) => !vocabWeakSet.has(w.id) && w.category !== 'custom' && w.category !== 'jhs2'
        )
      ),
    ];
    const vocabWords = vocabPool.slice(0, settings.dailyTargets.vocabCount);

    return {
      dateKey: getLocalDateKey(now),
      todayWeekday,
      todayWeekdayLabel: WEEKDAY_LABELS[todayWeekday],
      tomorrowWeekday,
      tomorrowWeekdayLabel: WEEKDAY_LABELS[tomorrowWeekday],
      todaySubjects,
      tomorrowSubjects,
      reviewUnits,
      previewUnits,
      reviewQuestions,
      previewQuestions,
      kanjiItems,
      vocabWords,
    };
  }, [
    allUnits,
    allQuestions,
    allKanjiItems,
    allVocabWords,
    settings,
    progress.records,
    progress.wrongQuestionIds,
    kanjiWeakIds,
    vocabWeakIds,
  ]);

  const todayStatus: DailyStatus = useMemo(() => {
    const key = getLocalDateKey();
    return (
      dailyStatusMap[key] || {
        dateKey: key,
        reviewDone: false,
        previewDone: false,
        kanjiDone: false,
        vocabDone: false,
        totalAnswered: 0,
        totalCorrect: 0,
        totalDurationSec: 0,
        updatedAt: '',
      }
    );
  }, [dailyStatusMap]);

  const streakDays = useMemo(() => {
    const hasActivity = (st?: DailyStatus) =>
      Boolean(st && (st.reviewDone || st.previewDone || st.kanjiDone || st.vocabDone || st.totalAnswered > 0));
    const today = new Date();
    let count = 0;
    const todayKey = getLocalDateKey(today);
    const startOffset = hasActivity(dailyStatusMap[todayKey]) ? 0 : 1;

    for (let i = startOffset; i < 365; i++) {
      const key = getLocalDateKey(addDays(today, -i));
      if (hasActivity(dailyStatusMap[key])) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [dailyStatusMap]);

  // Actions
  const recordAnswer = useCallback((questionId: string, isCorrect: boolean) => {
    setProgress((prev) => {
      const existing = prev.records[questionId] || {
        attempts: 0,
        correct: 0,
        lastCorrect: false,
        lastAttemptedAt: '',
      };

      const updatedRecord = {
        attempts: existing.attempts + 1,
        correct: existing.correct + (isCorrect ? 1 : 0),
        lastCorrect: isCorrect,
        lastAttemptedAt: new Date().toISOString(),
      };

      let nextWrongIds = [...prev.wrongQuestionIds];
      if (!isCorrect) {
        if (!nextWrongIds.includes(questionId)) {
          nextWrongIds.push(questionId);
        }
      } else {
        nextWrongIds = nextWrongIds.filter((id) => id !== questionId);
      }

      return {
        ...prev,
        totalAnswered: prev.totalAnswered + 1,
        totalCorrect: prev.totalCorrect + (isCorrect ? 1 : 0),
        records: {
          ...prev.records,
          [questionId]: updatedRecord,
        },
        wrongQuestionIds: nextWrongIds,
      };
    });
  }, []);

  const recordSessionLog = useCallback(
    async (params: {
      appId: AppModuleId;
      missionType: MissionType;
      subject: Subject | '漢字' | '英単語';
      unitTitle: string;
      score: number;
      total: number;
      durationSec: number;
      wrongIds?: string[];
    }) => {
      const now = new Date();
      const dateKey = getLocalDateKey(now);
      const completedAt = now.toISOString();
      const safeScore = Math.max(0, Math.round(params.score));
      const safeTotal = Math.max(1, Math.round(params.total));
      const log: StudyLog = {
        id: `${params.appId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        appId: params.appId,
        missionType: params.missionType,
        subject: params.subject,
        unitTitle: params.unitTitle,
        score: Math.min(safeScore, safeTotal),
        total: safeTotal,
        durationSec: Math.max(1, Math.round(params.durationSec)),
        dateKey,
        completedAt,
        wrongIds: params.wrongIds,
      };

      if (params.appId === 'quickexam') {
        setProgress((prev) => ({
          ...prev,
          recentSessions: [
            {
              id: log.id,
              title: params.unitTitle,
              score: log.score,
              total: log.total,
              completedAt,
            },
            ...prev.recentSessions,
          ].slice(0, 15),
        }));
      }

      setStudyLogs((prev) => [log, ...prev].slice(0, 150));

      const currentDaily = dailyStatusMapRef.current[dateKey] || {
        dateKey,
        reviewDone: false,
        previewDone: false,
        kanjiDone: false,
        vocabDone: false,
        totalAnswered: 0,
        totalCorrect: 0,
        totalDurationSec: 0,
        updatedAt: completedAt,
      };

      const nextDaily: DailyStatus = {
        dateKey,
        reviewDone: currentDaily.reviewDone || params.missionType === 'review',
        previewDone: currentDaily.previewDone || params.missionType === 'preview',
        kanjiDone: currentDaily.kanjiDone || params.appId === 'kanji' || params.missionType === 'kanji',
        vocabDone: currentDaily.vocabDone || params.appId === 'vocab' || params.missionType === 'vocab',
        totalAnswered: currentDaily.totalAnswered + log.total,
        totalCorrect: currentDaily.totalCorrect + log.score,
        totalDurationSec: currentDaily.totalDurationSec + log.durationSec,
        updatedAt: completedAt,
      };

      dailyStatusMapRef.current = {
        ...dailyStatusMapRef.current,
        [dateKey]: nextDaily,
      };
      setDailyStatusMap((prev) => ({
        ...prev,
        [dateKey]: nextDaily,
      }));

      if (firebaseConfig && isValidFamilyId(familyId)) {
        await pushStudyLog(familyId, log);
        await upsertDailyStatus(familyId, nextDaily);
        setPendingSyncCount(getSyncQueue().length);
      }
    },
    [firebaseConfig, familyId]
  );

  const updateKanjiWeakResult = useCallback((kanjiId: string, isCorrect: boolean) => {
    setKanjiWeakIds((prev) => {
      if (isCorrect) return prev.filter((id) => id !== kanjiId);
      return prev.includes(kanjiId) ? prev : [...prev, kanjiId];
    });
  }, []);

  const updateVocabWeakResult = useCallback((wordId: string, isCorrect: boolean) => {
    setVocabWeakIds((prev) => {
      if (isCorrect) return prev.filter((id) => id !== wordId);
      return prev.includes(wordId) ? prev : [...prev, wordId];
    });
  }, []);

  const updateSettings = useCallback(
    async (next: AppSettings) => {
      const updated = { ...next, updatedAt: new Date().toISOString() };
      setSettings(updated);
      if (firebaseConfig && isValidFamilyId(familyId)) {
        await saveFamilySettings(familyId, updated);
        setPendingSyncCount(getSyncQueue().length);
      }
    },
    [firebaseConfig, familyId]
  );

  const addCustomUnits = useCallback(
    async (unitsToAdd: Unit[]) => {
      setCustomUnits((prev) => {
        const map = new Map<string, Unit>();
        for (const u of prev) map.set(u.id, u);
        for (const u of unitsToAdd) map.set(u.id, { ...u, isCustom: true });
        return Array.from(map.values());
      });
      if (firebaseConfig && isValidFamilyId(familyId)) {
        await addCustomUnitsToCloud(familyId, unitsToAdd);
      }
    },
    [firebaseConfig, familyId]
  );

  const deleteCustomUnit = useCallback(
    async (unitId: string) => {
      setCustomUnits((prev) => prev.filter((u) => u.id !== unitId));
      if (firebaseConfig && isValidFamilyId(familyId)) {
        await deleteCustomUnitFromCloud(familyId, unitId);
      }
    },
    [firebaseConfig, familyId]
  );

  const addCustomQuestions = useCallback(
    async (questionsToAdd: Question[]) => {
      setCustomQuestions((prev) => {
        const map = new Map<string, Question>();
        for (const q of prev) map.set(q.id, q);
        for (const q of questionsToAdd) map.set(q.id, { ...q, isCustom: true });
        return Array.from(map.values());
      });
      if (firebaseConfig && isValidFamilyId(familyId)) {
        await addCustomQuestionsToCloud(familyId, questionsToAdd);
      }
    },
    [firebaseConfig, familyId]
  );

  const addCustomKanji = useCallback(
    async (itemsToAdd: KanjiItem[]) => {
      setCustomKanji((prev) => {
        const map = new Map<string, KanjiItem>();
        for (const k of prev) map.set(k.id, k);
        for (const k of itemsToAdd) map.set(k.id, { ...k, isCustom: true });
        return Array.from(map.values());
      });
      if (firebaseConfig && isValidFamilyId(familyId)) {
        await addCustomKanjiToCloud(familyId, itemsToAdd);
      }
    },
    [firebaseConfig, familyId]
  );

  const addCustomVocab = useCallback(
    async (wordsToAdd: VocabWord[]) => {
      setCustomVocab((prev) => {
        const map = new Map<string, VocabWord>();
        for (const w of prev) map.set(w.id, w);
        for (const w of wordsToAdd) map.set(w.id, { ...w, isCustom: true });
        return Array.from(map.values());
      });
      if (firebaseConfig && isValidFamilyId(familyId)) {
        await addCustomVocabToCloud(familyId, wordsToAdd);
      }
    },
    [firebaseConfig, familyId]
  );

  const configureFirebase = useCallback(
    async (config: FirebaseConfigData | null, nextFamilyId: string) => {
      const trimmedId = nextFamilyId.trim();
      saveFirebaseConfig(config);
      if (trimmedId) {
        saveFamilyId(trimmedId);
        setFamilyId(trimmedId);
      }
      setFirebaseConfig(config);
    },
    []
  );

  const manualSyncNow = useCallback(async () => {
    if (!firebaseConfig || !isValidFamilyId(familyId)) return 0;
    const res = await initFirebase(firebaseConfig);
    setSyncState(res.state);
    setSyncError(res.error || '');
    if (res.state === 'connected') {
      const count = await flushSyncQueue(familyId);
      setPendingSyncCount(getSyncQueue().length);
      return count;
    }
    return 0;
  }, [firebaseConfig, familyId]);

  const resetProgress = useCallback(() => {
    window.localStorage.removeItem(STORAGE_PROGRESS);
    setProgress(INITIAL_PROGRESS);
  }, []);

  return {
    progress,
    settings,
    allUnits,
    allQuestions,
    kanjiCategories,
    allKanjiItems,
    allVocabWords,
    studyLogs,
    dailyStatusMap,
    todayStatus,
    streakDays,
    dailyMissionPlan,
    kanjiWeakIds,
    vocabWeakIds,
    familyId,
    firebaseConfig,
    syncState,
    syncError,
    pendingSyncCount,
    recordAnswer,
    recordSessionLog,
    updateKanjiWeakResult,
    updateVocabWeakResult,
    updateSettings,
    addCustomUnits,
    deleteCustomUnit,
    addCustomQuestions,
    addCustomKanji,
    addCustomVocab,
    configureFirebase,
    manualSyncNow,
    resetProgress,
  };
}
