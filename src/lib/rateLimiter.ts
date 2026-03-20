/**
 * Client-side rate limiting for public forms.
 *
 * Uses localStorage to track submission counts and timestamps.
 * This is a first-defense layer; server-side Supabase Edge Functions
 * should implement their own rate limiting for production hardening.
 *
 * Usage:
 *   const limiter = createFormRateLimiter("leader-registration");
 *   if (!limiter.isAllowed()) {
 *     toast.error(`Muitas tentativas. Tente novamente em ${limiter.retryAfterSeconds()}s.`);
 *     return;
 *   }
 *   limiter.record(); // record the attempt
 */

interface RateLimitEntry {
  attempts: number[];  // array of Unix timestamps (ms)
}

interface RateLimitOptions {
  /** Max number of submissions in the window */
  maxAttempts?: number;
  /** Window size in milliseconds */
  windowMs?: number;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function getKey(formId: string): string {
  return `rl_${formId}`;
}

function getEntry(formId: string): RateLimitEntry {
  try {
    const raw = localStorage.getItem(getKey(formId));
    if (!raw) return { attempts: [] };
    return JSON.parse(raw) as RateLimitEntry;
  } catch {
    return { attempts: [] };
  }
}

function saveEntry(formId: string, entry: RateLimitEntry): void {
  try {
    localStorage.setItem(getKey(formId), JSON.stringify(entry));
  } catch {
    // Ignore storage errors
  }
}

function purgeOldAttempts(entry: RateLimitEntry, windowMs: number): RateLimitEntry {
  const cutoff = Date.now() - windowMs;
  return { attempts: entry.attempts.filter((t) => t > cutoff) };
}

export interface FormRateLimiter {
  /** Returns true if the user is allowed to submit */
  isAllowed: () => boolean;
  /** Records a new attempt */
  record: () => void;
  /** Seconds until the oldest attempt expires (0 if allowed) */
  retryAfterSeconds: () => number;
  /** Remaining attempts in the current window */
  remainingAttempts: () => number;
  /** Reset the rate limit (e.g. after server confirms success) */
  reset: () => void;
}

/**
 * Creates a rate limiter for a specific public form.
 *
 * @param formId   Unique identifier for the form (e.g. "leader-registration")
 * @param options  Optional configuration overrides
 */
export function createFormRateLimiter(
  formId: string,
  options: RateLimitOptions = {}
): FormRateLimiter {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;

  const isAllowed = (): boolean => {
    const entry = purgeOldAttempts(getEntry(formId), windowMs);
    return entry.attempts.length < maxAttempts;
  };

  const record = (): void => {
    let entry = purgeOldAttempts(getEntry(formId), windowMs);
    entry = { attempts: [...entry.attempts, Date.now()] };
    saveEntry(formId, entry);
  };

  const retryAfterSeconds = (): number => {
    if (isAllowed()) return 0;
    const entry = purgeOldAttempts(getEntry(formId), windowMs);
    const oldest = Math.min(...entry.attempts);
    const expiry = oldest + windowMs;
    return Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
  };

  const remainingAttempts = (): number => {
    const entry = purgeOldAttempts(getEntry(formId), windowMs);
    return Math.max(0, maxAttempts - entry.attempts.length);
  };

  const reset = (): void => {
    try {
      localStorage.removeItem(getKey(formId));
    } catch {
      // Ignore
    }
  };

  return { isAllowed, record, retryAfterSeconds, remainingAttempts, reset };
}

// ── Pre-configured limiters for known public forms ────────────

/** Leader registration form: 3 submissions per 10 minutes */
export const leaderRegistrationLimiter = createFormRateLimiter("leader-registration", {
  maxAttempts: 3,
  windowMs: 10 * 60 * 1000,
});

/** Lead capture landing form: 5 submissions per 10 minutes */
export const leadCaptureLimiter = createFormRateLimiter("lead-capture", {
  maxAttempts: 5,
  windowMs: 10 * 60 * 1000,
});

/** Event registration: 5 per 10 minutes */
export const eventRegistrationLimiter = createFormRateLimiter("event-registration", {
  maxAttempts: 5,
  windowMs: 10 * 60 * 1000,
});

/** LGPD rights request: 3 per hour */
export const lgpdRightsLimiter = createFormRateLimiter("lgpd-rights", {
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000,
});

/** Survey public form: 3 per 10 minutes */
export const surveyLimiter = createFormRateLimiter("survey-form", {
  maxAttempts: 3,
  windowMs: 10 * 60 * 1000,
});
