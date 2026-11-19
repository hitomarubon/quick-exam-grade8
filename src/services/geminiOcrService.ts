import { Subject } from '../types/quiz';

const STORAGE_GEMINI_API_KEY = 'quickexam_gemini_api_key_v1';

export interface SelectedImageItem {
  id: string;
  dataUrl: string;
  base64: string;
  mimeType: string;
}

export interface ExtractedUnitDraft {
  checked: boolean;
  title: string;
  order: number;
}

export interface ExtractedQuestionDraft {
  checked: boolean;
  question: string;
  options: [string, string, string, string];
  answerIndex: number;
  explanation: string;
}

export interface ExtractedKanjiDraft {
  checked: boolean;
  kanji: string;
  question: string;
  targetWord: string;
  targetCharReading: string;
  targetReading: string;
  on: string;
  kun: string;
  strokes: number;
  radical: string;
  hint: string;
  examples: string[];
}

export interface ExtractedVocabDraft {
  checked: boolean;
  word: string;
  meaning: string;
  partOfSpeech: string;
}

export function loadGeminiApiKey(): string {
  try {
    return (window.localStorage.getItem(STORAGE_GEMINI_API_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function saveGeminiApiKey(key: string): void {
  try {
    const trimmed = key.trim();
    if (!trimmed) {
      window.localStorage.removeItem(STORAGE_GEMINI_API_KEY);
    } else {
      window.localStorage.setItem(STORAGE_GEMINI_API_KEY, trimmed);
    }
  } catch {
    // ignore
  }
}

export function resizeImageFile(file: File, maxDim = 1600): Promise<SelectedImageItem> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({
          id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          dataUrl,
          base64: dataUrl.split(',')[1] || '',
          mimeType: 'image/jpeg',
        });
      };
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました。'));
      img.src = String(e.target?.result || '');
    };
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました。'));
    reader.readAsDataURL(file);
  });
}

async function fetchGeminiWithFallback<T>(
  apiKey: string,
  prompt: string,
  images: SelectedImageItem[]
): Promise<T[]> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    throw new Error('Gemini APIキーが未設定です。設定画面または上部のAPIキー欄に入力してください。');
  }

  const parts: Array<
    { text: string } | { inline_data: { mime_type: string; data: string } }
  > = [{ text: prompt }];

  for (const img of images) {
    parts.push({
      inline_data: {
        mime_type: img.mimeType || 'image/jpeg',
        data: img.base64,
      },
    });
  }

  const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  let lastError: Error | null = null;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      cleanKey
    )}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Model ${model} HTTP ${response.status}: ${errBody.slice(0, 200)}`);
      }

      const result = await response.json();
      const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!rawText) {
        throw new Error('AIからの応答が空でした。');
      }

      const cleaned = rawText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed as T[];
      if (parsed && Array.isArray(parsed.items)) return parsed.items as T[];
      if (parsed && Array.isArray(parsed.units)) return parsed.units as T[];
      if (parsed && Array.isArray(parsed.questions)) return parsed.questions as T[];
      if (parsed && Array.isArray(parsed.words)) return parsed.words as T[];
      return [parsed as T];
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error('Gemini APIの呼び出しに失敗しました。');
}

export async function extractUnitsFromImages(
  apiKey: string,
  images: SelectedImageItem[],
  subject: Subject,
  textbook: string,
  startOrder: number
): Promise<ExtractedUnitDraft[]> {
  const prompt = `あなたは中学2年生の学習教材（${textbook}・教科:${subject}）の目次整理エキスパートです。
添付された教科書・ワークの目次ページの画像から、単元（チャプター・レッスン・単元タイトル）を上から順番に読み取り、JSON配列で出力してください。

【ルール】
1. ページ番号や単元番号だけでなく、学習内容が分かる単元タイトルにしてください。
2. order は ${startOrder} から始まる連番にしてください。
3. 出力は必ず純粋なJSON配列のみとしてください。

【出力スキーマ】
[
  {
    "order": ${startOrder},
    "title": "第1章 式の計算・単項式と多項式"
  }
]`;

  const raw = await fetchGeminiWithFallback<{ order?: number; title?: string }>(
    apiKey,
    prompt,
    images
  );
  return raw
    .filter((r) => r && r.title)
    .map((r, idx) => ({
      checked: true,
      order: Number(r.order) || startOrder + idx,
      title: String(r.title).trim(),
    }));
}

export async function extractQuestionsFromImages(
  apiKey: string,
  images: SelectedImageItem[],
  subject: Subject,
  unitTitle: string
): Promise<ExtractedQuestionDraft[]> {
  const prompt = `あなたは中学2年生の定期テスト対策問題を作成する専門教師AIです（教科: ${subject} / 単元: ${unitTitle}）。
添付された教科書・ワーク・プリントの画像内容を正確に読み取り、スマホで短時間の予習・復習ができる「4択問題」を作成してJSON配列で出力してください。

【ルール】
1. 画像に問題や重要語句が写っている場合は、その内容・問われ方を忠実に4択問題化してください（最大10問程度まで漏れなく）。
2. 画像が説明ページ・まとめページの場合は、そのページに書かれた重要事項から予習・復習用の4択問題を作成してください。
3. options は必ずちょうど4つの選択肢配列にしてください。
4. answerIndex は正解のインデックス（0, 1, 2, 3 の整数）にしてください。
5. explanation は中学生が読んで1〜2文でスッキリ理解できる分かりやすい解説にしてください。
6. 出力は純粋なJSON配列のみとしてください。

【出力スキーマ】
[
  {
    "question": "問題文",
    "options": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
    "answerIndex": 0,
    "explanation": "わかりやすい解説"
  }
]`;

  const raw = await fetchGeminiWithFallback<{
    question?: string;
    options?: string[];
    answerIndex?: number;
    explanation?: string;
  }>(apiKey, prompt, images);

  return raw
    .filter((r) => r && r.question && Array.isArray(r.options) && r.options.length >= 2)
    .map((r) => {
      const opts = [...(r.options || [])].slice(0, 4).map((o) => String(o));
      while (opts.length < 4) {
        opts.push(`選択肢${opts.length + 1}`);
      }
      const rawIdx = Number(r.answerIndex);
      const safeIdx = Number.isInteger(rawIdx) && rawIdx >= 0 && rawIdx < 4 ? rawIdx : 0;
      return {
        checked: true,
        question: String(r.question).trim(),
        options: opts as [string, string, string, string],
        answerIndex: safeIdx,
        explanation: String(r.explanation || '教科書・ワークの基本事項を確認しましょう。').trim(),
      };
    });
}

export async function extractKanjiFromImages(
  apiKey: string,
  images: SelectedImageItem[]
): Promise<ExtractedKanjiDraft[]> {
  const prompt = `あなたは中学校の国語・漢字テスト作成の専門AIです。
添付された教材・プリント・ノート・教科書の画像に写っている漢字（または漢字問題）をすべて漏れなく読み取り、以下のJSON配列形式で出力してください。

【重要なルール】
1. 画像内に問題文や熟語がある場合はそれを最優先で採用してください。
2. 回答対象となる漢字1文字の読み（カタカナ）を問題文中で全角ブラケット「［カタカナ］」で囲んでください。
   - 例: 正解の漢字が「換」、熟語が「転換（テンカン）」の場合、question は「車掌が方向を転［カン］する。」のように、書くべき1文字分だけを［カン］にしてください。
3. 画数(strokes)、部首(radical)、音読み(on)、訓読み(kun)、覚え方のヒント(hint)、代表的な熟語3つ(examples)を自動的に補完してください。
4. 出力は必ず純粋なJSON配列のみとしてください。

【出力スキーマ】
[
  {
    "kanji": "換",
    "question": "車掌が方向を転［カン］する。",
    "targetWord": "転換",
    "targetCharReading": "カン",
    "targetReading": "テンカン",
    "on": "カン",
    "kun": "か-える、か-わる",
    "strokes": 12,
    "radical": "扌（てへん）",
    "hint": "取り替えること。てへんに「奐」。",
    "examples": ["転換", "交換", "換気"]
  }
]`;

  const raw = await fetchGeminiWithFallback<Partial<ExtractedKanjiDraft>>(
    apiKey,
    prompt,
    images
  );

  return raw
    .filter((r) => r && r.kanji)
    .map((r) => {
      const kanjiChar = String(r.kanji).trim().charAt(0);
      const charReading = String(r.targetCharReading || r.on || '読み').trim();
      const targetWord = String(r.targetWord || kanjiChar).trim();
      const questionText =
        r.question && String(r.question).includes('［')
          ? String(r.question).trim()
          : `${targetWord}の［${charReading}］を書く。`;
      return {
        checked: true,
        kanji: kanjiChar,
        question: questionText,
        targetWord,
        targetCharReading: charReading,
        targetReading: String(r.targetReading || charReading).trim(),
        on: String(r.on || '—').trim(),
        kun: String(r.kun || '—').trim(),
        strokes: Number(r.strokes) || 10,
        radical: String(r.radical || '—').trim(),
        hint: String(r.hint || `${targetWord}で使われる漢字です。`).trim(),
        examples: Array.isArray(r.examples) && r.examples.length > 0 ? r.examples.map(String) : [targetWord],
      };
    });
}

export async function extractVocabFromImages(
  apiKey: string,
  images: SelectedImageItem[]
): Promise<ExtractedVocabDraft[]> {
  const prompt = `あなたは中学校英語の専門教師AIです。
添付された教科書・単語帳・プリントの画像に写っている英単語・熟語と日本語の意味を読み取り、JSON配列形式で出力してください。

【ルール】
1. 見出し語（word）、わかりやすい日本語の意味（meaning）、品詞（partOfSpeech: 名詞/動詞/形容詞/副詞/前置詞/熟語 など）を抽出してください。
2. 出力は必ず純粋なJSON配列のみとしてください。

【出力スキーマ】
[
  {
    "word": "environment",
    "meaning": "環境",
    "partOfSpeech": "名詞"
  }
]`;

  const raw = await fetchGeminiWithFallback<Partial<ExtractedVocabDraft>>(
    apiKey,
    prompt,
    images
  );

  return raw
    .filter((r) => r && r.word && r.meaning)
    .map((r) => ({
      checked: true,
      word: String(r.word).trim(),
      meaning: String(r.meaning).trim(),
      partOfSpeech: String(r.partOfSpeech || '単語').trim(),
    }));
}
