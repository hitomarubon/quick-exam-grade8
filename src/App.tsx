import { useState } from 'react';
import {
  Cloud,
  CloudOff,
  GraduationCap,
  Home,
  PenTool,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  MissionType,
  Question,
  QuestionCountOption,
  QuizMode,
  StudyProgress,
  Subject,
} from './types/quiz';
import { useStudyHub } from './hooks/useStudyHub';
import { HomeView } from './components/HomeView';
import { QuizView } from './components/QuizView';
import { ResultView } from './components/ResultView';
import { KanjiView } from './components/KanjiView';
import { VocabView } from './components/VocabView';
import { ParentDashboardView } from './components/ParentDashboardView';

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
    }
  | { view: 'kanji'; autoStartMission: boolean }
  | { view: 'vocab'; autoStartMission: boolean }
  | { view: 'parent' };

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

  const unansweredOrWrong = shuffleArray(
    pool.filter((q) => !progress.records[q.id]?.lastCorrect)
  );
  const alreadyMastered = shuffleArray(
    pool.filter((q) => progress.records[q.id]?.lastCorrect)
  );

  return [...unansweredOrWrong, ...alreadyMastered].slice(0, count);
}

export function App() {
  const hub = useStudyHub();
  const [screen, setScreen] = useState<ScreenState>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'parent') {
      return { view: 'parent' };
    }
    return { view: 'home' };
  });

  const startQuiz = (mode: QuizMode) => {
    let selectedQuestions: Question[] = [];
    let title = '';

    if (mode.type === 'daily_review') {
      selectedQuestions = hub.dailyMissionPlan.reviewQuestions;
      title = `今日の復習（${selectedQuestions.length}問）`;
    } else if (mode.type === 'daily_preview') {
      selectedQuestions = hub.dailyMissionPlan.previewQuestions;
      title = `明日の予習（${selectedQuestions.length}問）`;
    } else if (mode.type === 'unit') {
      const unitPool = hub.allQuestions.filter((q) => q.unitId === mode.unitId);
      const unitObj = hub.allUnits.find((u) => u.id === mode.unitId);
      const countOpt = mode.count ?? 'all';
      selectedQuestions = selectQuestionsByCount(unitPool, countOpt, hub.progress, true);
      title = unitObj ? `${unitObj.subject}: ${unitObj.title}` : `単元演習`;
    } else if (mode.type === 'subject') {
      const subjectPool = hub.allQuestions.filter((q) => q.subject === mode.subject);
      const countOpt = mode.count ?? 'all';
      selectedQuestions = selectQuestionsByCount(subjectPool, countOpt, hub.progress, true);
      title =
        countOpt === 'all'
          ? `${mode.subject}（全${selectedQuestions.length}問）`
          : `${mode.subject}（${selectedQuestions.length}問）`;
    } else if (mode.type === 'random') {
      const countOpt = mode.count ?? 10;
      selectedQuestions = selectQuestionsByCount(
        hub.allQuestions,
        countOpt,
        hub.progress,
        false
      );
      title = `全問ランダム演習（${selectedQuestions.length}問）`;
    } else if (mode.type === 'review') {
      selectedQuestions = hub.allQuestions.filter((q) =>
        hub.progress.wrongQuestionIds.includes(q.id)
      );
      title = '間違えた問題の復習';
    } else if (mode.type === 'retry') {
      selectedQuestions = hub.allQuestions.filter((q) => mode.questionIds.includes(q.id));
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

  const resolveMissionType = (mode: QuizMode): MissionType => {
    if (mode.type === 'daily_review') return 'review';
    if (mode.type === 'daily_preview') return 'preview';
    return 'free';
  };

  const resolveSubject = (mode: QuizMode, questions: Question[]): Subject => {
    if (mode.type === 'subject') return mode.subject;
    if (mode.type === 'unit') {
      const u = hub.allUnits.find((item) => item.id === mode.unitId);
      if (u) return u.subject;
    }
    return questions[0]?.subject || '英語';
  };

  const showBottomNav = screen.view !== 'quiz';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className={`mx-auto max-w-md min-h-screen flex flex-col px-4 pt-4 ${showBottomNav ? 'pb-20' : ''}`}>
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
                中2 毎日予習・復習ハブ
              </p>
            </div>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setScreen({ view: 'parent' })}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                hub.syncState === 'connected'
                  ? 'bg-emerald-100 text-emerald-700'
                  : hub.pendingSyncCount > 0
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-200/80 text-slate-700'
              }`}
              title="同期状態・保護者画面へ"
            >
              {hub.syncState === 'connected' ? (
                <Cloud className="h-3.5 w-3.5" />
              ) : (
                <CloudOff className="h-3.5 w-3.5" />
              )}
              <span>
                {hub.syncState === 'connected'
                  ? '同期OK'
                  : hub.pendingSyncCount > 0
                  ? `未送信${hub.pendingSyncCount}`
                  : 'ローカル'}
              </span>
            </button>

            <span className="rounded-full bg-slate-200/80 px-2.5 py-1 text-[11px] font-bold text-slate-700">
              {hub.allQuestions.length}問
            </span>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">
          {screen.view === 'home' && (
            <HomeView
              questions={hub.allQuestions}
              units={hub.allUnits}
              progress={hub.progress}
              settings={hub.settings}
              todayStatus={hub.todayStatus}
              streakDays={hub.streakDays}
              dailyMissionPlan={hub.dailyMissionPlan}
              recentLogs={hub.studyLogs}
              onStartQuiz={startQuiz}
              onOpenKanjiMission={() => setScreen({ view: 'kanji', autoStartMission: true })}
              onOpenVocabMission={() => setScreen({ view: 'vocab', autoStartMission: true })}
              onResetProgress={hub.resetProgress}
            />
          )}

          {screen.view === 'quiz' && (
            <QuizView
              key={`${screen.title}-${screen.questions.map((q) => q.id).join(',')}`}
              title={screen.title}
              questions={screen.questions}
              onAnswerQuestion={(question, _selectedIdx, isCorrect) => {
                hub.recordAnswer(question.id, isCorrect);
              }}
              onFinishQuiz={(score, wrongQuestions, durationSec) => {
                hub.recordSessionLog({
                  appId: 'quickexam',
                  missionType: resolveMissionType(screen.mode),
                  subject: resolveSubject(screen.mode, screen.questions),
                  unitTitle: screen.title,
                  score,
                  total: screen.questions.length,
                  durationSec,
                  wrongIds: wrongQuestions.map((q) => q.id),
                });
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

          {screen.view === 'kanji' && (
            <KanjiView
              categories={hub.kanjiCategories}
              allKanjiItems={hub.allKanjiItems}
              missionItems={hub.dailyMissionPlan.kanjiItems}
              weakIds={hub.kanjiWeakIds}
              autoStartMission={screen.autoStartMission}
              onUpdateWeakResult={hub.updateKanjiWeakResult}
              onSessionComplete={(payload) => {
                hub.recordSessionLog({
                  appId: 'kanji',
                  missionType: payload.missionType,
                  subject: '漢字',
                  unitTitle: payload.unitTitle,
                  score: payload.score,
                  total: payload.total,
                  durationSec: payload.durationSec,
                  wrongIds: payload.wrongIds,
                });
              }}
              onBackHome={() => setScreen({ view: 'home' })}
            />
          )}

          {screen.view === 'vocab' && (
            <VocabView
              allWords={hub.allVocabWords}
              missionWords={hub.dailyMissionPlan.vocabWords}
              weakIds={hub.vocabWeakIds}
              autoStartMission={screen.autoStartMission}
              onUpdateWeakResult={hub.updateVocabWeakResult}
              onSessionComplete={(payload) => {
                hub.recordSessionLog({
                  appId: 'vocab',
                  missionType: payload.missionType,
                  subject: '英単語',
                  unitTitle: payload.unitTitle,
                  score: payload.score,
                  total: payload.total,
                  durationSec: payload.durationSec,
                  wrongIds: payload.wrongIds,
                });
              }}
              onBackHome={() => setScreen({ view: 'home' })}
            />
          )}

          {screen.view === 'parent' && (
            <ParentDashboardView
              settings={hub.settings}
              allUnits={hub.allUnits}
              allQuestions={hub.allQuestions}
              progress={hub.progress}
              studyLogs={hub.studyLogs}
              dailyStatusMap={hub.dailyStatusMap}
              todayStatus={hub.todayStatus}
              streakDays={hub.streakDays}
              dailyMissionPlan={hub.dailyMissionPlan}
              familyId={hub.familyId}
              firebaseConfig={hub.firebaseConfig}
              syncState={hub.syncState}
              syncError={hub.syncError}
              pendingSyncCount={hub.pendingSyncCount}
              onUpdateSettings={hub.updateSettings}
              onAddUnits={hub.addCustomUnits}
              onDeleteCustomUnit={hub.deleteCustomUnit}
              onAddQuestions={hub.addCustomQuestions}
              onAddKanji={hub.addCustomKanji}
              onAddVocab={hub.addCustomVocab}
              onConfigureFirebase={hub.configureFirebase}
              onManualSync={hub.manualSyncNow}
              onBackHome={() => setScreen({ view: 'home' })}
            />
          )}
        </main>
      </div>

      {/* Bottom Navigation Bar */}
      {showBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md">
          <div className="mx-auto grid max-w-md grid-cols-4 px-2 py-1.5">
            <button
              type="button"
              onClick={() => setScreen({ view: 'home' })}
              className={`flex flex-col items-center justify-center rounded-xl py-1.5 text-[11px] font-bold transition ${
                screen.view === 'home' || screen.view === 'result'
                  ? 'text-indigo-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Home className="h-5 w-5" />
              <span className="mt-0.5">ホーム</span>
            </button>

            <button
              type="button"
              onClick={() => setScreen({ view: 'kanji', autoStartMission: false })}
              className={`flex flex-col items-center justify-center rounded-xl py-1.5 text-[11px] font-bold transition ${
                screen.view === 'kanji'
                  ? 'text-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <PenTool className="h-5 w-5" />
              <span className="mt-0.5">手書き漢字</span>
            </button>

            <button
              type="button"
              onClick={() => setScreen({ view: 'vocab', autoStartMission: false })}
              className={`flex flex-col items-center justify-center rounded-xl py-1.5 text-[11px] font-bold transition ${
                screen.view === 'vocab'
                  ? 'text-violet-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Zap className="h-5 w-5" />
              <span className="mt-0.5">英単語</span>
            </button>

            <button
              type="button"
              onClick={() => setScreen({ view: 'parent' })}
              className={`flex flex-col items-center justify-center rounded-xl py-1.5 text-[11px] font-bold transition ${
                screen.view === 'parent'
                  ? 'text-slate-900'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldCheck className="h-5 w-5" />
              <span className="mt-0.5">保護者</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

export default App;
