export interface RateDecision {
  allowed: boolean;
  retryAfterMs: number;
}

export class LoginRateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private readonly maxAttempts: number, private readonly windowMs: number) {}

  private prune(key: string, now: number): number[] {
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    this.hits.set(key, recent);
    return recent;
  }

  check(key: string, now: number): RateDecision {
    const recent = this.prune(key, now);
    if (recent.length < this.maxAttempts) return { allowed: true, retryAfterMs: 0 };
    const oldest = recent[0];
    return { allowed: false, retryAfterMs: oldest + this.windowMs - now };
  }

  recordFailure(key: string, now: number): void {
    const recent = this.prune(key, now);
    recent.push(now);
    this.hits.set(key, recent);
  }

  reset(key: string): void {
    this.hits.delete(key);
  }
}
