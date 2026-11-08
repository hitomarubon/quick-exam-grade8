import React from 'react';
import {
  Trophy,
  RotateCcw,
  Home,
  Flame,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Question } from '../types/quiz';

interface ResultViewProps {
  title: string;
  score: number;
  total: number;
  wrongQuestions: Question[];
  onRetrySameMode: () => void;
  onRetryWrongOnly: (wrongIds: string[]) => void;
  onBackHome: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({
  title,
  score,
  total,
  wrongQuestions,
  onRetrySameMode,
  onRetryWrongOnly,
  onBackHome,
}) => {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const isPerfect = score === total && total > 0;

  return (
    <div className="space-y-5 pb-10">
      {/* Score Summary Banner */}
      <section
        className={`rounded-3xl p-6 text-center text-white shadow-lg ${
          isPerfect
            ? 'bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700'
            : percentage >= 70
            ? 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800'
            : 'bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600'
        }`}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-xs">
          <Trophy className="h-9 w-9 text-yellow-200" />
        </div>

        <p className="mt-3 text-xs font-bold uppercase tracking-wider text-white/80">
          {title} 結果発表
        </p>

        <div className="mt-1 flex items-baseline justify-center gap-1">
          <span
            data-testid="result-score"
            className="text-5xl font-black tracking-tight"
          >
            {score}
          </span>
          <span className="text-xl font-bold text-white/80">/ {total} 問正解</span>
        </div>

        <p className="mt-2 text-sm font-bold text-white/95">
          {isPerfect
            ? 'パーフェクト達成！テスト本番もバッチリです！'
            : percentage >= 70
            ? 'あと少しで満点！間違えた問題を見直そう！'
            : '伸びしろ十分！解説を読んで再挑戦しよう！'}
        </p>
      </section>

      {/* Action Buttons */}
      <section className="space-y-2.5">
        {wrongQuestions.length > 0 && (
          <button
            type="button"
            data-testid="retry-wrong-button"
            onClick={() =>
              onRetryWrongOnly(wrongQuestions.map((q) => q.id))
            }
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 py-4 text-base font-extrabold text-white shadow-md transition-all active:scale-[0.98] hover:bg-rose-700"
          >
            <Flame className="h-5 w-5" />
            <span>間違えた {wrongQuestions.length} 問だけすぐ復習する</span>
          </button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            data-testid="retry-same-button"
            onClick={onRetrySameMode}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-indigo-200 bg-white py-3.5 text-sm font-extrabold text-indigo-700 shadow-xs transition-all active:scale-[0.98] hover:bg-indigo-50"
          >
            <RotateCcw className="h-4 w-4" />
            <span>もう一度挑戦</span>
          </button>

          <button
            type="button"
            data-testid="result-home-button"
            onClick={onBackHome}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white py-3.5 text-sm font-extrabold text-slate-700 shadow-xs transition-all active:scale-[0.98] hover:bg-slate-100"
          >
            <Home className="h-4 w-4" />
            <span>ホームへ戻る</span>
          </button>
        </div>
      </section>

      {/* Wrong Questions List */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {wrongQuestions.length > 0 ? (
              <AlertTriangle className="h-5 w-5 text-rose-500" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            )}
            <h3 className="text-base font-extrabold text-slate-900">
              {wrongQuestions.length > 0
                ? `間違えた問題一覧（${wrongQuestions.length}問）`
                : '全問正解！間違えた問題はありません'}
            </h3>
          </div>
        </div>

        {wrongQuestions.length === 0 ? (
          <p className="text-sm text-slate-500">
            すべての問題に正解しました。他の科目やランダム演習にも挑戦してみましょう！
          </p>
        ) : (
          <div data-testid="wrong-questions-list" className="space-y-3">
            {wrongQuestions.map((q) => (
              <div
                key={q.id}
                className="rounded-2xl border border-rose-100 bg-rose-50/40 p-3.5"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span className="font-bold text-rose-700">
                    {q.subject} ・ {q.category}
                  </span>
                  <span className="font-mono">#{q.id}</span>
                </div>
                <p className="text-sm font-bold text-slate-900 leading-snug">
                  {q.question}
                </p>
                <div className="mt-2 rounded-xl bg-white p-2.5 border border-rose-100/80">
                  <p className="text-xs font-extrabold text-emerald-700">
                    正解: {q.options[q.answerIndex]}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    {q.explanation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
