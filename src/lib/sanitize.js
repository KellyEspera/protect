// src/lib/sanitize.js
// Input sanitization utilities for XSS prevention
// Compliant with RA 10173 (Data Privacy Act) secure input handling

/**
 * Strips HTML tags and escapes dangerous characters from a string.
 * Prevents XSS attacks when user input is rendered in the DOM.
 */
export function sanitizeString(value) {
  if (typeof value !== 'string') return value

  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#x60;')
    .trim()
}

/**
 * Sanitizes all string values in a flat object (e.g. a form payload).
 * Safe values (booleans, numbers, null) are passed through unchanged.
 */
export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj

  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      if (typeof value === 'string') return [key, sanitizeString(value)]
      return [key, value]
    })
  )
}

/**
 * Validates and sanitizes a Philippine contact number.
 * Accepts: 09XXXXXXXXX or +639XXXXXXXXX
 */
export function sanitizeContactNumber(value) {
  if (!value) return ''
  const cleaned = value.replace(/\s+/g, '').replace(/[^\d+]/g, '')
  const phMobile = /^(09|\+639)\d{9}$/
  return phMobile.test(cleaned) ? cleaned : ''
}

/**
 * Sanitizes a numeric income value.
 * Returns 0 for invalid or negative inputs.
 */
export function sanitizeIncome(value) {
  const num = parseFloat(value)
  if (isNaN(num) || num < 0) return 0
  return Math.round(num * 100) / 100 // max 2 decimal places
}

/**
 * Validates a date string is a real past date (not future, not garbage).
 */
export function sanitizeDateOfBirth(value) {
  if (!value) return ''
  const date = new Date(value)
  const now = new Date()
  if (isNaN(date.getTime())) return ''        // invalid date
  if (date > now) return ''                   // future date not allowed
  if (date.getFullYear() < 1900) return ''    // unrealistic year
  return value
}

/**
 * Sanitizes a full form object specifically for the Residents form.
 * Applies field-specific rules on top of general string sanitization.
 */
export function sanitizeResidentForm(form) {
  const base = sanitizeObject(form)
  return {
    ...base,
    contact_number: sanitizeContactNumber(form.contact_number),
    monthly_income: sanitizeIncome(form.monthly_income),
    date_of_birth: sanitizeDateOfBirth(form.date_of_birth),
    // Strip anything beyond 100 chars for name fields
    first_name: (base.first_name || '').slice(0, 100),
    last_name: (base.last_name || '').slice(0, 100),
    middle_name: (base.middle_name || '').slice(0, 100),
    occupation: (base.occupation || '').slice(0, 150),
  }
}

/**
 * Sanitizes the incident report form.
 */
export function sanitizeIncidentForm(form) {
  const base = sanitizeObject(form)
  return {
    ...base,
    complainant: (base.complainant || '').slice(0, 200),
    description: (base.description || '').slice(0, 1000),
  }
}

/**
 * Sanitizes the survey response form.
 */
export function sanitizeSurveyForm(form) {
  const base = sanitizeObject(form)
  return {
    ...base,
    comments: (base.comments || '').slice(0, 500),
  }
}