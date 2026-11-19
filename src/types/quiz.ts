export type Subject = '英語' | '数学' | '理科' | '歴史' | '地理' | '国語';

export const ALL_SUBJECTS: Subject[] = ['英語', '数学', '理科', '歴史', '地理', '国語'];

export type QuestionCountOption = 5 | 10 | 20 | 'all';

export interface Unit {
  id: string;
  subject: Subject;
  textbook: string;
  order: number;
  title: string;
  legacyCategories?: string[];
  isCustom?: boolean;
  createdAt?: string;
}

export interface Question {
  id: string;
  subject: Subject;
  category: string;
  unitId?: string;
  question: string;
  options: [string, string, string, string];
  answerIndex: number;
  explanation: string;
  isCustom?: boolean;
}

export type QuizMode =
  | { type: 'subject'; subject: Subject; count?: QuestionCountOption }
  | { type: 'unit'; unitId: string; count?: QuestionCountOption }
  | { type: 'random'; count?: QuestionCountOption }
  | { type: 'review' }
  | { type: 'retry'; questionIds: string[] }
  | { type: 'daily_review'; unitIds: string[]; count: number }
  | { type: 'daily_preview'; unitIds: string[]; count: number };

export interface QuestionRecord {
  attempts: number;
  correct: number;
  lastCorrect: boolean;
  lastAttemptedAt: string;
}

export interface SessionSummary {
  id: string;
  title: string;
  score: number;
  total: number;
  completedAt: string;
}

export interface StudyProgress {
  totalAnswered: number;
  totalCorrect: number;
  records: Record<string, QuestionRecord>;
  wrongQuestionIds: string[];
  recentSessions: SessionSummary[];
}

export interface KanjiCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  isCustom?: boolean;
}

export interface KanjiItem {
  id: string;
  categoryId: string;
  kanji: string;
  question: string;
  targetWord: string;
  targetCharReading: string;
  targetReading: string;
  on: string;
  kun: string;
  strokes: number;
  radical: string;
  hint: string;
  examples: string[];
  isCustom?: boolean;
}

export type VocabCategoryId = 'jhs1' | 'jhs2' | 'jhs3' | 'custom';

export interface VocabWord {
  id: string;
  word: string;
  meaning: string;
  partOfSpeech: string;
  category: VocabCategoryId;
  isCustom?: boolean;
}

export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type TimetableConfig = Record<WeekdayKey, Subject[]>;

export interface DailyTargets {
  reviewCount: number;
  previewCount: number;
  kanjiCount: number;
  vocabCount: number;
}

export interface AppSettings {
  studentName: string;
  timetable: TimetableConfig;
  currentUnitBySubject: Record<Subject, string>;
  dailyTargets: DailyTargets;
  parentPin: string;
  updatedAt?: string;
}

export type AppModuleId = 'quickexam' | 'kanji' | 'vocab';
export type MissionType = 'review' | 'preview' | 'kanji' | 'vocab' | 'free';

export interface StudyLog {
  id: string;
  appId: AppModuleId;
  missionType: MissionType;
  subject: Subject | '漢字' | '英単語';
  unitTitle: string;
  score: number;
  total: number;
  durationSec: number;
  dateKey: string;
  completedAt: string;
  wrongIds?: string[];
}

export interface DailyStatus {
  dateKey: string;
  reviewDone: boolean;
  previewDone: boolean;
  kanjiDone: boolean;
  vocabDone: boolean;
  totalAnswered: number;
  totalCorrect: number;
  totalDurationSec: number;
  updatedAt: string;
}

export interface FirebaseConfigData {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

export type SyncConnectionState = 'unconfigured' | 'connecting' | 'connected' | 'offline' | 'error';

export interface DailyMissionPlan {
  dateKey: string;
  todayWeekday: WeekdayKey;
  todayWeekdayLabel: string;
  tomorrowWeekday: WeekdayKey;
  tomorrowWeekdayLabel: string;
  todaySubjects: Subject[];
  tomorrowSubjects: Subject[];
  reviewUnits: Unit[];
  previewUnits: Unit[];
  reviewQuestions: Question[];
  previewQuestions: Question[];
  kanjiItems: KanjiItem[];
  vocabWords: VocabWord[];
}
