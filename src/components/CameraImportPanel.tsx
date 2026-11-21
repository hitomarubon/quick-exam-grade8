import React, { useMemo, useRef, useState } from 'react';
import {
  BookPlus,
  Camera,
  Check,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  PenTool,
  Plus,
  Sparkles,
  Trash2,
  Zap,
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
  ExtractedVocabDraft,
  SelectedImageItem,
  extractKanjiFromImages,
  extractQuestionsFromImages,
  extractVocabFromImages,
  generateQuestionsFromTopic,
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

type ImportMode = 'questions' | 'kanji' | 'vocab';

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
  const [createNewUnitMode, setCreateNewUnitMode] = useState(false);
  const [newUnitTitle, setNewUnitTitle] = useState('');
  const [newUnitTextbook, setNewUnitTextbook] = useState('啓林館 教科書ワーク');
  const [topicHint, setTopicHint] = useState('');
  const [generateCount, setGenerateCount] = useState<5 | 10>(5);

  const [apiKey, setApiKey] = useState<string>(() => loadGeminiApiKey());
  const [showApiKeyBox, setShowApiKeyBox] = useState<boolean>(false);

  const [images, setImages] = useState<SelectedImageItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [questionDrafts, setQuestionDrafts] = useState<ExtractedQuestionDraft[]>([]);
  const [kanjiDrafts, setKanjiDrafts] = useState<ExtractedKanjiDraft[]>([]);
  const [vocabDrafts, setVocabDrafts] = useState<ExtractedVocabDraft[]>([]);

  // Manual kanji input states
  const [kanjiChar, setKanjiChar] = useState('');
  const [kanjiWord, setKanjiWord] = useState('');
  const [kanjiReading, setKanjiReading] = useState('');
  const [kanjiQuestion, setKanjiQuestion] = useState('');
  const [kanjiHint, setKanjiHint] = useState('');

  // Manual vocab input states
  const [vocabWordInput, setVocabWordInput] = useState('');
  const [vocabMeaningInput, setVocabMeaningInput] = useState('');
  const [vocabPosInput, setVocabPosInput] = useState('名詞');
  const [vocabBulkText, setVocabBulkText] = useState('');

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
    setNewUnitTextbook(subj === '理科' ? '啓林館 教科書ワーク' : '文理 教科書ワーク');
    const firstUnit = allUnits.find((u) => u.subject === subj);
    if (firstUnit) setSelectedUnitId(firstUnit.id);
  };

  const handleGenerateFromTopic = async () => {
    const targetUnit = allUnits.find((u) => u.id === selectedUnitId);
    const effectiveTitle = createNewUnitMode
      ? newUnitTitle.trim()
      : targetUnit?.title || selectedSubject;
    const effectiveTextbook = createNewUnitMode
      ? newUnitTextbook.trim()
      : targetUnit?.textbook || '教科書ワーク';

    if (!effectiveTitle) {
      setErrorMessage('単元タイトルを入力または選択してください。');
      return;
    }
    if (!apiKey.trim()) {
      setShowApiKeyBox(true);
      setErrorMessage('AI自動作成には Gemini APIキーが必要です（手動追加はキー不要で使えます）。');
      return;
    }

    saveGeminiApiKey(apiKey);
    setIsAnalyzing(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const result = await generateQuestionsFromTopic(
        apiKey,
        selectedSubject,
        effectiveTitle,
        effectiveTextbook,
        generateCount,
        topicHint
      );
      setQuestionDrafts((prev) => [...prev, ...result]);
      setStatusMessage(
        `「${effectiveTitle}」の4択問題を ${result.length} 問作成しました。確認して登録してください。`
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '問題作成に失敗しました。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddEmptyQuestionRow = () => {
    setQuestionDrafts((prev) => [
      ...prev,
      {
        checked: true,
        question: '',
        options: ['選択肢A', '選択肢B', '選択肢C', '選択肢D'],
        answerIndex: 0,
        explanation: '',
      },
    ]);
    setErrorMessage('');
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

  const handleAnalyzeImages = async () => {
    if (images.length === 0) {
      setErrorMessage('先にページを撮影するか、写真を選んでください。');
      return;
    }
    if (!apiKey.trim()) {
      setShowApiKeyBox(true);
      setErrorMessage('写真読み取りには Gemini APIキーを入力してください。');
      return;
    }

    saveGeminiApiKey(apiKey);
    setIsAnalyzing(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      if (importMode === 'questions') {
        const targetUnit = allUnits.find((u) => u.id === selectedUnitId);
        const unitTitle = createNewUnitMode
          ? newUnitTitle.trim() || selectedSubject
          : targetUnit?.title || selectedSubject;
        const result = await extractQuestionsFromImages(
          apiKey,
          images,
          selectedSubject,
          unitTitle
        );
        setQuestionDrafts((prev) => [...prev, ...result]);
        setStatusMessage(`写真から ${result.length} 問の4択問題を生成しました。`);
      } else if (importMode === 'kanji') {
        const result = await extractKanjiFromImages(apiKey, images);
        setKanjiDrafts((prev) => [...prev, ...result]);
        setStatusMessage(`写真から ${result.length} 字の漢字を読み取りました。`);
      } else {
        const result = await extractVocabFromImages(apiKey, images);
        setVocabDrafts((prev) => [...prev, ...result]);
        setStatusMessage(`写真から ${result.length} 語の英単語を読み取りました。`);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'AI解析に失敗しました。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddManualKanjiDraft = () => {
    const ch = kanjiChar.trim().charAt(0);
    if (!ch) {
      setErrorMessage('漢字1文字を入力してください。');
      return;
    }
    const word = kanjiWord.trim() || ch;
    const reading = kanjiReading.trim() || 'よみ';
    const q = kanjiQuestion.trim() || `${word}の［${reading}］を書く。`;

    setKanjiDrafts((prev) => [
      ...prev,
      {
        checked: true,
        kanji: ch,
        question: q.includes('［') ? q : `${q}（［${reading}］）`,
        targetWord: word,
        targetCharReading: reading,
        targetReading: reading,
        on: reading,
        kun: '—',
        strokes: 10,
        radical: '—',
        hint: kanjiHint.trim() || `${word}で使われる漢字です。`,
        examples: [word],
      },
    ]);
    setKanjiChar('');
    setKanjiWord('');
    setKanjiReading('');
    setKanjiQuestion('');
    setKanjiHint('');
    setErrorMessage('');
  };

  const handleAddManualVocabDraft = () => {
    const w = vocabWordInput.trim();
    const m = vocabMeaningInput.trim();
    if (!w || !m) {
      setErrorMessage('英単語と意味を入力してください。');
      return;
    }
    setVocabDrafts((prev) => [
      ...prev,
      {
        checked: true,
        word: w,
        meaning: m,
        partOfSpeech: vocabPosInput.trim() || '単語',
      },
    ]);
    setVocabWordInput('');
    setVocabMeaningInput('');
    setErrorMessage('');
  };

  const handleParseBulkVocab = () => {
    const lines = vocabBulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const parsed: ExtractedVocabDraft[] = [];
    for (const line of lines) {
      const parts = line.split(/[,\t，、]+/).map((p) => p.trim());
      if (parts.length >= 2 && parts[0] && parts[1]) {
        parsed.push({
          checked: true,
          word: parts[0],
          meaning: parts[1],
          partOfSpeech: parts[2] || '単語',
        });
      }
    }
    if (parsed.length === 0) {
      setErrorMessage('「単語, 意味」の形式で1行ずつ入力してください。');
      return;
    }
    setVocabDrafts((prev) => [...prev, ...parsed]);
    setVocabBulkText('');
    setErrorMessage('');
    setStatusMessage(`${parsed.length} 語を下書きリストに追加しました。`);
  };

  const handleSaveDrafts = async () => {
    setErrorMessage('');
    const nowIso = new Date().toISOString();

    try {
      if (importMode === 'questions') {
        const checked = questionDrafts.filter((d) => d.checked && d.question.trim());
        if (checked.length === 0) return;

        let targetUnitId = selectedUnitId;
        let targetUnitTitle =
          allUnits.find((u) => u.id === selectedUnitId)?.title || selectedSubject;

        if (createNewUnitMode) {
          const cleanNewTitle = newUnitTitle.trim();
          if (!cleanNewTitle) {
            setErrorMessage('新しい単元名を入力してください。');
            return;
          }
          const sameSubject = allUnits.filter((u) => u.subject === selectedSubject);
          const nextOrder =
            sameSubject.length > 0 ? Math.max(...sameSubject.map((u) => u.order)) + 1 : 1;
          const createdUnit: Unit = {
            id: `custom_unit_${Date.now()}`,
            subject: selectedSubject,
            textbook: (newUnitTextbook.trim() || '教科書ワーク').slice(0, 80),
            order: Math.min(500, Math.max(1, Math.round(nextOrder))),
            title: cleanNewTitle.slice(0, 160),
            isCustom: true,
            createdAt: nowIso,
          };
          await onAddUnits([createdUnit]);
          targetUnitId = createdUnit.id;
          targetUnitTitle = createdUnit.title;
          setSelectedUnitId(createdUnit.id);
          setCreateNewUnitMode(false);
          setNewUnitTitle('');
        }

        const toAdd: Question[] = checked.map((d, idx) => ({
          id: `custom_q_${Date.now()}_${idx}`,
          subject: selectedSubject,
          category: targetUnitTitle.slice(0, 200),
          unitId: targetUnitId,
          question: d.question.trim().slice(0, 1000),
          options: d.options.map((o) => o.slice(0, 500)) as [string, string, string, string],
          answerIndex: Math.min(3, Math.max(0, Math.round(d.answerIndex))),
          explanation: (d.explanation.trim() || '教科書・ワークの基本事項を確認しましょう。').slice(
            0,
            1000
          ),
          isCustom: true,
        }));
        await onAddQuestions(toAdd);
        setQuestionDrafts([]);
        setImages([]);
        setStatusMessage(`${toAdd.length} 問の問題を「${targetUnitTitle}」へ登録しました！`);
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
        setStatusMessage(`${toAdd.length} 字の漢字を手書きドリルへ登録しました！`);
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
        setStatusMessage(`${toAdd.length} 語の英単語を登録しました！`);
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
        order: Math.min(500, Math.max(1, Math.round(nextOrder))),
        title: title.slice(0, 160),
        isCustom: true,
        createdAt: new Date().toISOString(),
      },
    ]);
    setManualUnitTitle('');
    setStatusMessage(`単元「${title}」を追加しました。`);
  };

  const hasDrafts =
    (importMode === 'questions' && questionDrafts.length > 0) ||
    (importMode === 'kanji' && kanjiDrafts.length > 0) ||
    (importMode === 'vocab' && vocabDrafts.length > 0);

  return (
    <div className="space-y-4">
      {/* Mode Selector */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <p className="text-xs font-extrabold text-slate-700">追加するデータを選ぶ</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setImportMode('questions');
              setErrorMessage('');
            }}
            className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-center text-[11px] font-bold transition ${
              importMode === 'questions'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            <BookPlus className="h-4 w-4" />
            <span>単元問題</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setImportMode('kanji');
              setErrorMessage('');
            }}
            className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-center text-[11px] font-bold transition ${
              importMode === 'kanji'
                ? 'border-blue-600 bg-blue-50 text-blue-800'
                : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            <PenTool className="h-4 w-4" />
            <span>漢字を手動追加</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setImportMode('vocab');
              setErrorMessage('');
            }}
            className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-center text-[11px] font-bold transition ${
              importMode === 'vocab'
                ? 'border-violet-600 bg-violet-50 text-violet-800'
                : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            <Zap className="h-4 w-4" />
            <span>単語を手動追加</span>
          </button>
        </div>

        {/* MODE 1: TOPIC-BASED QUESTION GENERATION + MANUAL */}
        {importMode === 'questions' && (
          <div className="space-y-3 pt-1">
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-600">対象単元</label>
                <button
                  type="button"
                  onClick={() => setCreateNewUnitMode((prev) => !prev)}
                  className="text-[11px] font-bold text-indigo-600 hover:underline"
                >
                  {createNewUnitMode ? '登録済み単元から選ぶ' : '＋ 新しい単元を作って登録'}
                </button>
              </div>

              {createNewUnitMode ? (
                <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/40 p-2.5">
                  <input
                    type="text"
                    value={newUnitTitle}
                    onChange={(e) => setNewUnitTitle(e.target.value)}
                    placeholder="例: Unit 5 比較表現と最上級"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
                  />
                  <input
                    type="text"
                    value={newUnitTextbook}
                    onChange={(e) => setNewUnitTextbook(e.target.value)}
                    placeholder="教材名（例: 文理 教科書ワーク）"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px]"
                  />
                </div>
              ) : (
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
              )}
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-indigo-900">
                  ✨ 単元情報からWeb/AIで問題作成（写真不要）
                </span>
                <button
                  type="button"
                  onClick={() => setShowApiKeyBox((prev) => !prev)}
                  className="text-[10px] font-bold text-indigo-700 underline"
                >
                  {apiKey.trim() ? 'APIキー設定済み' : 'APIキー設定'}
                </button>
              </div>

              {showApiKeyBox && (
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Gemini APIキー (AIza...)"
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      saveGeminiApiKey(apiKey);
                      setShowApiKeyBox(false);
                      setStatusMessage('Gemini APIキーを保存しました。');
                    }}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white"
                  >
                    保存
                  </button>
                </div>
              )}

              <input
                type="text"
                value={topicHint}
                onChange={(e) => setTopicHint(e.target.value)}
                placeholder="補足キーワード（任意：例 オームの法則、電力、並列回路）"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />

              <div className="flex items-center gap-2">
                <div className="flex rounded-xl border border-slate-300 bg-white p-0.5 text-xs font-bold">
                  {([5, 10] as const).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setGenerateCount(cnt)}
                      className={`rounded-lg px-2.5 py-1.5 ${
                        generateCount === cnt ? 'bg-indigo-600 text-white' : 'text-slate-600'
                      }`}
                    >
                      {cnt}問
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={isAnalyzing}
                  onClick={handleGenerateFromTopic}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-xs font-extrabold text-white shadow-sm disabled:opacity-60"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      作成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      単元名から自動作成
                    </>
                  )}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddEmptyQuestionRow}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 py-2.5 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
            >
              <Plus className="h-4 w-4" />
              手動で4択問題を1問追加する（APIキー不要）
            </button>
          </div>
        )}

        {/* MODE 2: MANUAL KANJI */}
        {importMode === 'kanji' && (
          <div className="space-y-2.5 pt-1">
            <p className="text-[11px] text-slate-500">
              テスト範囲の漢字を手動で入力して「手書き漢字ドリル」に追加します。
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  漢字(1字)
                </label>
                <input
                  type="text"
                  maxLength={1}
                  value={kanjiChar}
                  onChange={(e) => setKanjiChar(e.target.value)}
                  placeholder="例: 換"
                  className="w-full rounded-xl border border-blue-300 bg-blue-50/40 px-2 py-2 text-center text-base font-black"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  熟語
                </label>
                <input
                  type="text"
                  value={kanjiWord}
                  onChange={(e) => setKanjiWord(e.target.value)}
                  placeholder="例: 転換"
                  className="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-rose-600 mb-0.5">
                  書く読み(カタカナ)
                </label>
                <input
                  type="text"
                  value={kanjiReading}
                  onChange={(e) => setKanjiReading(e.target.value)}
                  placeholder="例: カン"
                  className="w-full rounded-xl border border-rose-200 bg-rose-50/40 px-2.5 py-2 text-xs font-bold"
                />
              </div>
            </div>
            <input
              type="text"
              value={kanjiQuestion}
              onChange={(e) => setKanjiQuestion(e.target.value)}
              placeholder="問題文（例: 方向を転［カン］する。空欄なら自動作成）"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={kanjiHint}
              onChange={(e) => setKanjiHint(e.target.value)}
              placeholder="覚え方ヒント（任意）"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
            <button
              type="button"
              onClick={handleAddManualKanjiDraft}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-extrabold text-white shadow-sm"
            >
              <Plus className="h-4 w-4" />
              下書きリストに追加する
            </button>
          </div>
        )}

        {/* MODE 3: MANUAL VOCAB */}
        {importMode === 'vocab' && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-5 gap-2">
              <input
                type="text"
                value={vocabWordInput}
                onChange={(e) => setVocabWordInput(e.target.value)}
                placeholder="単語 (例: environment)"
                className="col-span-2 rounded-xl border border-slate-300 px-2.5 py-2 text-xs font-bold"
              />
              <input
                type="text"
                value={vocabMeaningInput}
                onChange={(e) => setVocabMeaningInput(e.target.value)}
                placeholder="意味 (例: 環境)"
                className="col-span-2 rounded-xl border border-slate-300 px-2.5 py-2 text-xs"
              />
              <input
                type="text"
                value={vocabPosInput}
                onChange={(e) => setVocabPosInput(e.target.value)}
                placeholder="品詞"
                className="col-span-1 rounded-xl border border-slate-300 px-2 py-2 text-xs"
              />
            </div>
            <button
              type="button"
              onClick={handleAddManualVocabDraft}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet-600 py-2.5 text-xs font-extrabold text-white shadow-sm"
            >
              <Plus className="h-4 w-4" />
              1語追加する
            </button>

            <div className="border-t border-slate-100 pt-2.5 space-y-2">
              <p className="text-[11px] font-bold text-slate-600">
                まとめて貼り付け（1行に「単語, 意味, 品詞」）
              </p>
              <textarea
                rows={3}
                value={vocabBulkText}
                onChange={(e) => setVocabBulkText(e.target.value)}
                placeholder={'experience, 経験, 名詞\nimprove, 改善する, 動詞'}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs"
              />
              <button
                type="button"
                onClick={handleParseBulkVocab}
                className="w-full rounded-xl border border-violet-300 bg-violet-50 py-2 text-xs font-extrabold text-violet-800"
              >
                まとめて下書きへ読み込む
              </button>
            </div>
          </div>
        )}

        {/* Optional Photo OCR (Collapsed by default) */}
        <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
          <summary className="cursor-pointer text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5" />
            写真から読み取りたい場合（任意・必要なときのみ）
          </summary>
          <div className="mt-2.5 space-y-2">
            {!apiKey.trim() && (
              <div className="flex gap-2">
                <KeyRound className="h-4 w-4 text-slate-500 mt-1.5 shrink-0" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Gemini APIキー (AIza...)"
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => saveGeminiApiKey(apiKey)}
                  className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold text-white"
                >
                  保存
                </button>
              </div>
            )}

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
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-1 rounded-lg bg-purple-600 py-2 text-[11px] font-bold text-white"
              >
                <Camera className="h-3.5 w-3.5" />
                カメラで撮影
              </button>
              <button
                type="button"
                onClick={() => albumInputRef.current?.click()}
                className="flex items-center justify-center gap-1 rounded-lg border border-purple-300 bg-white py-2 text-[11px] font-bold text-purple-800"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                写真を選ぶ
              </button>
            </div>

            {images.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {images.map((img, idx) => (
                    <div
                      key={img.id}
                      className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200"
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
                        className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-bold text-white"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={isAnalyzing}
                  onClick={handleAnalyzeImages}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-600 py-2 text-xs font-extrabold text-white disabled:opacity-60"
                >
                  {isAnalyzing ? '解析中...' : `写真（${images.length}枚）を読み取る`}
                </button>
              </div>
            )}
          </div>
        </details>
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
        <div className="rounded-2xl border-2 border-indigo-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-extrabold text-slate-900">登録前の確認・編集</h4>
            <button
              type="button"
              onClick={handleSaveDrafts}
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-sm"
            >
              <Check className="h-4 w-4" />
              チェック項目を登録
            </button>
          </div>

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
                      className="mt-1 h-4 w-4 accent-indigo-600"
                    />
                    <textarea
                      rows={2}
                      value={draft.question}
                      placeholder="問題文を入力..."
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
                <div key={idx} className="rounded-xl border border-slate-200 p-2.5 space-y-1.5">
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
