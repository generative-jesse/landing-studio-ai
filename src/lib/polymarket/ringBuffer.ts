import { ChartPointLive } from './types';

/**
 * Bounded, in-memory ring buffer for chart points.
 * Never persisted — dropped on unmount / market switch.
 */
export class ChartRingBuffer {
  private buf: ChartPointLive[];
  private start = 0;
  private count = 0;
  private lastT = -Infinity;

  constructor(public readonly capacity: number = 1800) {
    if (capacity <= 0) throw new Error('capacity must be > 0');
    this.buf = new Array(capacity);
  }

  get size(): number {
    return this.count;
  }

  /** Push a point. Out-of-order / duplicate timestamps are ignored. Returns true if stored. */
  push(point: ChartPointLive): boolean {
    if (!Number.isFinite(point.t) || !Number.isFinite(point.p)) return false;
    if (point.t <= this.lastT) return false;
    this.lastT = point.t;

    const idx = (this.start + this.count) % this.capacity;
    this.buf[idx] = point;
    if (this.count < this.capacity) {
      this.count++;
    } else {
      this.start = (this.start + 1) % this.capacity;
    }
    return true;
  }

  /** Seed with historical points (ascending). Existing newer points are preserved. */
  seed(points: ChartPointLive[]): void {
    const merged = [...points, ...this.toArray()]
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.p))
      .sort((a, b) => a.t - b.t);
    this.clear();
    for (const p of merged) this.push(p);
  }

  last(): ChartPointLive | null {
    if (this.count === 0) return null;
    return this.buf[(this.start + this.count - 1) % this.capacity];
  }

  toArray(): ChartPointLive[] {
    const out: ChartPointLive[] = new Array(this.count);
    for (let i = 0; i < this.count; i++) out[i] = this.buf[(this.start + i) % this.capacity];
    return out;
  }

  clear(): void {
    this.buf = new Array(this.capacity);
    this.start = 0;
    this.count = 0;
    this.lastT = -Infinity;
  }
}

/** Largest-Triangle-Three-Buckets downsampling for display only. */
export function downsample(points: ChartPointLive[], threshold: number): ChartPointLive[] {
  if (threshold <= 2 || points.length <= threshold) return points;

  const sampled: ChartPointLive[] = [points[0]];
  const every = (points.length - 2) / (threshold - 2);
  let a = 0;

  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor((i + 1) * every) + 1;
    const rangeEnd = Math.min(Math.floor((i + 2) * every) + 1, points.length - 1);
    const rangeLen = Math.max(rangeEnd - rangeStart, 1);

    let avgT = 0;
    let avgP = 0;
    for (let j = rangeStart; j < rangeEnd; j++) {
      avgT += points[j].t;
      avgP += points[j].p;
    }
    avgT /= rangeLen;
    avgP /= rangeLen;

    const prevStart = Math.floor(i * every) + 1;
    const prevEnd = Math.min(Math.floor((i + 1) * every) + 1, points.length - 1);
    let maxArea = -1;
    let best = prevStart;
    for (let j = prevStart; j < prevEnd; j++) {
      const area = Math.abs(
        (points[a].t - avgT) * (points[j].p - points[a].p) -
          (points[a].t - points[j].t) * (avgP - points[a].p),
      );
      if (area > maxArea) {
        maxArea = area;
        best = j;
      }
    }
    sampled.push(points[best]);
    a = best;
  }

  sampled.push(points[points.length - 1]);
  return sampled;
}
