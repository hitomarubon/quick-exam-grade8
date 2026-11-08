export type Subject = '英語' | '数学' | '歴史' | '地理';

export type QuestionCountOption = 10 | 20 | 'all';

export interface Question {
  id: string;
  subject: Subject;
  category: string;
  question: string;
  options: [string, string, string, string];
  answerIndex: number;
  explanation: string;
}

export type QuizMode =
  | { type: 'subject'; subject: Subject; count?: QuestionCountOption }
  | { type: 'random'; count?: QuestionCountOption }
  | { type: 'review' }
  | { type: 'retry'; questionIds: string[] };

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
