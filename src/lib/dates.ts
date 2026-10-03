/**
 * Strict Asia/Karachi Business Date Engine
 * Pakistan Standard Time is UTC+5, with no Daylight Saving Time.
 * All business dates must reflect the local calendar date (YYYY-MM-DD) in Pakistan,
 * regardless of the device's physical timezone.
 */

export const SHOP_TIMEZONE = 'Asia/Karachi';

/**
 * Returns the YYYY-MM-DD business date string in Asia/Karachi for a given timestamp.
 * If no timestamp is provided, derives it from current time.
 */
export function getKarachiBusinessDate(dateOrTimestamp: Date | string | number = new Date()): string {
  const d = typeof dateOrTimestamp === 'object' ? dateOrTimestamp : new Date(dateOrTimestamp);
  if (isNaN(d.getTime())) {
    throw new Error('Invalid timestamp provided for business date derivation');
  }

  // Use Intl.DateTimeFormat with en-CA which yields ISO format YYYY-MM-DD
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHOP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(d);
}

/**
 * Returns the current time formatted for display in Asia/Karachi (e.g. "02:30 PM")
 */
export function formatKarachiTime(dateOrTimestamp: Date | string | number = new Date()): string {
  const d = typeof dateOrTimestamp === 'object' ? dateOrTimestamp : new Date(dateOrTimestamp);
  if (isNaN(d.getTime())) return '-';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: SHOP_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Formats a YYYY-MM-DD business date string to a human-readable date (e.g. "03 Oct 2026")
 */
export function formatDisplayDate(businessDateStr: string): string {
  if (!businessDateStr) return '-';
  const parts = businessDateStr.split('-');
  if (parts.length !== 3) return businessDateStr;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const d = new Date(Date.UTC(year, month, day));
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/**
 * Validates whether a device's business date has unacceptable future drift.
 * Protects against users with clocks set ahead.
 * Allows at most 1 day ahead (to account for edge-of-midnight syncs).
 */
export function validateDateDrift(
  businessDate: string,
  referenceDate: Date = new Date()
): { isValid: boolean; error?: string } {
  const currentKarachiDate = getKarachiBusinessDate(referenceDate);

  // Compare lexicographically (YYYY-MM-DD)
  if (businessDate > currentKarachiDate) {
    // Check if it's more than 1 day ahead
    const current = new Date(currentKarachiDate);
    const target = new Date(businessDate);
    const diffDays = Math.round((target.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays > 1) {
      return {
        isValid: false,
        error: `Future business date rejected. Entry date (${businessDate}) is ${diffDays} days ahead of shop date (${currentKarachiDate}).`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Derives yesterday's business date in Asia/Karachi
 */
export function getYesterdayKarachiDate(referenceDate: Date = new Date()): string {
  const today = getKarachiBusinessDate(referenceDate);
  const parts = today.split('-');
  const d = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
