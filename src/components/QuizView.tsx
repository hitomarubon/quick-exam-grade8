import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  ChevronLeft,
  Lightbulb,
} from 'lucide-react';
import { Question } from '../types/quiz';

interface QuizViewProps {
  title: string;
  questions: Question[];
  onAnswerQuestion: (question: Question, selectedIndex: number, isCorrect: boolean) => void;
  onFinishQuiz: (score: number, wrongQuestions: Question[]) => void;
  onBackHome: () => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export const QuizView: React.FC<QuizViewProps> = ({
  title,
  questions,
  onAnswerQuestion,
  onFinishQuiz,
  onBackHome,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [wrongQuestions, setWrongQuestions] = useState<Question[]>([]);

  const currentQuestion = questions[currentIndex];
  const isAnswered = selectedIndex !== null;
  const isCorrect = selectedIndex === currentQuestion?.answerIndex;

  if (!currentQuestion) {
    return null;
  }

  const handleSelectOption = (index: number) => {
    if (isAnswered) return;
    setSelectedIndex(index);

    const correct = index === currentQuestion.answerIndex;
    if (correct) {
      setScore((prev) => prev + 1);
    } else {
      setWrongQuestions((prev) => [...prev, currentQuestion]);
    }
    onAnswerQuestion(currentQuestion, index, correct);
  };

  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedIndex(null);
    } else {
      onFinishQuiz(score, wrongQuestions);
    }
  };

  const progressPercentage = Math.round(((currentIndex + 1) / questions.length) * 100);

  return (
    <div className="flex flex-col pb-8">
      {/* Top Bar */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          data-testid="quiz-back-home"
          onClick={onBackHome}
          className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/70 active:scale-95"
        >
          <ChevronLeft className="h-4 w-4" />
          ホームへ戻る
        </button>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
            {title}
          </span>
          <span
            data-testid="question-counter"
            className="text-xs font-extrabold text-slate-700"
          >
            {currentIndex + 1} / {questions.length}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-indigo-600 transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Question Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
            {currentQuestion.subject} ・ {currentQuestion.category}
          </span>
          <span className="text-xs font-mono text-slate-400">
            #{currentQuestion.id}
          </span>
        </div>

        <h2
          data-testid="question-text"
          className="text-lg font-extrabold leading-relaxed text-slate-900"
        >
          Q{currentIndex + 1}. {currentQuestion.question}
        </h2>
      </div>

      {/* 4 Options */}
      <div className="mt-4 space-y-2.5">
        {currentQuestion.options.map((option, idx) => {
          const isSelected = selectedIndex === idx;
          const isOptionCorrect = idx === currentQuestion.answerIndex;

          let buttonStyle =
            'border-slate-200 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/30';
          let badgeStyle = 'bg-slate-100 text-slate-700';

          if (isAnswered) {
            if (isOptionCorrect) {
              buttonStyle =
                'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20';
              badgeStyle = 'bg-emerald-600 text-white';
            } else if (isSelected && !isOptionCorrect) {
              buttonStyle =
                'border-rose-500 bg-rose-50 text-rose-950 ring-2 ring-rose-500/20';
              badgeStyle = 'bg-rose-600 text-white';
            } else {
              buttonStyle =
                'border-slate-200 bg-slate-50 text-slate-400 opacity-65';
              badgeStyle = 'bg-slate-200 text-slate-500';
            }
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={isAnswered}
              data-testid={`option-button-${idx}`}
              onClick={() => handleSelectOption(idx)}
              className={`flex w-full items-center justify-between rounded-2xl border-2 p-4 text-left transition-all ${
                !isAnswered ? 'active:scale-[0.98]' : ''
              } ${buttonStyle}`}
            >
              <div className="flex items-center gap-3.5 pr-2">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold transition-colors ${badgeStyle}`}
                >
                  {OPTION_LABELS[idx]}
                </span>
                <span className="text-base font-bold leading-snug">
                  {option}
                </span>
              </div>

              {isAnswered && isOptionCorrect && (
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
              )}
              {isAnswered && isSelected && !isOptionCorrect && (
                <XCircle className="h-6 w-6 shrink-0 text-rose-600" />
              )}
            </button>
          );
        })}
      </div>

      {/* Instant Feedback & Explanation */}
      {isAnswered && (
        <div
          data-testid="feedback-panel"
          className={`mt-4 rounded-3xl border-2 p-4 shadow-sm transition-all ${
            isCorrect
              ? 'border-emerald-200 bg-emerald-50/90'
              : 'border-rose-200 bg-rose-50/90'
          }`}
        >
          <div className="flex items-center gap-2">
            {isCorrect ? (
              <>
                <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                <span
                  data-testid="feedback-status"
                  className="text-base font-extrabold text-emerald-800"
                >
                  正解！素晴らしい！
                </span>
              </>
            ) : (
              <>
                <XCircle className="h-6 w-6 text-rose-600 shrink-0" />
                <span
                  data-testid="feedback-status"
                  className="text-base font-extrabold text-rose-800"
                >
                  不正解… 正解は「{OPTION_LABELS[currentQuestion.answerIndex]}」
                </span>
              </>
            )}
          </div>

          <div className="mt-2.5 flex items-start gap-2 rounded-2xl bg-white/90 p-3 text-sm leading-relaxed text-slate-700">
            <Lightbulb className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
            <p data-testid="explanation-text">{currentQuestion.explanation}</p>
          </div>

          <button
            type="button"
            data-testid="next-question-button"
            onClick={handleNext}
            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-base font-extrabold text-white shadow-md transition-all active:scale-[0.98] hover:bg-indigo-700"
          >
            <span>
              {currentIndex + 1 < questions.length
                ? '次の問題へ'
                : '結果を見る'}
            </span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
};
