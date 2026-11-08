import React, { useState, useMemo } from 'react';
import { GraduationCap } from 'lucide-react';
import questionsData from './data/questions.json';
import { Question, QuestionCountOption, QuizMode, StudyProgress } from './types/quiz';
import { useStudyProgress } from './hooks/useStudyProgress';
import { HomeView } from './components/HomeView';
import { QuizView } from './components/QuizView';
import { ResultView } from './components/ResultView';

type ScreenState =
  | { view: 'home' }
  | {
      view: 'quiz';
      mode: QuizMode;
      title: string;
      questions: Question[];
    }
  | {
      view: 'result';
      mode: QuizMode;
      title: string;
      score: number;
      total: number;
      wrongQuestions: Question[];
    };

function shuffleArray<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function selectQuestionsByCount(
  pool: Question[],
  count: QuestionCountOption | undefined,
  progress: StudyProgress,
  preserveOrderForAll: boolean
): Question[] {
  if (!count || count === 'all' || count >= pool.length) {
    return preserveOrderForAll ? [...pool] : shuffleArray(pool);
  }

  // Prioritize unanswered and previously wrong questions first
  const unansweredOrWrong = shuffleArray(
    pool.filter((q) => !progress.records[q.id]?.lastCorrect)
  );
  const alreadyMastered = shuffleArray(
    pool.filter((q) => progress.records[q.id]?.lastCorrect)
  );

  return [...unansweredOrWrong, ...alreadyMastered].slice(0, count);
}

export function App() {
  const allQuestions = useMemo(() => questionsData as Question[], []);
  const { progress, recordAnswer, recordSession, resetProgress } =
    useStudyProgress();
  const [screen, setScreen] = useState<ScreenState>({ view: 'home' });

  const startQuiz = (mode: QuizMode) => {
    let selectedQuestions: Question[] = [];
    let title = '';

    if (mode.type === 'subject') {
      const subjectPool = allQuestions.filter(
        (q) => q.subject === mode.subject
      );
      const countOpt = mode.count ?? 'all';
      selectedQuestions = selectQuestionsByCount(
        subjectPool,
        countOpt,
        progress,
        true
      );
      title =
        countOpt === 'all'
          ? `${mode.subject}（全${selectedQuestions.length}問）`
          : `${mode.subject}（${selectedQuestions.length}問）`;
    } else if (mode.type === 'random') {
      const countOpt = mode.count ?? 10;
      selectedQuestions = selectQuestionsByCount(
        allQuestions,
        countOpt,
        progress,
        false
      );
      title = `全問ランダム演習（${selectedQuestions.length}問）`;
    } else if (mode.type === 'review') {
      selectedQuestions = allQuestions.filter((q) =>
        progress.wrongQuestionIds.includes(q.id)
      );
      title = '間違えた問題の復習';
    } else if (mode.type === 'retry') {
      selectedQuestions = allQuestions.filter((q) =>
        mode.questionIds.includes(q.id)
      );
      title = '間違えた問題の再挑戦';
    }

    if (selectedQuestions.length === 0) {
      return;
    }

    setScreen({
      view: 'quiz',
      mode,
      title,
      questions: selectedQuestions,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Mobile-first container */}
      <div className="mx-auto max-w-md min-h-screen flex flex-col px-4 pt-4">
        {/* Header */}
        <header className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setScreen({ view: 'home' })}
            className="flex items-center gap-2.5 text-left focus:outline-none"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-900 leading-none">
                QuickExam
              </h1>
              <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                中2定期テスト対策 4択問題集
              </p>
            </div>
          </button>

          <span className="rounded-full bg-slate-200/80 px-2.5 py-1 text-xs font-bold text-slate-700">
            全{allQuestions.length}問収録
          </span>
        </header>

        {/* Main Content */}
        <main className="flex-1">
          {screen.view === 'home' && (
            <HomeView
              questions={allQuestions}
              progress={progress}
              onStartQuiz={startQuiz}
              onResetProgress={resetProgress}
            />
          )}

          {screen.view === 'quiz' && (
            <QuizView
              key={`${screen.title}-${screen.questions.map((q) => q.id).join(',')}`}
              title={screen.title}
              questions={screen.questions}
              onAnswerQuestion={(question, _selectedIdx, isCorrect) => {
                recordAnswer(question.id, isCorrect);
              }}
              onFinishQuiz={(score, wrongQuestions) => {
                recordSession(
                  screen.title,
                  score,
                  screen.questions.length
                );
                setScreen({
                  view: 'result',
                  mode: screen.mode,
                  title: screen.title,
                  score,
                  total: screen.questions.length,
                  wrongQuestions,
                });
              }}
              onBackHome={() => setScreen({ view: 'home' })}
            />
          )}

          {screen.view === 'result' && (
            <ResultView
              title={screen.title}
              score={screen.score}
              total={screen.total}
              wrongQuestions={screen.wrongQuestions}
              onRetrySameMode={() => startQuiz(screen.mode)}
              onRetryWrongOnly={(wrongIds) =>
                startQuiz({ type: 'retry', questionIds: wrongIds })
              }
              onBackHome={() => setScreen({ view: 'home' })}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
