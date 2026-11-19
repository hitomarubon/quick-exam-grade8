import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Flame,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  XCircle,
  Zap,
} from 'lucide-react';
import { MissionType, VocabCategoryId, VocabWord } from '../types/quiz';
import { speechAudio } from '../utils/speechAudio';

interface VocabViewProps {
  allWords: VocabWord[];
  missionWords: VocabWord[];
  weakIds: string[];
  autoStartMission?: boolean;
  onUpdateWeakResult: (wordId: string, isCorrect: boolean) => void;
  onSessionComplete: (payload: {
    missionType: MissionType;
    unitTitle: string;
    score: number;
    total: number;
    durationSec: number;
    wrongIds: string[];
  }) => void;
  onBackHome: () => void;
}

type Stage = 'menu' | 'study' | 'result';
type VocabQuizMode = 'word_to_meaning' | 'meaning_to_word' | 'audio_to_meaning' | 'mixed';

interface QuestionStep {
  word: VocabWord;
  mode: Exclude<VocabQuizMode, 'mixed'>;
  options: Array<{ id: string; label: string; isCorrect: boolean }>;
}

const CATEGORY_INFO: Array<{
  id: VocabCategoryId;
  label: string;
  desc: string;
  badgeColor: string;
}> = [
  {
    id: 'jhs2',
    label: '中学2年生（標準）',
    desc: '過去形・助動詞・比較・不定詞の重要語彙',
    badgeColor: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: 'jhs1',
    label: '中学1年生（基礎）',
    desc: '英語の土台となる基本動詞・名詞・表現',
    badgeColor: 'bg-sky-100 text-sky-700',
  },
  {
    id: 'jhs3',
    label: '中学3年生（応用）',
    desc: '高校受験・入試頻出の重要単語',
    badgeColor: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'custom',
    label: 'カメラで追加した単語',
    desc: '教科書・ワークから取り込んだ単語',
    badgeColor: 'bg-purple-100 text-purple-700',
  },
];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildSteps(
  words: VocabWord[],
  allWords: VocabWord[],
  selectedMode: VocabQuizMode
): QuestionStep[] {
  return words.map((target) => {
    const modePool: Array<Exclude<VocabQuizMode, 'mixed'>> = [
      'word_to_meaning',
      'meaning_to_word',
      'audio_to_meaning',
    ];
    const resolvedMode =
      selectedMode === 'mixed'
        ? modePool[Math.floor(Math.random() * modePool.length)]
        : selectedMode;

    const sameCat = allWords.filter(
      (w) => w.category === target.category && w.id !== target.id && w.meaning !== target.meaning
    );
    const fallbackPool =
      sameCat.length >= 3
        ? sameCat
        : allWords.filter((w) => w.id !== target.id && w.meaning !== target.meaning);

    const distractors = shuffle(fallbackPool).slice(0, 3);
    const rawOptions = [
      {
        id: target.id,
        label: resolvedMode === 'meaning_to_word' ? target.word : target.meaning,
        isCorrect: true,
      },
      ...distractors.map((d) => ({
        id: d.id,
        label: resolvedMode === 'meaning_to_word' ? d.word : d.meaning,
        isCorrect: false,
      })),
    ];

    return {
      word: target,
      mode: resolvedMode,
      options: shuffle(rawOptions),
    };
  });
}

export const VocabView: React.FC<VocabViewProps> = ({
  allWords,
  missionWords,
  weakIds,
  autoStartMission = false,
  onUpdateWeakResult,
  onSessionComplete,
  onBackHome,
}) => {
  const [stage, setStage] = useState<Stage>('menu');
  const [quizMode, setQuizMode] = useState<VocabQuizMode>('word_to_meaning');
  const [limitMs, setLimitMs] = useState<number>(3000);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => speechAudio.isEnabled());

  const [sessionTitle, setSessionTitle] = useState('');
  const [missionType, setMissionType] = useState<MissionType>('vocab');
  const [steps, setSteps] = useState<QuestionStep[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [remainingMs, setRemainingMs] = useState(3000);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [wrongWords, setWrongWords] = useState<VocabWord[]>([]);
  const [sessionStartMs, setSessionStartMs] = useState<number>(Date.now());

  const autoStartedRef = useRef(false);
  const currentStep = steps[currentIdx];
  const isAnswered = selectedOptionId !== null || timedOut;

  const weakWords = useMemo(
    () => allWords.filter((w) => weakIds.includes(w.id)),
    [allWords, weakIds]
  );

  const startSession = (
    words: VocabWord[],
    title: string,
    type: MissionType,
    modeOverride?: VocabQuizMode
  ) => {
    if (words.length === 0) return;
    const modeToUse = modeOverride || quizMode;
    const built = buildSteps(words, allWords, modeToUse);
    setSteps(built);
    setSessionTitle(title);
    setMissionType(type);
    setCurrentIdx(0);
    setSelectedOptionId(null);
    setTimedOut(false);
    setRemainingMs(limitMs);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setWrongWords([]);
    setSessionStartMs(Date.now());
    setStage('study');
  };

  useEffect(() => {
    if (autoStartMission && !autoStartedRef.current && missionWords.length > 0) {
      autoStartedRef.current = true;
      startSession(
        missionWords,
        `今日の英単語ミッション（${missionWords.length}語）`,
        'vocab',
        'word_to_meaning'
      );
    }
  }, [autoStartMission, missionWords]);

  // Speak word when question starts
  useEffect(() => {
    if (stage !== 'study' || !currentStep) return;
    if (
      currentStep.mode === 'audio_to_meaning' ||
      currentStep.mode === 'word_to_meaning'
    ) {
      speechAudio.speakEnglish(currentStep.word.word);
    }
  }, [stage, currentIdx, currentStep?.word.id]);

  // Countdown timer per question
  useEffect(() => {
    if (stage !== 'study' || !currentStep || isAnswered) return;

    const startedAt = Date.now();
    setRemainingMs(limitMs);

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const left = Math.max(0, limitMs - elapsed);
      setRemainingMs(left);

      if (left <= 0) {
        window.clearInterval(timer);
        setTimedOut(true);
        setCombo(0);
        speechAudio.playTimeout();
        onUpdateWeakResult(currentStep.word.id, false);
        setWrongWords((prev) => [...prev, currentStep.word]);
      }
    }, 50);

    return () => window.clearInterval(timer);
  }, [stage, currentIdx, isAnswered, limitMs, currentStep?.word.id]);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    speechAudio.setEnabled(next);
  };

  const handleSelectOption = (opt: { id: string; label: string; isCorrect: boolean }) => {
    if (isAnswered || !currentStep) return;
    setSelectedOptionId(opt.id);
    onUpdateWeakResult(currentStep.word.id, opt.isCorrect);

    if (opt.isCorrect) {
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setMaxCombo((prev) => Math.max(prev, nextCombo));
      setScore((prev) => prev + 1);
      if (nextCombo >= 2) {
        speechAudio.playCombo(nextCombo);
      } else {
        speechAudio.playCorrect();
      }
    } else {
      setCombo(0);
      setWrongWords((prev) => [...prev, currentStep.word]);
      speechAudio.playWrong();
    }
  };

  const handleNext = () => {
    if (currentIdx + 1 < steps.length) {
      setCurrentIdx((prev) => prev + 1);
      setSelectedOptionId(null);
      setTimedOut(false);
      setRemainingMs(limitMs);
    } else {
      const durationSec = Math.max(1, Math.round((Date.now() - sessionStartMs) / 1000));
      if (score >= Math.ceil(steps.length * 0.7)) {
        speechAudio.playFanfare();
      }
      onSessionComplete({
        missionType,
        unitTitle: sessionTitle,
        score,
        total: steps.length,
        durationSec,
        wrongIds: wrongWords.map((w) => w.id),
      });
      setStage('result');
    }
  };

  if (stage === 'menu') {
    return (
      <div className="space-y-4 pb-10">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/70"
          >
            <ChevronLeft className="h-4 w-4" />
            ホームへ
          </button>
          <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700">
            中学英単語 {allWords.length}語収録
          </span>
        </div>

        <section className="rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700 p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-100">
            <Zap className="h-4 w-4" />
            <span>3秒フラッシュ記憶</span>
          </div>
          <h2 className="mt-1.5 text-xl font-extrabold">瞬時に引き出す！英単語速答</h2>
          <p className="mt-1 text-xs text-indigo-100 leading-relaxed">
            1問3秒のテンポで反射的に英単語の意味を定着させます。音声読み上げにも対応！
          </p>

          <button
            type="button"
            onClick={() =>
              startSession(
                missionWords,
                `今日の英単語ミッション（${missionWords.length}語）`,
                'vocab'
              )
            }
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-3.5 text-sm font-black text-slate-900 shadow-md transition active:scale-[0.98] hover:bg-amber-300"
          >
            <Sparkles className="h-4 w-4" />
            <span>今日の英単語ミッション開始（{missionWords.length}語）</span>
          </button>
        </section>

        {/* Settings Card */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div>
            <p className="text-xs font-extrabold text-slate-700 mb-1.5">出題形式</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'word_to_meaning', label: '英語 → 意味' },
                  { id: 'meaning_to_word', label: '意味 → 英語' },
                  { id: 'audio_to_meaning', label: '音声 → 意味' },
                  { id: 'mixed', label: 'ミックス' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setQuizMode(m.id)}
                  className={`rounded-xl border py-2 text-xs font-bold transition ${
                    quizMode === m.id
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-extrabold text-slate-700">1問の制限時間</span>
            <div className="flex gap-1.5">
              {[3000, 5000].map((ms) => (
                <button
                  key={ms}
                  type="button"
                  onClick={() => setLimitMs(ms)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold border ${
                    limitMs === ms
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {ms / 1000}秒
                </button>
              ))}
            </div>
          </div>
        </section>

        {weakWords.length > 0 && (
          <button
            type="button"
            onClick={() =>
              startSession(
                shuffle(weakWords).slice(0, 15),
                `苦手単語特訓（${Math.min(15, weakWords.length)}語）`,
                'free'
              )
            }
            className="flex w-full items-center justify-between rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-left transition active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-900">苦手単語だけ特訓する</p>
                <p className="text-xs text-amber-800">現在 {weakWords.length} 語が要復習です</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-amber-600" />
          </button>
        )}

        <section className="space-y-2.5">
          <h3 className="px-1 text-xs font-extrabold text-slate-600 uppercase tracking-wider">
            学年・区分を選んで練習（10語）
          </h3>
          {CATEGORY_INFO.map((cat) => {
            const pool = allWords.filter((w) => w.category === cat.id);
            if (cat.id === 'custom' && pool.length === 0) return null;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() =>
                  startSession(shuffle(pool).slice(0, 10), `${cat.label} 10語`, 'free')
                }
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition active:scale-[0.98] hover:border-indigo-300"
              >
                <div>
                  <p className="text-sm font-extrabold text-slate-900">{cat.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{cat.desc}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cat.badgeColor}`}>
                  {pool.length}語
                </span>
              </button>
            );
          })}
        </section>
      </div>
    );
  }

  if (stage === 'result') {
    const percent = steps.length > 0 ? Math.round((score / steps.length) * 100) : 0;
    return (
      <div className="space-y-4 pb-10">
        <section className="rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-center text-white shadow-lg">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
            <Trophy className="h-8 w-8 text-yellow-200" />
          </div>
          <p className="mt-2 text-xs font-bold text-indigo-100">{sessionTitle}</p>
          <div className="mt-1 flex items-baseline justify-center gap-1">
            <span className="text-5xl font-black">{score}</span>
            <span className="text-lg font-bold text-indigo-200">/ {steps.length} 語正解</span>
          </div>
          <p className="mt-2 text-xs font-bold text-indigo-100">
            正答率 {percent}% ・ 最大コンボ {maxCombo} ・ サーバーへ記録済み！
          </p>
        </section>

        {wrongWords.length > 0 && (
          <section className="rounded-2xl border border-rose-200 bg-white p-4 shadow-sm space-y-2">
            <h3 className="text-sm font-extrabold text-rose-700">
              間違えた・時間切れ単語（{wrongWords.length}語）
            </h3>
            {wrongWords.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between rounded-xl bg-rose-50/60 p-3 border border-rose-100"
              >
                <div>
                  <p className="text-sm font-extrabold text-slate-900">
                    {w.word}{' '}
                    <span className="text-[11px] font-normal text-slate-500">
                      [{w.partOfSpeech}]
                    </span>
                  </p>
                  <p className="text-xs font-bold text-rose-700">{w.meaning}</p>
                </div>
                <button
                  type="button"
                  onClick={() => speechAudio.speakEnglish(w.word)}
                  className="rounded-full bg-white p-2 text-indigo-600 border border-indigo-200"
                  title="発音を聞く"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </section>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() =>
              startSession(
                steps.map((s) => s.word),
                sessionTitle,
                missionType
              )
            }
            className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-indigo-200 bg-white py-3.5 text-sm font-extrabold text-indigo-700"
          >
            <RotateCcw className="h-4 w-4" />
            もう一度
          </button>
          <button
            type="button"
            onClick={onBackHome}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-indigo-600 py-3.5 text-sm font-extrabold text-white shadow-md"
          >
            ホームへ戻る
          </button>
        </div>
      </div>
    );
  }

  if (!currentStep) return null;

  const timerRatio = Math.max(0, Math.min(100, Math.round((remainingMs / limitMs) * 100)));
  const timerColor =
    timerRatio > 50 ? 'bg-emerald-500' : timerRatio > 25 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            speechAudio.stopSpeech();
            setStage('menu');
          }}
          className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/70"
        >
          <ChevronLeft className="h-4 w-4" />
          終了
        </button>

        <div className="flex items-center gap-2">
          {combo >= 2 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-700">
              <Flame className="h-3.5 w-3.5" />
              {combo} COMBO
            </span>
          )}
          <button
            type="button"
            onClick={handleToggleSound}
            className="rounded-lg bg-slate-200/70 p-1.5 text-slate-700"
            title="音声ON/OFF"
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <span className="text-xs font-extrabold text-slate-700">
            {currentIdx + 1} / {steps.length}
          </span>
        </div>
      </div>

      {/* 3-second Timer Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[11px] font-bold text-slate-500">
          <span>残り時間</span>
          <span className={timerRatio <= 25 ? 'text-rose-600 font-black' : ''}>
            {(remainingMs / 1000).toFixed(1)} 秒
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full transition-all duration-75 ${timerColor}`}
            style={{ width: `${timerRatio}%` }}
          />
        </div>
      </div>

      {/* Prompt Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <span className="inline-block rounded-full bg-indigo-50 px-3 py-0.5 text-[11px] font-bold text-indigo-700">
          {currentStep.word.partOfSpeech}
        </span>

        {currentStep.mode === 'audio_to_meaning' ? (
          <div className="my-4 flex flex-col items-center">
            <button
              type="button"
              onClick={() => speechAudio.speakEnglish(currentStep.word.word)}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md transition active:scale-95"
            >
              <Volume2 className="h-8 w-8" />
            </button>
            <p className="mt-2 text-xs font-bold text-slate-500">
              発音を聞いて正しい意味を選ぼう
            </p>
            {isAnswered && (
              <p className="mt-2 text-2xl font-black text-indigo-700">
                {currentStep.word.word}
              </p>
            )}
          </div>
        ) : currentStep.mode === 'meaning_to_word' ? (
          <h2 className="my-4 text-2xl font-black text-slate-900">
            {currentStep.word.meaning}
          </h2>
        ) : (
          <div className="my-3 flex flex-col items-center">
            <h2 className="text-3xl font-black tracking-tight text-slate-900">
              {currentStep.word.word}
            </h2>
            <button
              type="button"
              onClick={() => speechAudio.speakEnglish(currentStep.word.word)}
              className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200"
            >
              <Volume2 className="h-3.5 w-3.5 text-indigo-600" />
              発音を聞く
            </button>
          </div>
        )}
      </div>

      {/* Options */}
      <div className="space-y-2.5">
        {currentStep.options.map((opt) => {
          const isSelected = selectedOptionId === opt.id;
          let style =
            'border-slate-200 bg-white text-slate-800 hover:border-indigo-300';
          if (isAnswered) {
            if (opt.isCorrect) {
              style = 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20';
            } else if (isSelected) {
              style = 'border-rose-500 bg-rose-50 text-rose-900 ring-2 ring-rose-500/20';
            } else {
              style = 'border-slate-200 bg-slate-50 text-slate-400 opacity-65';
            }
          }

          return (
            <button
              key={opt.id}
              type="button"
              disabled={isAnswered}
              onClick={() => handleSelectOption(opt)}
              className={`flex w-full items-center justify-between rounded-2xl border-2 p-4 text-left text-base font-bold transition ${
                !isAnswered ? 'active:scale-[0.98]' : ''
              } ${style}`}
            >
              <span>{opt.label}</span>
              {isAnswered && opt.isCorrect && (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              )}
              {isAnswered && isSelected && !opt.isCorrect && (
                <XCircle className="h-5 w-5 text-rose-600 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Feedback & Next */}
      {isAnswered && (
        <div
          className={`rounded-3xl border-2 p-4 ${
            timedOut
              ? 'border-amber-300 bg-amber-50'
              : currentStep.options.find((o) => o.id === selectedOptionId)?.isCorrect
              ? 'border-emerald-300 bg-emerald-50'
              : 'border-rose-300 bg-rose-50'
          }`}
        >
          <p className="text-sm font-extrabold text-slate-900">
            {timedOut
              ? `時間切れ！正解は「${currentStep.word.word} ＝ ${currentStep.word.meaning}」`
              : currentStep.options.find((o) => o.id === selectedOptionId)?.isCorrect
              ? `正解！ ${currentStep.word.word} ＝ ${currentStep.word.meaning}`
              : `惜しい！正解は「${currentStep.word.word} ＝ ${currentStep.word.meaning}」`}
          </p>
          <button
            type="button"
            onClick={handleNext}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-extrabold text-white shadow-md transition active:scale-[0.98]"
          >
            <span>{currentIdx + 1 < steps.length ? '次の単語へ' : '結果を見る'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};
