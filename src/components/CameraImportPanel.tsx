import React, { useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  ALL_SUBJECTS,
  KanjiItem,
  Question,
  Subject,
  Unit,
  VocabWord,
} from '../types/quiz';
import {
  ExtractedKanjiDraft,
  ExtractedQuestionDraft,
  ExtractedUnitDraft,
  ExtractedVocabDraft,
  SelectedImageItem,
  extractKanjiFromImages,
  extractQuestionsFromImages,
  extractUnitsFromImages,
  extractVocabFromImages,
  loadGeminiApiKey,
  resizeImageFile,
  saveGeminiApiKey,
} from '../services/geminiOcrService';

interface CameraImportPanelProps {
  allUnits: Unit[];
  onAddUnits: (units: Unit[]) => Promise<void>;
  onDeleteCustomUnit: (unitId: string) => Promise<void>;
  onAddQuestions: (questions: Question[]) => Promise<void>;
  onAddKanji: (items: KanjiItem[]) => Promise<void>;
  onAddVocab: (words: VocabWord[]) => Promise<void>;
}

type ImportMode = 'questions' | 'units' | 'kanji' | 'vocab';

export const CameraImportPanel: React.FC<CameraImportPanelProps> = ({
  allUnits,
  onAddUnits,
  onDeleteCustomUnit,
  onAddQuestions,
  onAddKanji,
  onAddVocab,
}) => {
  const [importMode, setImportMode] = useState<ImportMode>('questions');
  const [selectedSubject, setSelectedSubject] = useState<Subject>('理科');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('sci-1');
  const [textbookName, setTextbookName] = useState<string>('啓林館 教科書ワーク');

  const [apiKey, setApiKey] = useState<string>(() => loadGeminiApiKey());
  const [showApiKeyBox, setShowApiKeyBox] = useState<boolean>(() => !loadGeminiApiKey());

  const [images, setImages] = useState<SelectedImageItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [unitDrafts, setUnitDrafts] = useState<ExtractedUnitDraft[]>([]);
  const [questionDrafts, setQuestionDrafts] = useState<ExtractedQuestionDraft[]>([]);
  const [kanjiDrafts, setKanjiDrafts] = useState<ExtractedKanjiDraft[]>([]);
  const [vocabDrafts, setVocabDrafts] = useState<ExtractedVocabDraft[]>([]);

  const [manualUnitTitle, setManualUnitTitle] = useState('');
  const [unitListFilter, setUnitListFilter] = useState<Subject>('理科');

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const albumInputRef = useRef<HTMLInputElement | null>(null);

  const subjectUnits = useMemo(
    () => allUnits.filter((u) => u.subject === selectedSubject),
    [allUnits, selectedSubject]
  );

  const filteredUnitsList = useMemo(
    () => allUnits.filter((u) => u.subject === unitListFilter),
    [allUnits, unitListFilter]
  );

  const handleSubjectChange = (subj: Subject) => {
    setSelectedSubject(subj);
    setTextbookName(subj === '理科' ? '啓林館 教科書ワーク' : '文理 教科書ワーク');
    const firstUnit = allUnits.find((u) => u.subject === subj);
    if (firstUnit) setSelectedUnitId(firstUnit.id);
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMessage('');
    try {
      const processed = await Promise.all(
        Array.from(files).map((file) => resizeImageFile(file, 1600))
      );
      setImages((prev) => [...prev, ...processed]);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '画像の読み込みに失敗しました。');
    }
  };

  const handleAnalyze = async () => {
    if (images.length === 0) {
      setErrorMessage('先にページを撮影するか、写真を選んでください。');
      return;
    }
    if (!apiKey.trim()) {
      setShowApiKeyBox(true);
      setErrorMessage('Gemini APIキーを入力してください。');
      return;
    }

    saveGeminiApiKey(apiKey);
    setIsAnalyzing(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      if (importMode === 'units') {
        const nextOrder = subjectUnits.length > 0 ? Math.max(...subjectUnits.map((u) => u.order)) + 1 : 1;
        const result = await extractUnitsFromImages(
          apiKey,
          images,
          selectedSubject,
          textbookName,
          nextOrder
        );
        setUnitDrafts(result);
        setStatusMessage(`${result.length} 件の単元候補を読み取りました。内容を確認して登録してください。`);
      } else if (importMode === 'questions') {
        const targetUnit = allUnits.find((u) => u.id === selectedUnitId);
        const unitTitle = targetUnit?.title || selectedSubject;
        const result = await extractQuestionsFromImages(
          apiKey,
          images,
          selectedSubject,
          unitTitle
        );
        setQuestionDrafts(result);
        setStatusMessage(`${result.length} 問の4択問題を生成しました。確認して登録してください。`);
      } else if (importMode === 'kanji') {
        const result = await extractKanjiFromImages(apiKey, images);
        setKanjiDrafts(result);
        setStatusMessage(`${result.length} 字の漢字問題を読み取りました。`);
      } else {
        const result = await extractVocabFromImages(apiKey, images);
        setVocabDrafts(result);
        setStatusMessage(`${result.length} 語の英単語を読み取りました。`);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'AI解析に失敗しました。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveDrafts = async () => {
    setErrorMessage('');
    const nowIso = new Date().toISOString();

    try {
      if (importMode === 'units') {
        const checked = unitDrafts.filter((d) => d.checked && d.title.trim());
        if (checked.length === 0) return;
        const toAdd: Unit[] = checked.map((d, idx) => ({
          id: `custom_unit_${Date.now()}_${idx}`,
          subject: selectedSubject,
          textbook: (textbookName.trim() || '教科書ワーク').slice(0, 80),
          order: Math.min(500, Math.max(1, Math.round(Number(d.order) || idx + 1))),
          title: d.title.trim().slice(0, 160),
          isCustom: true,
          createdAt: nowIso,
        }));
        await onAddUnits(toAdd);
        setUnitDrafts([]);
        setImages([]);
        setStatusMessage(`${toAdd.length} 件の単元を追加・同期しました！`);
      } else if (importMode === 'questions') {
        const checked = questionDrafts.filter((d) => d.checked && d.question.trim());
        if (checked.length === 0) return;
        const targetUnit = allUnits.find((u) => u.id === selectedUnitId);
        const toAdd: Question[] = checked.map((d, idx) => ({
          id: `custom_q_${Date.now()}_${idx}`,
          subject: selectedSubject,
          category: (targetUnit?.title || selectedSubject).slice(0, 200),
          unitId: selectedUnitId,
          question: d.question.trim().slice(0, 1000),
          options: d.options.map((o) => o.slice(0, 500)) as [string, string, string, string],
          answerIndex: Math.min(3, Math.max(0, Math.round(d.answerIndex))),
          explanation: d.explanation.trim().slice(0, 1000),
          isCustom: true,
        }));
        await onAddQuestions(toAdd);
        setQuestionDrafts([]);
        setImages([]);
        setStatusMessage(`${toAdd.length} 問の問題を追加・同期しました！`);
      } else if (importMode === 'kanji') {
        const checked = kanjiDrafts.filter((d) => d.checked && d.kanji.trim());
        if (checked.length === 0) return;
        const toAdd: KanjiItem[] = checked.map((d, idx) => ({
          id: `custom_kanji_${Date.now()}_${idx}`,
          categoryId: 'custom_kanji',
          kanji: d.kanji.trim().charAt(0),
          question: d.question.trim().slice(0, 300),
          targetWord: d.targetWord.trim().slice(0, 40),
          targetCharReading: d.targetCharReading.trim().slice(0, 40),
          targetReading: d.targetReading.trim().slice(0, 60),
          on: d.on.slice(0, 80),
          kun: d.kun.slice(0, 120),
          strokes: Math.min(64, Math.max(1, Math.round(Number(d.strokes) || 10))),
          radical: d.radical.slice(0, 60),
          hint: d.hint.slice(0, 300),
          examples: d.examples.slice(0, 10).map((ex) => String(ex).slice(0, 40)),
          isCustom: true,
        }));
        await onAddKanji(toAdd);
        setKanjiDrafts([]);
        setImages([]);
        setStatusMessage(`${toAdd.length} 字の漢字を追加・同期しました！`);
      } else {
        const checked = vocabDrafts.filter((d) => d.checked && d.word.trim() && d.meaning.trim());
        if (checked.length === 0) return;
        const toAdd: VocabWord[] = checked.map((d, idx) => ({
          id: `custom_vocab_${Date.now()}_${idx}`,
          word: d.word.trim().slice(0, 80),
          meaning: d.meaning.trim().slice(0, 200),
          partOfSpeech: (d.partOfSpeech.trim() || '単語').slice(0, 40),
          category: 'custom',
          isCustom: true,
        }));
        await onAddVocab(toAdd);
        setVocabDrafts([]);
        setImages([]);
        setStatusMessage(`${toAdd.length} 語の英単語を追加・同期しました！`);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '保存中にエラーが発生しました。');
    }
  };

  const handleAddManualUnit = async () => {
    const title = manualUnitTitle.trim();
    if (!title) return;
    const sameSubject = allUnits.filter((u) => u.subject === unitListFilter);
    const nextOrder = sameSubject.length > 0 ? Math.max(...sameSubject.map((u) => u.order)) + 1 : 1;
    await onAddUnits([
      {
        id: `custom_unit_${Date.now()}`,
        subject: unitListFilter,
        textbook: unitListFilter === '理科' ? '啓林館 教科書ワーク' : '文理 教科書ワーク',
        order: nextOrder,
        title,
        isCustom: true,
        createdAt: new Date().toISOString(),
      },
    ]);
    setManualUnitTitle('');
    setStatusMessage(`単元「${title}」を追加しました。`);
  };

  const hasDrafts =
    (importMode === 'units' && unitDrafts.length > 0) ||
    (importMode === 'questions' && questionDrafts.length > 0) ||
    (importMode === 'kanji' && kanjiDrafts.length > 0) ||
    (importMode === 'vocab' && vocabDrafts.length > 0);

  return (
    <div className="space-y-4">
      {/* Gemini API Key Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-purple-600" />
            <span className="text-xs font-extrabold text-slate-800">
              AI画像読み取り（Gemini API）
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowApiKeyBox((prev) => !prev)}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              apiKey.trim()
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-rose-100 text-rose-700'
            }`}
          >
            {apiKey.trim() ? '設定済み（変更）' : '未設定（タップして入力）'}
          </button>
        </div>

        {showApiKeyBox && (
          <div className="mt-2.5 space-y-2 border-t border-slate-100 pt-2.5">
            <p className="text-[11px] text-slate-500">
              Google AI Studio の無料 Gemini APIキーを貼り付けてください（この端末内に保存されます）。
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza..."
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  saveGeminiApiKey(apiKey);
                  setShowApiKeyBox(false);
                  setStatusMessage('Gemini APIキーを保存しました。');
                }}
                className="rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-bold text-white"
              >
                保存
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mode Selector */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <p className="text-xs font-extrabold text-slate-700">1. 撮影して追加する内容を選ぶ</p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { id: 'questions', label: '📝 問題ページ → 4択作成' },
              { id: 'units', label: '📑 目次ページ → 単元登録' },
              { id: 'kanji', label: '✍️ 漢字プリント → 手書き登録' },
              { id: 'vocab', label: '🔤 英単語帳 → 単語登録' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setImportMode(tab.id);
                setErrorMessage('');
              }}
              className={`rounded-xl border px-2.5 py-2.5 text-left text-xs font-bold transition ${
                importMode === tab.id
                  ? 'border-purple-600 bg-purple-50 text-purple-800'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {(importMode === 'questions' || importMode === 'units') && (
          <div className="grid grid-cols-1 gap-2.5 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">教科</label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_SUBJECTS.map((subj) => (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => handleSubjectChange(subj)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold border ${
                      selectedSubject === subj
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    {subj}
                  </button>
                ))}
              </div>
            </div>

            {importMode === 'units' ? (
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  教材・教科書名
                </label>
                <input
                  type="text"
                  value={textbookName}
                  onChange={(e) => setTextbookName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  登録先の単元
                </label>
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
                >
                  {subjectUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.order}. {u.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Camera / File Upload */}
        <div className="pt-1 space-y-2.5">
          <p className="text-xs font-extrabold text-slate-700">2. 教科書・ワークを撮影する</p>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={albumInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              e.target.value = '';
            }}
          />
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 py-3 text-xs font-extrabold text-white shadow-sm active:scale-95"
            >
              <Camera className="h-4 w-4" />
              カメラで撮影
            </button>
            <button
              type="button"
              onClick={() => albumInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-purple-300 bg-purple-50 py-3 text-xs font-extrabold text-purple-800 active:scale-95"
            >
              <ImageIcon className="h-4 w-4" />
              写真を選ぶ
            </button>
          </div>

          {images.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {images.map((img, idx) => (
                  <div
                    key={img.id}
                    className="relative h-20 w-20 overflow-hidden rounded-xl border border-slate-200"
                  >
                    <img
                      src={img.dataUrl}
                      alt={`撮影${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setImages((prev) => prev.filter((item) => item.id !== img.id))
                      }
                      className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={handleAnalyze}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-extrabold text-white shadow-md disabled:opacity-60"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AIが写真を解析しています...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    AIで読み取って作成する（{images.length}枚）
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
          {errorMessage}
        </div>
      )}

      {statusMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
          {statusMessage}
        </div>
      )}

      {/* Preview & Edit Drafts */}
      {hasDrafts && (
        <div className="rounded-2xl border-2 border-purple-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-extrabold text-slate-900">
              読み取り結果の確認・編集
            </h4>
            <button
              type="button"
              onClick={handleSaveDrafts}
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-sm"
            >
              <Check className="h-4 w-4" />
              チェック項目を登録
            </button>
          </div>

          {importMode === 'units' && (
            <div className="space-y-2">
              {unitDrafts.map((draft, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5"
                >
                  <input
                    type="checkbox"
                    checked={draft.checked}
                    onChange={(e) =>
                      setUnitDrafts((prev) =>
                        prev.map((d, i) =>
                          i === idx ? { ...d, checked: e.target.checked } : d
                        )
                      )
                    }
                    className="h-4 w-4 accent-purple-600"
                  />
                  <input
                    type="number"
                    value={draft.order}
                    onChange={(e) =>
                      setUnitDrafts((prev) =>
                        prev.map((d, i) =>
                          i === idx ? { ...d, order: Number(e.target.value) || 1 } : d
                        )
                      )
                    }
                    className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold"
                  />
                  <input
                    type="text"
                    value={draft.title}
                    onChange={(e) =>
                      setUnitDrafts((prev) =>
                        prev.map((d, i) =>
                          i === idx ? { ...d, title: e.target.value } : d
                        )
                      )
                    }
                    className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold"
                  />
                </div>
              ))}
            </div>
          )}

          {importMode === 'questions' && (
            <div className="space-y-3">
              {questionDrafts.map((draft, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50/50"
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={draft.checked}
                      onChange={(e) =>
                        setQuestionDrafts((prev) =>
                          prev.map((d, i) =>
                            i === idx ? { ...d, checked: e.target.checked } : d
                          )
                        )
                      }
                      className="mt-1 h-4 w-4 accent-purple-600"
                    />
                    <textarea
                      rows={2}
                      value={draft.question}
                      onChange={(e) =>
                        setQuestionDrafts((prev) =>
                          prev.map((d, i) =>
                            i === idx ? { ...d, question: e.target.value } : d
                          )
                        )
                      }
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {draft.options.map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-1">
                        <input
                          type="radio"
                          name={`ans_${idx}`}
                          checked={draft.answerIndex === optIdx}
                          onChange={() =>
                            setQuestionDrafts((prev) =>
                              prev.map((d, i) =>
                                i === idx ? { ...d, answerIndex: optIdx } : d
                              )
                            )
                          }
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) =>
                            setQuestionDrafts((prev) =>
                              prev.map((d, i) => {
                                if (i !== idx) return d;
                                const nextOpts = [...d.options] as [
                                  string,
                                  string,
                                  string,
                                  string,
                                ];
                                nextOpts[optIdx] = e.target.value;
                                return { ...d, options: nextOpts };
                              })
                            )
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]"
                        />
                      </div>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={draft.explanation}
                    onChange={(e) =>
                      setQuestionDrafts((prev) =>
                        prev.map((d, i) =>
                          i === idx ? { ...d, explanation: e.target.value } : d
                        )
                      )
                    }
                    placeholder="解説"
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600"
                  />
                </div>
              ))}
            </div>
          )}

          {importMode === 'kanji' && (
            <div className="space-y-2">
              {kanjiDrafts.map((draft, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 p-2.5 space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.checked}
                      onChange={(e) =>
                        setKanjiDrafts((prev) =>
                          prev.map((d, i) =>
                            i === idx ? { ...d, checked: e.target.checked } : d
                          )
                        )
                      }
                    />
                    <input
                      type="text"
                      maxLength={1}
                      value={draft.kanji}
                      onChange={(e) =>
                        setKanjiDrafts((prev) =>
                          prev.map((d, i) =>
                            i === idx ? { ...d, kanji: e.target.value } : d
                          )
                        )
                      }
                      className="w-10 rounded-lg border border-blue-300 bg-blue-50 py-1 text-center text-base font-black"
                    />
                    <input
                      type="text"
                      value={draft.targetWord}
                      onChange={(e) =>
                        setKanjiDrafts((prev) =>
                          prev.map((d, i) =>
                            i === idx ? { ...d, targetWord: e.target.value } : d
                          )
                        )
                      }
                      placeholder="熟語"
                      className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold"
                    />
                    <input
                      type="text"
                      value={draft.question}
                      onChange={(e) =>
                        setKanjiDrafts((prev) =>
                          prev.map((d, i) =>
                            i === idx ? { ...d, question: e.target.value } : d
                          )
                        )
                      }
                      placeholder="問題文"
                      className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {importMode === 'vocab' && (
            <div className="space-y-2">
              {vocabDrafts.map((draft, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 p-2"
                >
                  <input
                    type="checkbox"
                    checked={draft.checked}
                    onChange={(e) =>
                      setVocabDrafts((prev) =>
                        prev.map((d, i) =>
                          i === idx ? { ...d, checked: e.target.checked } : d
                        )
                      )
                    }
                  />
                  <input
                    type="text"
                    value={draft.word}
                    onChange={(e) =>
                      setVocabDrafts((prev) =>
                        prev.map((d, i) =>
                          i === idx ? { ...d, word: e.target.value } : d
                        )
                      )
                    }
                    className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold"
                  />
                  <input
                    type="text"
                    value={draft.meaning}
                    onChange={(e) =>
                      setVocabDrafts((prev) =>
                        prev.map((d, i) =>
                          i === idx ? { ...d, meaning: e.target.value } : d
                        )
                      )
                    }
                    className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Existing & Custom Unit Manager */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-extrabold text-slate-800">登録済み単元一覧・手動追加</h4>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {ALL_SUBJECTS.map((subj) => (
            <button
              key={subj}
              type="button"
              onClick={() => setUnitListFilter(subj)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border ${
                unitListFilter === subj
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              {subj}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={manualUnitTitle}
            onChange={(e) => setManualUnitTitle(e.target.value)}
            placeholder={`${unitListFilter}の単元名を手動で追加...`}
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs"
          />
          <button
            type="button"
            onClick={handleAddManualUnit}
            className="inline-flex items-center gap-1 rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            追加
          </button>
        </div>

        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
          {filteredUnitsList.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                <span className="font-extrabold text-slate-800">
                  {u.order}. {u.title}
                </span>
                <span className="ml-2 text-[10px] text-slate-400">{u.textbook}</span>
              </div>
              {u.isCustom && (
                <button
                  type="button"
                  onClick={() => onDeleteCustomUnit(u.id)}
                  className="ml-2 text-rose-500 hover:text-rose-700"
                  title="カスタム単元を削除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
