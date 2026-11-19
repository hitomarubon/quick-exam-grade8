import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  BookText,
  Calculator,
  CheckCircle2,
  ChevronRight,
  Download,
  Flame,
  FlaskConical,
  Landmark,
  MapPin,
  PenTool,
  Rocket,
  RotateCcw,
  Share,
  Shuffle,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import {
  AppSettings,
  DailyMissionPlan,
  DailyStatus,
  Question,
  QuestionCountOption,
  QuizMode,
  StudyLog,
  StudyProgress,
  Subject,
  Unit,
} from '../types/quiz';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface HomeViewProps {
  questions: Question[];
  units: Unit[];
  progress: StudyProgress;
  settings: AppSettings;
  todayStatus: DailyStatus;
  streakDays: number;
  dailyMissionPlan: DailyMissionPlan;
  recentLogs: StudyLog[];
  onStartQuiz: (mode: QuizMode) => void;
  onOpenKanjiMission: () => void;
  onOpenVocabMission: () => void;
  onResetProgress: () => void;
}

const SUBJECT_CONFIG: Array<{
  subject: Subject;
  label: string;
  textbookBadge: string;
  icon: React.FC<{ className?: string }>;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  badgeClass: string;
}> = [
  {
    subject: '英語',
    label: '英語',
    textbookBadge: '文理 ワーク',
    icon: BookOpen,
    colorClass: 'text-blue-600',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200 hover:border-blue-400',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  {
    subject: '数学',
    label: '数学',
    textbookBadge: '文理 ワーク',
    icon: Calculator,
    colorClass: 'text-emerald-600',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200 hover:border-emerald-400',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  {
    subject: '理科',
    label: '理科',
    textbookBadge: '啓林館 ワーク',
    icon: FlaskConical,
    colorClass: 'text-teal-600',
    bgClass: 'bg-teal-50',
    borderClass: 'border-teal-200 hover:border-teal-400',
    badgeClass: 'bg-teal-100 text-teal-700',
  },
  {
    subject: '国語',
    label: '国語',
    textbookBadge: '文理 ワーク',
    icon: BookText,
    colorClass: 'text-purple-600',
    bgClass: 'bg-purple-50',
    borderClass: 'border-purple-200 hover:border-purple-400',
    badgeClass: 'bg-purple-100 text-purple-700',
  },
  {
    subject: '歴史',
    label: '歴史',
    textbookBadge: '文理 ワーク',
    icon: Landmark,
    colorClass: 'text-amber-600',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200 hover:border-amber-400',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  {
    subject: '地理',
    label: '地理',
    textbookBadge: '文理 ワーク',
    icon: MapPin,
    colorClass: 'text-rose-600',
    bgClass: 'bg-rose-50',
    borderClass: 'border-rose-200 hover:border-rose-400',
    badgeClass: 'bg-rose-100 text-rose-700',
  },
];

const COUNT_OPTIONS: Array<{ value: QuestionCountOption; label: string; desc: string }> = [
  { value: 5, label: '5問', desc: '超短時間' },
  { value: 10, label: '10問', desc: 'サクッと' },
  { value: 20, label: '20問', desc: 'しっかり' },
  { value: 'all', label: '全問', desc: '徹底演習' },
];

export const HomeView: React.FC<HomeViewProps> = ({
  questions,
  units,
  progress,
  settings,
  todayStatus,
  streakDays,
  dailyMissionPlan,
  recentLogs,
  onStartQuiz,
  onOpenKanjiMission,
  onOpenVocabMission,
  onResetProgress,
}) => {
  const [showResetModal, setShowResetModal] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [unitModalSubject, setUnitModalSubject] = useState<Subject | null>(null);
  const [selectedCount, setSelectedCount] = useState<QuestionCountOption>(10);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else {
      setShowInstallModal(true);
    }
  };

  const accuracyRate =
    progress.totalAnswered > 0
      ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100)
      : 0;

  const masteredCount = questions.filter((q) => progress.records[q.id]?.lastCorrect).length;
  const wrongCount = progress.wrongQuestionIds.length;
  const completedMissionCount = [
    todayStatus.reviewDone,
    todayStatus.previewDone,
    todayStatus.kanjiDone,
    todayStatus.vocabDone,
  ].filter(Boolean).length;

  const modalUnits = unitModalSubject
    ? units.filter((u) => u.subject === unitModalSubject)
    : [];

  return (
    <div className="space-y-4 pb-8">
      {/* Daily Missions Hero Card */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-5 text-white shadow-lg">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold backdrop-blur-sm">
                <Sparkles className="h-3 w-3" />
                {dailyMissionPlan.dateKey}（{dailyMissionPlan.todayWeekdayLabel}）
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/25 px-2.5 py-0.5 text-[11px] font-black text-amber-200 border border-amber-300/30">
                <Flame className="h-3 w-3" />
                {streakDays}日連続
              </span>
            </div>
            <h2 className="mt-2 text-xl font-black tracking-tight">
              {settings.studentName} の毎日ミッション
            </h2>
            <p className="text-[11px] text-indigo-100 mt-0.5">
              1日5〜10分！今日の復習と明日の予習でテストに強い力をつけよう
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-2xl font-black">{completedMissionCount}</span>
            <span className="text-xs font-bold text-indigo-200"> / 4 完了</span>
          </div>
        </div>

        {/* 4 Daily Mission Buttons */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {/* 1. Today's Review */}
          <button
            type="button"
            onClick={() =>
              onStartQuiz({
                type: 'daily_review',
                unitIds: dailyMissionPlan.reviewUnits.map((u) => u.id),
                count: settings.dailyTargets.reviewCount,
              })
            }
            className={`relative flex flex-col justify-between rounded-2xl p-3 text-left transition active:scale-95 ${
              todayStatus.reviewDone
                ? 'bg-emerald-500/25 border border-emerald-300/60'
                : 'bg-white text-slate-900 shadow-sm hover:bg-indigo-50'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span
                className={`inline-flex items-center gap-1 text-xs font-black ${
                  todayStatus.reviewDone ? 'text-emerald-200' : 'text-indigo-700'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                今日の復習
              </span>
              {todayStatus.reviewDone && (
                <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0" />
              )}
            </div>
            <p
              className={`mt-1 text-[11px] font-bold line-clamp-1 ${
                todayStatus.reviewDone ? 'text-white/90' : 'text-slate-600'
              }`}
            >
              {dailyMissionPlan.todaySubjects.join('・')}
            </p>
            <span
              className={`mt-1.5 inline-block text-[10px] font-extrabold ${
                todayStatus.reviewDone ? 'text-emerald-200' : 'text-indigo-600'
              }`}
            >
              {todayStatus.reviewDone
                ? '達成済み（もう一度）'
                : `${dailyMissionPlan.reviewQuestions.length}問・約3分 →`}
            </span>
          </button>

          {/* 2. Tomorrow's Preview */}
          <button
            type="button"
            onClick={() =>
              onStartQuiz({
                type: 'daily_preview',
                unitIds: dailyMissionPlan.previewUnits.map((u) => u.id),
                count: settings.dailyTargets.previewCount,
              })
            }
            className={`relative flex flex-col justify-between rounded-2xl p-3 text-left transition active:scale-95 ${
              todayStatus.previewDone
                ? 'bg-emerald-500/25 border border-emerald-300/60'
                : 'bg-white text-slate-900 shadow-sm hover:bg-indigo-50'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span
                className={`inline-flex items-center gap-1 text-xs font-black ${
                  todayStatus.previewDone ? 'text-emerald-200' : 'text-sky-700'
                }`}
              >
                <Rocket className="h-3.5 w-3.5" />
                明日の予習
              </span>
              {todayStatus.previewDone && (
                <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0" />
              )}
            </div>
            <p
              className={`mt-1 text-[11px] font-bold line-clamp-1 ${
                todayStatus.previewDone ? 'text-white/90' : 'text-slate-600'
              }`}
            >
              {dailyMissionPlan.tomorrowWeekdayLabel}:{' '}
              {dailyMissionPlan.tomorrowSubjects.join('・')}
            </p>
            <span
              className={`mt-1.5 inline-block text-[10px] font-extrabold ${
                todayStatus.previewDone ? 'text-emerald-200' : 'text-sky-600'
              }`}
            >
              {todayStatus.previewDone
                ? '達成済み（もう一度）'
                : `${dailyMissionPlan.previewQuestions.length}問・約3分 →`}
            </span>
          </button>

          {/* 3. Kanji Handwriting */}
          <button
            type="button"
            onClick={onOpenKanjiMission}
            className={`relative flex flex-col justify-between rounded-2xl p-3 text-left transition active:scale-95 ${
              todayStatus.kanjiDone
                ? 'bg-emerald-500/25 border border-emerald-300/60'
                : 'bg-white text-slate-900 shadow-sm hover:bg-indigo-50'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span
                className={`inline-flex items-center gap-1 text-xs font-black ${
                  todayStatus.kanjiDone ? 'text-emerald-200' : 'text-blue-700'
                }`}
              >
                <PenTool className="h-3.5 w-3.5" />
                手書き漢字
              </span>
              {todayStatus.kanjiDone && (
                <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0" />
              )}
            </div>
            <p
              className={`mt-1 text-[11px] font-bold line-clamp-1 ${
                todayStatus.kanjiDone ? 'text-white/90' : 'text-slate-600'
              }`}
            >
              AI自動判定ドリル
            </p>
            <span
              className={`mt-1.5 inline-block text-[10px] font-extrabold ${
                todayStatus.kanjiDone ? 'text-emerald-200' : 'text-blue-600'
              }`}
            >
              {todayStatus.kanjiDone
                ? '達成済み（もう一度）'
                : `${dailyMissionPlan.kanjiItems.length}字・約2分 →`}
            </span>
          </button>

          {/* 4. Vocab Flash */}
          <button
            type="button"
            onClick={onOpenVocabMission}
            className={`relative flex flex-col justify-between rounded-2xl p-3 text-left transition active:scale-95 ${
              todayStatus.vocabDone
                ? 'bg-emerald-500/25 border border-emerald-300/60'
                : 'bg-white text-slate-900 shadow-sm hover:bg-indigo-50'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span
                className={`inline-flex items-center gap-1 text-xs font-black ${
                  todayStatus.vocabDone ? 'text-emerald-200' : 'text-violet-700'
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                英単語3秒
              </span>
              {todayStatus.vocabDone && (
                <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0" />
              )}
            </div>
            <p
              className={`mt-1 text-[11px] font-bold line-clamp-1 ${
                todayStatus.vocabDone ? 'text-white/90' : 'text-slate-600'
              }`}
            >
              フラッシュ速答記憶
            </p>
            <span
              className={`mt-1.5 inline-block text-[10px] font-extrabold ${
                todayStatus.vocabDone ? 'text-emerald-200' : 'text-violet-600'
              }`}
            >
              {todayStatus.vocabDone
                ? '達成済み（もう一度）'
                : `${dailyMissionPlan.vocabWords.length}語・約2分 →`}
            </span>
          </button>
        </div>

        {completedMissionCount === 4 && (
          <div className="mt-3 rounded-2xl bg-emerald-400/25 border border-emerald-300/40 px-3.5 py-2 text-center text-xs font-extrabold text-emerald-100">
            🎉 今日の予習・復習ミッション完全達成！素晴らしい！
          </div>
        )}
      </section>

      {/* Compact Overall Progress Bar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-extrabold text-slate-800">
              総合正答率 & マスター進捗
            </p>
            <p className="text-[11px] text-slate-500">
              クリア済み {masteredCount} / {questions.length} 問（{progress.totalCorrect}/
              {progress.totalAnswered}正解）
            </p>
          </div>
          <div className="text-right">
            <span
              data-testid="overall-accuracy"
              className="text-2xl font-black text-indigo-600"
            >
              {accuracyRate}
            </span>
            <span className="text-xs font-bold text-indigo-500">%</span>
          </div>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-500"
            style={{
              width: `${
                questions.length > 0 ? Math.round((masteredCount / questions.length) * 100) : 0
              }%`,
            }}
          />
        </div>
      </section>

      {/* Question Count Selector */}
      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600" />
            <span className="text-xs font-extrabold text-slate-700">自由演習の出題数</span>
          </div>
          <span className="text-[11px] font-medium text-slate-400">未解答・苦手を優先</span>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {COUNT_OPTIONS.map((opt) => {
            const active = selectedCount === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                data-testid={`count-option-${opt.value}`}
                onClick={() => setSelectedCount(opt.value)}
                className={`flex flex-col items-center justify-center rounded-xl border py-2 px-1 transition-all active:scale-95 ${
                  active
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="text-xs font-extrabold">{opt.label}</span>
                <span className={`text-[10px] ${active ? 'text-indigo-100' : 'text-slate-400'}`}>
                  {opt.desc}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Random & Review Wrong Buttons */}
      <section className="grid grid-cols-1 gap-2.5">
        <button
          type="button"
          data-testid="mode-random"
          onClick={() => onStartQuiz({ type: 'random', count: selectedCount })}
          className="group flex w-full items-center justify-between rounded-2xl border-2 border-indigo-200 bg-white p-3.5 text-left shadow-sm transition-all active:scale-[0.98] hover:border-indigo-400"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <Shuffle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">全6教科ランダム演習</h3>
              <p className="text-[11px] text-slate-500">
                全{questions.length}問から{selectedCount === 'all' ? '全問' : `${selectedCount}問`}出題
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400" />
        </button>

        <button
          type="button"
          data-testid="mode-review"
          disabled={wrongCount === 0}
          onClick={() => onStartQuiz({ type: 'review' })}
          className={`group flex w-full items-center justify-between rounded-2xl border-2 p-3.5 text-left shadow-sm transition-all ${
            wrongCount > 0
              ? 'border-rose-200 bg-rose-50/50 active:scale-[0.98] hover:border-rose-400'
              : 'border-slate-200 bg-slate-100/70 opacity-65 cursor-not-allowed'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                wrongCount > 0 ? 'bg-rose-600 text-white shadow-sm' : 'bg-slate-200 text-slate-500'
              }`}
            >
              {wrongCount > 0 ? <Flame className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900">間違えた問題のみ復習</h3>
                <span
                  data-testid="wrong-count-badge"
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    wrongCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  残り {wrongCount} 問
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {wrongCount > 0 ? '苦手問題を克服しよう！' : '間違いはありません'}
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400" />
        </button>
      </section>

      {/* 6 Subject Cards Grid */}
      <section>
        <div className="mb-2.5 flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-slate-700">教科・教科書ワーク単元別</h3>
          <span className="text-[11px] font-semibold text-indigo-600">タップして単元選択</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {SUBJECT_CONFIG.map((cfg) => {
            const Icon = cfg.icon;
            const subjectQuestions = questions.filter((q) => q.subject === cfg.subject);
            const subjectMastered = subjectQuestions.filter(
              (q) => progress.records[q.id]?.lastCorrect
            ).length;
            const currentUnit = units.find(
              (u) => u.id === settings.currentUnitBySubject[cfg.subject]
            );

            return (
              <button
                key={cfg.subject}
                type="button"
                data-testid={`subject-${cfg.subject}`}
                onClick={() => setUnitModalSubject(cfg.subject)}
                className={`flex flex-col justify-between rounded-2xl border-2 bg-white p-3.5 text-left shadow-sm transition-all active:scale-[0.97] ${cfg.borderClass}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${cfg.bgClass} ${cfg.colorClass}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${cfg.badgeClass}`}>
                      全{subjectQuestions.length}問
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <h4 className="text-base font-extrabold text-slate-900">{cfg.label}</h4>
                    <span className="text-[10px] font-bold text-slate-400">{cfg.textbookBadge}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">
                    {currentUnit ? `★ ${currentUnit.title}` : '単元を選択'}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">クリア済</span>
                  <span className="font-bold text-slate-700">
                    {subjectMastered} / {subjectQuestions.length} 問
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Install to Smartphone Banner */}
      <section>
        <button
          type="button"
          data-testid="install-guide-button"
          onClick={handleInstallClick}
          className="flex w-full items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3.5 text-left transition-all active:scale-[0.98] hover:bg-indigo-100/70"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-indigo-950">
                スマホのホーム画面にアプリを追加（PWA対応）
              </h4>
              <p className="text-[11px] text-indigo-700 mt-0.5">
                オフラインでも予習・復習＆ネット復帰時に自動同期！
              </p>
            </div>
          </div>
          <Download className="h-4 w-4 shrink-0 text-indigo-600" />
        </button>
      </section>

      {/* Recent Logs & Reset */}
      <section className="pt-1">
        {recentLogs.length > 0 && (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2.5">
              <Trophy className="h-4 w-4 text-amber-500" />
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                最近の学習履歴
              </h4>
            </div>
            <div className="space-y-2">
              {recentLogs.slice(0, 4).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-xs border-b border-slate-100 pb-1.5 last:border-none last:pb-0"
                >
                  <span className="font-medium text-slate-700 truncate pr-2">{s.unitTitle}</span>
                  <span className="shrink-0 font-bold text-indigo-600">
                    {s.score} / {s.total} 正解
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-center">
          <button
            type="button"
            data-testid="open-reset-button"
            onClick={() => setShowResetModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            ローカル正答率をリセット
          </button>
        </div>
      </section>

      {/* Unit Picker Modal */}
      {unitModalSubject && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-3 backdrop-blur-sm">
          <div className="w-full max-w-md max-h-[82vh] flex flex-col rounded-3xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {unitModalSubject} の単元を選ぶ
                </h3>
                <p className="text-[11px] text-slate-500">
                  ★ は現在学校で習っている単元です
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUnitModalSubject(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1">
              <button
                type="button"
                onClick={() => {
                  const subj = unitModalSubject;
                  setUnitModalSubject(null);
                  onStartQuiz({ type: 'subject', subject: subj, count: selectedCount });
                }}
                className="flex w-full items-center justify-between rounded-2xl bg-indigo-600 p-3.5 text-left text-white shadow-sm"
              >
                <div>
                  <p className="text-sm font-extrabold">{unitModalSubject} まとめて演習</p>
                  <p className="text-[11px] text-indigo-100">
                    全単元から {selectedCount === 'all' ? '全問' : `${selectedCount}問`} を出題
                  </p>
                </div>
                <ChevronRight className="h-5 w-5" />
              </button>

              {modalUnits.map((unit) => {
                const count = questions.filter((q) => q.unitId === unit.id).length;
                const isCurrent = settings.currentUnitBySubject[unitModalSubject] === unit.id;
                return (
                  <button
                    key={unit.id}
                    type="button"
                    disabled={count === 0}
                    onClick={() => {
                      setUnitModalSubject(null);
                      onStartQuiz({ type: 'unit', unitId: unit.id, count: selectedCount });
                    }}
                    className={`flex w-full items-center justify-between rounded-2xl border p-3 text-left transition ${
                      count === 0
                        ? 'border-slate-100 bg-slate-50 opacity-55 cursor-not-allowed'
                        : isCurrent
                        ? 'border-indigo-400 bg-indigo-50/70 hover:bg-indigo-100/70'
                        : 'border-slate-200 bg-white hover:border-indigo-300'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        {isCurrent && (
                          <span className="rounded-md bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            ★現在地
                          </span>
                        )}
                        <span className="text-xs font-extrabold text-slate-900">
                          {unit.order}. {unit.title}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{unit.textbook}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                      {count > 0 ? `${count}問` : '未登録'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Install Instructions Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-indigo-600">
                <Smartphone className="h-6 w-6 shrink-0" />
                <h3 className="text-base font-extrabold text-slate-900">
                  スマホへのインストール方法
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-700">
              <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-200">
                <p className="font-extrabold text-slate-900 flex items-center gap-1.5 mb-1">
                  <Share className="h-4 w-4 text-blue-600" />
                  iPhone / iPad (Safari) の場合
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>画面下の「共有」ボタンをタップ</li>
                  <li>メニューから「ホーム画面に追加」を選択</li>
                  <li>右上の「追加」をタップ</li>
                </ol>
              </div>

              <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-200">
                <p className="font-extrabold text-slate-900 flex items-center gap-1.5 mb-1">
                  <Download className="h-4 w-4 text-emerald-600" />
                  Android (Chrome) の場合
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>右上のメニュー「︙」をタップ</li>
                  <li>「アプリをインストール」または「ホーム画面に追加」をタップ</li>
                </ol>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowInstallModal(false)}
              className="mt-5 w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-sm"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <h3 className="text-lg font-bold text-slate-900">履歴をリセットしますか？</h3>
            </div>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              端末に保存されている正答率・間違えた問題リストが初期化されます（クラウド上のログは消えません）。
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                data-testid="cancel-reset-button"
                onClick={() => setShowResetModal(false)}
                className="rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-bold text-slate-700"
              >
                キャンセル
              </button>
              <button
                type="button"
                data-testid="confirm-reset-button"
                onClick={() => {
                  onResetProgress();
                  setShowResetModal(false);
                }}
                className="rounded-xl bg-rose-600 py-3 text-sm font-bold text-white shadow-sm"
              >
                リセットする
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
