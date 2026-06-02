export interface RateDecision {
  allowed: boolean;
  retryAfterMs: number;
}

export class LoginRateLimiter {
  private hits = new Map<string, number[]>();
  private global: number[] = [];

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
    private readonly globalMax = Infinity,
    private readonly globalWindowMs = windowMs,
  ) {}

  private prune(key: string, now: number): number[] {
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    this.hits.set(key, recent);
    return recent;
  }

  private pruneGlobal(now: number): number[] {
    const cutoff = now - this.globalWindowMs;
    this.global = this.global.filter((t) => t > cutoff);
    return this.global;
  }

  check(key: string, now: number): RateDecision {
    const recent = this.prune(key, now);
    const global = this.pruneGlobal(now);
    if (this.globalMax !== Infinity && global.length >= this.globalMax) {
      return { allowed: false, retryAfterMs: global[0] + this.globalWindowMs - now };
    }
    if (recent.length < this.maxAttempts) return { allowed: true, retryAfterMs: 0 };
    return { allowed: false, retryAfterMs: recent[0] + this.windowMs - now };
  }

  recordFailure(key: string, now: number): void {
    const recent = this.prune(key, now);
    recent.push(now);
    this.hits.set(key, recent);
    this.pruneGlobal(now);
    this.global.push(now);
  }

  reset(key: string): void {
    this.hits.delete(key);
  }
}
