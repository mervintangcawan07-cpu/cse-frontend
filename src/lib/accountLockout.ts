// Relative Path: src/lib/accountLockout.ts

interface LockoutRecord {
  failedAttempts: number;
  lockedUntil: number | null;
  lastFailedAt: number;
}

// In-memory store for account login failures
const lockoutStore = new Map<string, LockoutRecord>();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 Minutes
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;  // 15 Minutes window

/**
 * Checks if a user account is currently locked due to prior failed attempts.
 */
export function checkAccountLockout(email: string): {
  isLocked: boolean;
  remainingSeconds: number;
} {
  const cleanEmail = email.toLowerCase().trim();
  const record = lockoutStore.get(cleanEmail);

  if (!record || !record.lockedUntil) {
    return { isLocked: false, remainingSeconds: 0 };
  }

  const now = Date.now();
  if (now < record.lockedUntil) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { isLocked: true, remainingSeconds };
  }

  // Lock expired -> auto-clear record
  lockoutStore.delete(cleanEmail);
  return { isLocked: false, remainingSeconds: 0 };
}

/**
 * Records a failed login attempt against an account.
 */
export function recordFailedAttempt(email: string): {
  isLocked: boolean;
  attemptsLeft: number;
  remainingSeconds: number;
} {
  const cleanEmail = email.toLowerCase().trim();
  const now = Date.now();
  const record = lockoutStore.get(cleanEmail) || {
    failedAttempts: 0,
    lockedUntil: null,
    lastFailedAt: now,
  };

  // Reset counter if window has passed since last failure
  if (now - record.lastFailedAt > ATTEMPT_WINDOW_MS) {
    record.failedAttempts = 0;
  }

  record.failedAttempts += 1;
  record.lastFailedAt = now;

  if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    lockoutStore.set(cleanEmail, record);
    return {
      isLocked: true,
      attemptsLeft: 0,
      remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
    };
  }

  lockoutStore.set(cleanEmail, record);
  return {
    isLocked: false,
    attemptsLeft: MAX_FAILED_ATTEMPTS - record.failedAttempts,
    remainingSeconds: 0,
  };
}

/**
 * Resets failed attempts upon a successful login.
 */
export function resetFailedAttempts(email: string): void {
  const cleanEmail = email.toLowerCase().trim();
  lockoutStore.delete(cleanEmail);
}