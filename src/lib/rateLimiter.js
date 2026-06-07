// src/lib/rateLimiter.js
// Client-side brute force protection for the login form.
// Tracks failed attempts in sessionStorage per email address.

const MAX_ATTEMPTS = 5          // max failed logins before lockout
const LOCKOUT_DURATION = 15 * 60 * 1000  // 15 minutes in ms
const STORAGE_KEY = 'protect_login_attempts'

/**
 * Reads the current attempt record from sessionStorage.
 */
function getAttemptRecord(email) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const all = raw ? JSON.parse(raw) : {}
    return all[email] || { count: 0, lockedUntil: null }
  } catch {
    return { count: 0, lockedUntil: null }
  }
}

/**
 * Saves an updated attempt record to sessionStorage.
 */
function setAttemptRecord(email, record) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const all = raw ? JSON.parse(raw) : {}
    all[email] = record
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // sessionStorage not available — fail silently
  }
}

/**
 * Call this BEFORE attempting login.
 * Returns { allowed: true } if the attempt is permitted.
 * Returns { allowed: false, remainingMs, remainingMin } if locked out.
 */
export function checkRateLimit(email) {
  if (!email) return { allowed: true }

  const key = email.toLowerCase().trim()
  const record = getAttemptRecord(key)

  // Check if currently locked out
  if (record.lockedUntil) {
    const remaining = record.lockedUntil - Date.now()
    if (remaining > 0) {
      return {
        allowed: false,
        remainingMs: remaining,
        remainingMin: Math.ceil(remaining / 60000),
      }
    } else {
      // Lockout expired — reset
      setAttemptRecord(key, { count: 0, lockedUntil: null })
    }
  }

  return { allowed: true }
}

/**
 * Call this AFTER a FAILED login attempt.
 * Increments the counter and locks the account if max attempts reached.
 * Returns the updated record.
 */
export function recordFailedAttempt(email) {
  if (!email) return

  const key = email.toLowerCase().trim()
  const record = getAttemptRecord(key)
  const newCount = record.count + 1

  const updated = {
    count: newCount,
    lockedUntil: newCount >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_DURATION : null,
  }

  setAttemptRecord(key, updated)
  return {
    ...updated,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - newCount),
    isLocked: newCount >= MAX_ATTEMPTS,
  }
}

/**
 * Call this AFTER a SUCCESSFUL login.
 * Clears the attempt record for that email.
 */
export function clearAttempts(email) {
  if (!email) return
  const key = email.toLowerCase().trim()
  setAttemptRecord(key, { count: 0, lockedUntil: null })
}

/**
 * Returns a human-readable countdown string, e.g. "14:32"
 */
export function formatLockoutTime(remainingMs) {
  const totalSeconds = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}