import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Eraser,
  Eye,
  EyeOff,
  Lightbulb,
  PenTool,
  RotateCcw,
  Sparkles,
  Trophy,
  Undo2,
  XCircle,
} from 'lucide-react';
import { KanjiCategory, KanjiItem, MissionType } from '../types/quiz';
import { CanvasPad } from '../utils/canvasPad';
import { HandwritingJudgeResult, recognizeAndJudgeKanji } from '../utils/handwritingRecognizer';
import { speechAudio } from '../utils/speechAudio';

interface KanjiViewProps {
  categories: KanjiCategory[];
  allKanjiItems: KanjiItem[];
  missionItems: KanjiItem[];
  weakIds: string[];
  autoStartMission?: boolean;
  onUpdateWeakResult: (kanjiId: string, isCorrect: boolean) => void;
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

type Stage = 'menu' | 'drill' | 'result';

function renderQuestionWithHighlight(question: string): React.ReactNode {
  const parts = question.split(/(［[^］]+］)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('［') && part.endsWith('］')) {
      return (
        <span
          key={idx}
          className="mx-0.5 inline-block rounded-lg border-b-2 border-rose-500 bg-rose-50 px-1.5 py-0.5 font-black text-rose-700"
        >
          {part.slice(1, -1)}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export const KanjiView: React.FC<KanjiViewProps> = ({
  categories,
  allKanjiItems,
  missionItems,
  weakIds,
  autoStartMission = false,
  onUpdateWeakResult,
  onSessionComplete,
  onBackHome,
}) => {
  const [stage, setStage] = useState<Stage>('menu');
  const [sessionTitle, setSessionTitle] = useState('');
  const [missionType, setMissionType] = useState<MissionType>('kanji');
  const [items, setItems] = useState<KanjiItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [wrongItems, setWrongItems] = useState<KanjiItem[]>([]);
  const [strokesCount, setStrokesCount] = useState(0);
  const [showModel, setShowModel] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isJudging, setIsJudging] = useState(false);
  const [judgeResult, setJudgeResult] = useState<HandwritingJudgeResult | null>(null);
  const [startTimeMs, setStartTimeMs] = useState<number>(Date.now());

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<CanvasPad | null>(null);
  const autoStartedRef = useRef(false);

  const currentItem = items[currentIdx];

  const startSession = (
    targetItems: KanjiItem[],
    title: string,
    type: MissionType
  ) => {
    if (targetItems.length === 0) return;
    setItems(targetItems);
    setSessionTitle(title);
    setMissionType(type);
    setCurrentIdx(0);
    setScore(0);
    setWrongItems([]);
    setStrokesCount(0);
    setShowModel(false);
    setShowHint(false);
    setJudgeResult(null);
    setStartTimeMs(Date.now());
    setStage('drill');
  };

  useEffect(() => {
    if (autoStartMission && !autoStartedRef.current && missionItems.length > 0) {
      autoStartedRef.current = true;
      startSession(missionItems, `今日の漢字ミッション（${missionItems.length}問）`, 'kanji');
    }
  }, [autoStartMission, missionItems]);

  // Initialize / update CanvasPad when entering drill or switching item
  useEffect(() => {
    if (stage !== 'drill' || !canvasRef.current || !currentItem) {
      return;
    }

    const pad = new CanvasPad(canvasRef.current, {
      strokeWidth: 7,
      onChange: (count) => setStrokesCount(count),
    });
    pad.setModelKanji(currentItem.kanji, false);
    padRef.current = pad;

    return () => {
      pad.destroy();
      padRef.current = null;
    };
  }, [stage, currentItem?.id]);

  const weakItems = useMemo(
    () => allKanjiItems.filter((k) => weakIds.includes(k.id)),
    [allKanjiItems, weakIds]
  );

  const handleToggleModel = () => {
    if (!padRef.current) return;
    const next = padRef.current.toggleModelKanji();
    setShowModel(next);
  };

  const handleUndo = () => {
    padRef.current?.undo();
  };

  const handleClear = () => {
    padRef.current?.clear();
  };

  const finalizeQuestionResult = (isCorrect: boolean) => {
    if (!currentItem) return;
    onUpdateWeakResult(currentItem.id, isCorrect);
    if (isCorrect) {
      setScore((prev) => prev + 1);
      speechAudio.playCorrect();
    } else {
      setWrongItems((prev) => [...prev, currentItem]);
      speechAudio.playWrong();
    }
  };

  const handleJudge = async () => {
    if (!padRef.current || !currentItem || isJudging) return;
    const ink = padRef.current.getInkData();
    if (ink.ink.length === 0) {
      setJudgeResult({
        isCorrect: false,
        rank: -1,
        candidates: [],
        confidence: 0,
        message: 'マス目に漢字を書いてから判定を押してください。',
      });
      return;
    }

    setIsJudging(true);
    const result = await recognizeAndJudgeKanji(ink, currentItem.kanji);
    setIsJudging(false);
    setJudgeResult(result);

    if (result.isCorrect !== null) {
      finalizeQuestionResult(result.isCorrect);
    }
  };

  const handleSelfJudge = (isCorrect: boolean) => {
    if (!judgeResult || !currentItem) return;
    setJudgeResult({
      ...judgeResult,
      isCorrect,
      isFallback: false,
      message: isCorrect
        ? `自己採点で正解！「${currentItem.kanji}」をよく書けました。`
        : `もう一度チェック！「${currentItem.kanji}」を苦手リストに追加しました。`,
    });
    finalizeQuestionResult(isCorrect);
  };

  const handleNext = () => {
    if (currentIdx + 1 < items.length) {
      setCurrentIdx((prev) => prev + 1);
      setStrokesCount(0);
      setShowModel(false);
      setShowHint(false);
      setJudgeResult(null);
    } else {
      const durationSec = Math.max(1, Math.round((Date.now() - startTimeMs) / 1000));
      if (score >= Math.ceil(items.length * 0.7)) {
        speechAudio.playFanfare();
      }
      onSessionComplete({
        missionType,
        unitTitle: sessionTitle,
        score,
        total: items.length,
        durationSec,
        wrongIds: wrongItems.map((w) => w.id),
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
          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">
            全{allKanjiItems.length}字収録
          </span>
        </div>

        <section className="rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-100">
            <PenTool className="h-4 w-4" />
            <span>手書き自動判定ドリル</span>
          </div>
          <h2 className="mt-1.5 text-xl font-extrabold">書いて覚える！中2漢字</h2>
          <p className="mt-1 text-xs text-blue-100 leading-relaxed">
            スマホの指書きでAIが漢字を自動判定。間違えた漢字は苦手リストに入り、日々のミッションで優先出題されます。
          </p>

          <button
            type="button"
            onClick={() =>
              startSession(
                missionItems,
                `今日の漢字ミッション（${missionItems.length}問）`,
                'kanji'
              )
            }
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-3.5 text-sm font-black text-slate-900 shadow-md transition active:scale-[0.98] hover:bg-amber-300"
          >
            <Sparkles className="h-4 w-4" />
            <span>今日の漢字ミッション開始（{missionItems.length}問）</span>
          </button>
        </section>

        {weakItems.length > 0 && (
          <button
            type="button"
            onClick={() =>
              startSession(
                weakItems.slice(0, 10),
                `苦手漢字の集中特訓（${Math.min(10, weakItems.length)}問）`,
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
                <p className="text-sm font-extrabold text-slate-900">
                  苦手漢字だけ特訓する
                </p>
                <p className="text-xs text-amber-800">
                  現在 {weakItems.length} 字が苦手リストに入っています
                </p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-amber-600" />
          </button>
        )}

        <section className="space-y-2.5">
          <h3 className="px-1 text-xs font-extrabold text-slate-600 uppercase tracking-wider">
            回・単元を選んで練習（各10問ピックアップ）
          </h3>
          <div className="grid grid-cols-1 gap-2.5">
            {categories.map((cat) => {
              const catItems =
                cat.id === 'custom_kanji'
                  ? allKanjiItems.filter((k) => k.isCustom)
                  : allKanjiItems.filter((k) => k.categoryId === cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() =>
                    startSession(
                      catItems.slice(0, 10),
                      `${cat.title}`,
                      'free'
                    )
                  }
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition active:scale-[0.98] hover:border-blue-300"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl shrink-0">{cat.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-slate-900">
                        {cat.title}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {cat.description}
                      </p>
                    </div>
                  </div>
                  <span className="ml-2 shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                    {catItems.length}字
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  if (stage === 'result') {
    const percent = items.length > 0 ? Math.round((score / items.length) * 100) : 0;
    return (
      <div className="space-y-4 pb-10">
        <section className="rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-center text-white shadow-lg">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
            <Trophy className="h-8 w-8 text-yellow-200" />
          </div>
          <p className="mt-2 text-xs font-bold text-blue-100">{sessionTitle}</p>
          <div className="mt-1 flex items-baseline justify-center gap-1">
            <span className="text-5xl font-black">{score}</span>
            <span className="text-lg font-bold text-blue-200">/ {items.length} 字正解</span>
          </div>
          <p className="mt-2 text-xs font-bold text-blue-100">
            正答率 {percent}% ・ 学習実績をサーバーへ記録しました！
          </p>
        </section>

        {wrongItems.length > 0 && (
          <section className="rounded-2xl border border-rose-200 bg-white p-4 shadow-sm space-y-2.5">
            <h3 className="text-sm font-extrabold text-rose-700">
              間違えた漢字のおさらい（{wrongItems.length}字）
            </h3>
            {wrongItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl bg-rose-50/60 p-3 border border-rose-100"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white border border-rose-200 text-2xl font-black text-slate-900">
                  {item.kanji}
                </div>
                <div className="text-xs">
                  <p className="font-extrabold text-slate-900">
                    {item.targetWord}（{item.targetReading}）
                  </p>
                  <p className="text-slate-600 mt-0.5">{item.hint}</p>
                </div>
              </div>
            ))}
          </section>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => startSession(items, sessionTitle, missionType)}
            className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-blue-200 bg-white py-3.5 text-sm font-extrabold text-blue-700"
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

  if (!currentItem) return null;

  const isEvaluated = judgeResult !== null && judgeResult.isCorrect !== null;

  return (
    <div className="space-y-3.5 pb-10">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStage('menu')}
          className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/70"
        >
          <ChevronLeft className="h-4 w-4" />
          一覧へ戻る
        </button>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
            {sessionTitle}
          </span>
          <span className="text-xs font-extrabold text-slate-700">
            {currentIdx + 1} / {items.length}
          </span>
        </div>
      </div>

      {/* Question Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
          <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
            部首: {currentItem.radical} ・ {currentItem.strokes}画
          </span>
          <button
            type="button"
            onClick={() => setShowHint((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 font-bold text-amber-700 border border-amber-200"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            {showHint ? 'ヒントを隠す' : 'ヒント'}
          </button>
        </div>

        <p className="text-lg font-extrabold leading-relaxed text-slate-900">
          {renderQuestionWithHighlight(currentItem.question)}
        </p>

        {showHint && (
          <p className="mt-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900 border border-amber-200">
            💡 {currentItem.hint}（音: {currentItem.on} / 訓: {currentItem.kun}）
          </p>
        )}
      </div>

      {/* Handwriting Canvas */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col items-center">
        <div className="relative w-full max-w-[280px] aspect-square rounded-2xl bg-slate-50 overflow-hidden shadow-inner">
          <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />
          <span className="absolute top-2 right-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-500 border border-slate-200">
            {strokesCount} 画
          </span>
        </div>

        {/* Canvas Controls */}
        <div className="mt-3 grid grid-cols-3 gap-2 w-full max-w-[280px]">
          <button
            type="button"
            onClick={handleToggleModel}
            className={`flex items-center justify-center gap-1 rounded-xl border py-2 text-xs font-bold transition ${
              showModel
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            {showModel ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            お手本
          </button>
          <button
            type="button"
            onClick={handleUndo}
            className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-bold text-slate-700 active:scale-95"
          >
            <Undo2 className="h-3.5 w-3.5" />
            1画戻す
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-bold text-slate-700 active:scale-95"
          >
            <Eraser className="h-3.5 w-3.5" />
            消す
          </button>
        </div>

        {!isEvaluated && !judgeResult?.isFallback && (
          <button
            type="button"
            disabled={isJudging}
            onClick={handleJudge}
            className="mt-3 flex w-full max-w-[280px] items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-extrabold text-white shadow-md transition active:scale-[0.98] disabled:opacity-60"
          >
            {isJudging ? 'AIで判定中...' : 'この漢字で判定する！'}
          </button>
        )}
      </div>

      {/* Feedback Area */}
      {judgeResult && (
        <div
          className={`rounded-3xl border-2 p-4 shadow-sm ${
            judgeResult.isCorrect === true
              ? 'border-emerald-300 bg-emerald-50'
              : judgeResult.isCorrect === false
              ? 'border-rose-300 bg-rose-50'
              : 'border-amber-300 bg-amber-50'
          }`}
        >
          <div className="flex items-center gap-2">
            {judgeResult.isCorrect === true && (
              <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
            )}
            {judgeResult.isCorrect === false && (
              <XCircle className="h-6 w-6 text-rose-600 shrink-0" />
            )}
            <p className="text-sm font-extrabold text-slate-900">
              {judgeResult.message}
            </p>
          </div>

          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-3 border border-slate-200">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-3xl font-black text-slate-900">
              {currentItem.kanji}
            </div>
            <div className="text-xs space-y-0.5">
              <p className="font-extrabold text-slate-900">
                正解の熟語: {currentItem.targetWord}（{currentItem.targetReading}）
              </p>
              <p className="text-slate-600">
                音読み: {currentItem.on} / 訓読み: {currentItem.kun}
              </p>
              {currentItem.examples.length > 0 && (
                <p className="text-slate-500">
                  熟語例: {currentItem.examples.join('・')}
                </p>
              )}
            </div>
          </div>

          {judgeResult.isFallback ? (
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleSelfJudge(true)}
                className="rounded-xl bg-emerald-600 py-3 text-xs font-extrabold text-white shadow-sm"
              >
                ⭕ 正しく書けた
              </button>
              <button
                type="button"
                onClick={() => handleSelfJudge(false)}
                className="rounded-xl bg-rose-600 py-3 text-xs font-extrabold text-white shadow-sm"
              >
                ❌ 間違えた・もう一度
              </button>
            </div>
          ) : (
            judgeResult.isCorrect !== null && (
              <button
                type="button"
                onClick={handleNext}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-extrabold text-white shadow-md transition active:scale-[0.98]"
              >
                <span>{currentIdx + 1 < items.length ? '次の漢字へ' : '結果を見る'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
};
