import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Calculator,
  Landmark,
  MapPin,
  Shuffle,
  AlertCircle,
  Trophy,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Flame,
  Smartphone,
  Download,
  Share,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Question,
  QuestionCountOption,
  QuizMode,
  StudyProgress,
  Subject,
} from '../types/quiz';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface HomeViewProps {
  questions: Question[];
  progress: StudyProgress;
  onStartQuiz: (mode: QuizMode) => void;
  onResetProgress: () => void;
}

const SUBJECT_CONFIG: {
  subject: Subject;
  label: string;
  sublabel: string;
  icon: React.FC<{ className?: string }>;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  badgeClass: string;
}[] = [
  {
    subject: '英語',
    label: '英語',
    sublabel: 'Unit 4・第4文型・不定詞',
    icon: BookOpen,
    colorClass: 'text-blue-600',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200 hover:border-blue-400',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  {
    subject: '数学',
    label: '数学',
    sublabel: '1次関数・多角形と角・合同',
    icon: Calculator,
    colorClass: 'text-emerald-600',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200 hover:border-emerald-400',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  {
    subject: '歴史',
    label: '歴史',
    sublabel: '元禄/化政文化・三大改革',
    icon: Landmark,
    colorClass: 'text-amber-600',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200 hover:border-amber-400',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  {
    subject: '地理',
    label: '地理',
    sublabel: '九州地方・中国・四国地方',
    icon: MapPin,
    colorClass: 'text-rose-600',
    bgClass: 'bg-rose-50',
    borderClass: 'border-rose-200 hover:border-rose-400',
    badgeClass: 'bg-rose-100 text-rose-700',
  },
];

const COUNT_OPTIONS: { value: QuestionCountOption; label: string; desc: string }[] = [
  { value: 10, label: '10問', desc: 'サクッと演習' },
  { value: 20, label: '20問', desc: 'しっかり演習' },
  { value: 'all', label: '全問 (60問)', desc: '徹底マスター' },
];

export const HomeView: React.FC<HomeViewProps> = ({
  questions,
  progress,
  onStartQuiz,
  onResetProgress,
}) => {
  const [showResetModal, setShowResetModal] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [selectedCount, setSelectedCount] = useState<QuestionCountOption>(10);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

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

  const masteredCount = questions.filter(
    (q) => progress.records[q.id]?.lastCorrect
  ).length;

  const wrongCount = progress.wrongQuestionIds.length;

  const randomCountLabel =
    selectedCount === 'all' ? `${questions.length}問出題` : `${selectedCount}問出題`;

  return (
    <div className="space-y-4 pb-8">
      {/* Hero Stats Card */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-5 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              中2 11月定期テスト対策（全{questions.length}問）
            </span>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
              総合正答率
            </h2>
            <p className="text-xs text-indigo-100 mt-0.5">
              通学中・スキマ時間で満点を目指そう！
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-baseline justify-end gap-0.5">
              <span
                data-testid="overall-accuracy"
                className="text-4xl font-black tracking-tight"
              >
                {accuracyRate}
              </span>
              <span className="text-lg font-bold text-indigo-200">%</span>
            </div>
            <p className="text-xs text-indigo-200">
              {progress.totalCorrect} / {progress.totalAnswered} 問正解
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-indigo-100 mb-1.5">
            <span>マスター進捗（正解済み問題）</span>
            <span className="font-bold">
              {masteredCount} / {questions.length} 問
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-indigo-950/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-500"
              style={{
                width: `${questions.length > 0 ? Math.round((masteredCount / questions.length) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      </section>

      {/* Question Count Selector */}
      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600" />
            <span className="text-xs font-extrabold text-slate-700">
              1回あたりの出題数を選択
            </span>
          </div>
          <span className="text-[11px] font-medium text-slate-400">
            未解答・苦手を優先出題
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {COUNT_OPTIONS.map((opt) => {
            const active = selectedCount === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                data-testid={`count-option-${opt.value}`}
                onClick={() => setSelectedCount(opt.value)}
                className={`flex flex-col items-center justify-center rounded-xl border py-2 px-2 transition-all active:scale-95 ${
                  active
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="text-xs font-extrabold">{opt.label}</span>
                <span
                  className={`text-[10px] ${
                    active ? 'text-indigo-100' : 'text-slate-400'
                  }`}
                >
                  {opt.desc}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Special Action Cards: Random & Review Wrong */}
      <section className="grid grid-cols-1 gap-3">
        <button
          type="button"
          data-testid="mode-random"
          onClick={() => onStartQuiz({ type: 'random', count: selectedCount })}
          className="group flex w-full items-center justify-between rounded-2xl border-2 border-indigo-200 bg-white p-4 text-left shadow-sm transition-all active:scale-[0.98] hover:border-indigo-400 hover:bg-indigo-50/40"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <Shuffle className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  全問ランダム演習
                </h3>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
                  {randomCountLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                4科目（全{questions.length}問）からランダムに実力チェック
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-0.5" />
        </button>

        <button
          type="button"
          data-testid="mode-review"
          disabled={wrongCount === 0}
          onClick={() => onStartQuiz({ type: 'review' })}
          className={`group flex w-full items-center justify-between rounded-2xl border-2 p-4 text-left shadow-sm transition-all ${
            wrongCount > 0
              ? 'border-rose-200 bg-rose-50/50 active:scale-[0.98] hover:border-rose-400 hover:bg-rose-50'
              : 'border-slate-200 bg-slate-100/70 opacity-65 cursor-not-allowed'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                wrongCount > 0
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              {wrongCount > 0 ? (
                <Flame className="h-6 w-6" />
              ) : (
                <CheckCircle2 className="h-6 w-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  間違えた問題のみ復習
                </h3>
                <span
                  data-testid="wrong-count-badge"
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    wrongCount > 0
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  残り {wrongCount} 問
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {wrongCount > 0
                  ? '苦手問題をピンポイントで克服しよう！'
                  : '現在、復習が必要な間違えた問題はありません'}
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400" />
        </button>
      </section>

      {/* Subject Cards Grid */}
      <section>
        <div className="mb-2.5 flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-slate-700">
            科目別トレーニング（各60問）
          </h3>
          <span className="text-xs font-semibold text-indigo-600">
            {selectedCount === 'all'
              ? '全60問ずつ出題'
              : `各${selectedCount}問ずつ出題`}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {SUBJECT_CONFIG.map((cfg) => {
            const Icon = cfg.icon;
            const subjectQuestions = questions.filter(
              (q) => q.subject === cfg.subject
            );
            const subjectMastered = subjectQuestions.filter(
              (q) => progress.records[q.id]?.lastCorrect
            ).length;

            return (
              <button
                key={cfg.subject}
                type="button"
                data-testid={`subject-${cfg.subject}`}
                onClick={() =>
                  onStartQuiz({
                    type: 'subject',
                    subject: cfg.subject,
                    count: selectedCount,
                  })
                }
                className={`flex flex-col justify-between rounded-2xl border-2 bg-white p-4 text-left shadow-sm transition-all active:scale-[0.97] ${cfg.borderClass}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${cfg.bgClass} ${cfg.colorClass}`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${cfg.badgeClass}`}
                    >
                      全{subjectQuestions.length}問
                    </span>
                  </div>
                  <h4 className="mt-3 text-lg font-extrabold text-slate-900">
                    {cfg.label}
                  </h4>
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                    {cfg.sublabel}
                  </p>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
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
                全画面表示＆オフラインでもサクサク勉強できます
              </p>
            </div>
          </div>
          <Download className="h-4 w-4 shrink-0 text-indigo-600" />
        </button>
      </section>

      {/* Recent Sessions & Reset */}
      <section className="pt-1">
        {progress.recentSessions.length > 0 && (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2.5">
              <Trophy className="h-4 w-4 text-amber-500" />
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                最近の学習履歴
              </h4>
            </div>
            <div className="space-y-2">
              {progress.recentSessions.slice(0, 3).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-xs border-b border-slate-100 pb-1.5 last:border-none last:pb-0"
                >
                  <span className="font-medium text-slate-700">{s.title}</span>
                  <span className="font-bold text-indigo-600">
                    {s.score} / {s.total} 問正解
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
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            学習履歴・正答率をリセット
          </button>
        </div>
      </section>

      {/* Install Instructions Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
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
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
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
                  <li>画面下の「共有」ボタン（四角から上矢印）をタップ</li>
                  <li>メニューから「ホーム画面に追加」を選択</li>
                  <li>右上の「追加」をタップするとアプリアイコンが追加されます</li>
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
              className="mt-5 w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-sm active:scale-95"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <h3 className="text-lg font-bold text-slate-900">
                履歴をリセットしますか？
              </h3>
            </div>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              これまでの正答率、解答数、間違えた問題リストがすべて初期化されます。この操作は取り消せません。
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                data-testid="cancel-reset-button"
                onClick={() => setShowResetModal(false)}
                className="rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-bold text-slate-700 active:scale-95"
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
                className="rounded-xl bg-rose-600 py-3 text-sm font-bold text-white shadow-sm active:scale-95 hover:bg-rose-700"
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
