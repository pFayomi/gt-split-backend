import { createHash, randomBytes } from 'crypto';

/**
 * Narration matching is deliberately EXACT. The key is derived only from case,
 * leading/trailing whitespace and internal whitespace runs, so "Dinner at
 * Bova" and "dinner  at bova" are the same narration but "Dinner at Bova" and
 * "Dinner at Bovi" are not.
 *
 * There is intentionally no fuzzy or embedding-based comparison here. A
 * near-miss match would silently send the wrong amount to the wrong people,
 * which is unrecoverable once the money has moved.
 */
export function normalizeNarration(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Fixed-length index key for a narration, used for the rule lookup. */
export function narrationKey(raw: string | null | undefined): string {
  return createHash('sha256').update(normalizeNarration(raw), 'utf8').digest('hex').slice(0, 32);
}

/** 256 bits of entropy, URL-safe so it can be dropped straight into a link. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Only the hash of an approval token is persisted. The raw token exists in the
 * emailed link and nowhere else, so a database leak cannot be replayed against
 * someone's pending splits.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}