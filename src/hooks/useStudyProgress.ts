import { useState, useEffect, useCallback } from 'react';
import { StudyProgress, SessionSummary } from '../types/quiz';

const STORAGE_KEY = 'quickexam_progress_v1';

const INITIAL_PROGRESS: StudyProgress = {
  totalAnswered: 0,
  totalCorrect: 0,
  records: {},
  wrongQuestionIds: [],
  recentSessions: [],
};

export function useStudyProgress() {
  const [progress, setProgress] = useState<StudyProgress>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_PROGRESS,
          ...parsed,
          records: parsed.records || {},
          wrongQuestionIds: Array.isArray(parsed.wrongQuestionIds) ? parsed.wrongQuestionIds : [],
          recentSessions: Array.isArray(parsed.recentSessions) ? parsed.recentSessions : [],
        };
      }
    } catch (e) {
      console.error('Failed to read study progress from localStorage:', e);
    }
    return INITIAL_PROGRESS;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) {
      console.error('Failed to save study progress to localStorage:', e);
    }
  }, [progress]);

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
        // Remove from wrong list when answered correctly
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

  const recordSession = useCallback((title: string, score: number, total: number) => {
    setProgress((prev) => {
      const newSession: SessionSummary = {
        id: `${Date.now()}`,
        title,
        score,
        total,
        completedAt: new Date().toISOString(),
      };
      return {
        ...prev,
        recentSessions: [newSession, ...prev.recentSessions].slice(0, 10),
      };
    });
  }, []);

  const resetProgress = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear localStorage:', e);
    }
    setProgress(INITIAL_PROGRESS);
  }, []);

  return {
    progress,
    recordAnswer,
    recordSession,
    resetProgress,
  };
}
