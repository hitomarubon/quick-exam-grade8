export interface StrokePoint {
  x: number;
  y: number;
  t: number;
}

export interface InkData {
  ink: Array<[number[], number[], number[]]>;
  width: number;
  height: number;
}

export interface CanvasPadOptions {
  strokeColor?: string;
  strokeWidth?: number;
  guideColor?: string;
  modelKanjiColor?: string;
  onChange?: (strokesCount: number) => void;
}

export class CanvasPad {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: Required<Omit<CanvasPadOptions, 'onChange'>> & {
    onChange?: (strokesCount: number) => void;
  };
  private strokes: StrokePoint[][] = [];
  private currentStroke: StrokePoint[] | null = null;
  private isDrawing = false;
  private modelKanji: string | null = null;
  private showModelKanji = false;
  private width = 320;
  private height = 320;

  private boundResize: () => void;
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;

  constructor(canvasElement: HTMLCanvasElement, options: CanvasPadOptions = {}) {
    this.canvas = canvasElement;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2D canvas context not available');
    }
    this.ctx = ctx;
    this.options = {
      strokeColor: options.strokeColor ?? '#1e293b',
      strokeWidth: options.strokeWidth ?? 6,
      guideColor: options.guideColor ?? '#cbd5e1',
      modelKanjiColor: options.modelKanjiColor ?? 'rgba(148, 163, 184, 0.35)',
      onChange: options.onChange,
    };

    this.boundResize = () => this.resize();
    this.boundPointerDown = (e) => this.onPointerDown(e);
    this.boundPointerMove = (e) => this.onPointerMove(e);
    this.boundPointerUp = (e) => this.onPointerUp(e);

    this.init();
  }

  private init(): void {
    this.resize();
    this.canvas.style.touchAction = 'none';
    this.canvas.addEventListener('pointerdown', this.boundPointerDown);
    this.canvas.addEventListener('pointermove', this.boundPointerMove);
    this.canvas.addEventListener('pointerup', this.boundPointerUp);
    this.canvas.addEventListener('pointercancel', this.boundPointerUp);
    this.canvas.addEventListener('pointerleave', this.boundPointerUp);
    window.addEventListener('resize', this.boundResize);
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width || 300;
    this.height = rect.height || 300;

    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.redraw();
  }

  private getPoint(e: PointerEvent): StrokePoint {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      t: Date.now(),
    };
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    this.isDrawing = true;
    const pt = this.getPoint(e);
    this.currentStroke = [pt];
    this.strokes.push(this.currentStroke);
    this.drawStrokeSegment(pt, pt);
    this.options.onChange?.(this.strokes.length);
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.isDrawing || !this.currentStroke) return;
    const pt = this.getPoint(e);
    const prev = this.currentStroke[this.currentStroke.length - 1];
    if (Math.hypot(pt.x - prev.x, pt.y - prev.y) < 2) return;
    this.currentStroke.push(pt);
    this.drawStrokeSegment(prev, pt);
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.currentStroke = null;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    this.redraw();
    this.options.onChange?.(this.strokes.length);
  }

  private drawStrokeSegment(p1: StrokePoint, p2: StrokePoint): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = this.options.strokeColor;
    ctx.lineWidth = this.options.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
  }

  redraw(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawGuide();

    if (this.showModelKanji && this.modelKanji) {
      this.drawModelKanji();
    }

    ctx.save();
    ctx.strokeStyle = this.options.strokeColor;
    ctx.lineWidth = this.options.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of this.strokes) {
      if (stroke.length === 0) continue;
      if (stroke.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke[0].x, stroke[0].y, this.options.strokeWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = this.options.strokeColor;
        ctx.fill();
        continue;
      }

      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length - 1; i++) {
        const xc = (stroke[i].x + stroke[i + 1].x) / 2;
        const yc = (stroke[i].y + stroke[i + 1].y) / 2;
        ctx.quadraticCurveTo(stroke[i].x, stroke[i].y, xc, yc);
      }
      const last = stroke[stroke.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawGuide(): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.save();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    ctx.strokeStyle = this.options.guideColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);

    ctx.beginPath();
    ctx.moveTo(w / 2, 8);
    ctx.lineTo(w / 2, h - 8);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(8, h / 2);
    ctx.lineTo(w - 8, h / 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawModelKanji(): void {
    if (!this.modelKanji) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const fontSize = Math.floor(Math.min(w, h) * 0.72);

    ctx.save();
    ctx.fillStyle = this.options.modelKanjiColor;
    ctx.font = `bold ${fontSize}px "Hiragino Mincho ProN", "Yu Mincho", "MS Mincho", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.modelKanji, w / 2, h / 2 + fontSize * 0.05);
    ctx.restore();
  }

  setModelKanji(kanji: string, show = false): void {
    this.modelKanji = kanji;
    this.showModelKanji = show;
    this.redraw();
  }

  toggleModelKanji(show?: boolean): boolean {
    this.showModelKanji = show !== undefined ? show : !this.showModelKanji;
    this.redraw();
    return this.showModelKanji;
  }

  undo(): boolean {
    if (this.strokes.length === 0) return false;
    this.strokes.pop();
    this.redraw();
    this.options.onChange?.(this.strokes.length);
    return true;
  }

  clear(): void {
    this.strokes = [];
    this.redraw();
    this.options.onChange?.(0);
  }

  getStrokesCount(): number {
    return this.strokes.length;
  }

  getInkData(): InkData {
    const ink: InkData['ink'] = [];
    for (const stroke of this.strokes) {
      const xs: number[] = [];
      const ys: number[] = [];
      const ts: number[] = [];
      for (const pt of stroke) {
        xs.push(Math.round(pt.x));
        ys.push(Math.round(pt.y));
        ts.push(pt.t);
      }
      ink.push([xs, ys, ts]);
    }
    return {
      ink,
      width: Math.round(this.width),
      height: Math.round(this.height),
    };
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
    this.canvas.removeEventListener('pointermove', this.boundPointerMove);
    this.canvas.removeEventListener('pointerup', this.boundPointerUp);
    this.canvas.removeEventListener('pointercancel', this.boundPointerUp);
    this.canvas.removeEventListener('pointerleave', this.boundPointerUp);
    window.removeEventListener('resize', this.boundResize);
  }
}
