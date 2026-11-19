import { InkData } from './canvasPad';

export interface HandwritingJudgeResult {
  isCorrect: boolean | null;
  isFallback?: boolean;
  rank: number;
  candidates: string[];
  recognizedAs?: string;
  confidence: number;
  message: string;
}

const HANDWRITING_API_URL =
  'https://www.google.com/inputtools/request?ime=handwriting&app=autocompletion&cs=1&oe=UTF-8';

export async function recognizeAndJudgeKanji(
  inkData: InkData,
  expectedKanji: string
): Promise<HandwritingJudgeResult> {
  if (!inkData || !inkData.ink || inkData.ink.length === 0) {
    return {
      isCorrect: false,
      rank: -1,
      candidates: [],
      confidence: 0,
      message: '文字が書かれていません。マス目に文字を書いてください。',
    };
  }

  try {
    const candidates = await fetchGoogleHandwriting(inkData);
    if (!candidates || candidates.length === 0) {
      return {
        isCorrect: false,
        rank: -1,
        candidates: [],
        confidence: 0,
        message: '文字を認識できませんでした。もう少しハッキリ書いてみてください。',
      };
    }

    const cleanExpected = expectedKanji.trim();
    const rank = candidates.findIndex((c) => c.trim() === cleanExpected);

    if (rank === 0) {
      return {
        isCorrect: true,
        rank: 1,
        candidates,
        confidence: 100,
        recognizedAs: candidates[0],
        message: `大正解！見事な「${cleanExpected}」です！`,
      };
    }

    if (rank > 0 && rank < 5) {
      return {
        isCorrect: true,
        rank: rank + 1,
        candidates,
        confidence: Math.max(60, 95 - rank * 8),
        recognizedAs: candidates[0],
        message: `正解！きれいに「${cleanExpected}」と認識されました。（第${rank + 1}候補）`,
      };
    }

    if (rank >= 5 && rank < 10) {
      return {
        isCorrect: true,
        rank: rank + 1,
        candidates,
        confidence: 50,
        recognizedAs: candidates[0],
        message: `正解判定です！（「${cleanExpected}」として認識されました。もう少し丁寧に書くとさらに良くなります）`,
      };
    }

    const topChar = candidates[0] || '不明';
    return {
      isCorrect: false,
      rank: -1,
      candidates: candidates.slice(0, 5),
      recognizedAs: topChar,
      confidence: 0,
      message: `惜しい！AIには「${topChar}」のように認識されました。お手本を確認してみましょう。`,
    };
  } catch {
    return {
      isCorrect: null,
      isFallback: true,
      rank: 0,
      candidates: [],
      recognizedAs: 'オフライン',
      confidence: 0,
      message: `オフラインまたは通信エラーのため自動認識できませんでした（${inkData.ink.length}画）。お手本と比べて判定してください。`,
    };
  }
}

async function fetchGoogleHandwriting(inkData: InkData): Promise<string[]> {
  const payload = {
    options: 'enable_pre_space',
    requests: [
      {
        writing_guide: {
          writing_area_width: inkData.width,
          writing_area_height: inkData.height,
        },
        ink: inkData.ink,
        language: 'ja',
      },
    ],
  };

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(HANDWRITING_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`API HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    if (
      Array.isArray(data) &&
      data[0] === 'SUCCESS' &&
      Array.isArray(data[1]) &&
      Array.isArray(data[1][0]) &&
      Array.isArray(data[1][0][1])
    ) {
      return data[1][0][1] as string[];
    }
    return [];
  } finally {
    window.clearTimeout(timeoutId);
  }
}
