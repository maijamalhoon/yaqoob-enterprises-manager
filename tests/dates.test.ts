import { describe, it, expect } from 'vitest';
import {
  getKarachiBusinessDate,
  formatKarachiTime,
  formatDisplayDate,
  validateDateDrift,
  getYesterdayKarachiDate,
} from '../src/lib/dates';

describe('Asia/Karachi Business Date Engine', () => {
  it('correctly derives Pakistan calendar date regardless of UTC time (midnight boundary)', () => {
    // 2026-10-03 20:00:00 UTC is 2026-10-04 01:00:00 AM PKT
    const lateNightUtc = new Date('2026-10-03T20:00:00.000Z');
    const karachiDate = getKarachiBusinessDate(lateNightUtc);

    // In Karachi, this is ALREADY October 4th!
    expect(karachiDate).toBe('2026-10-04');

    // 2026-10-03 18:59:00 UTC is 2026-10-03 23:59:00 PKT
    const justBeforeMidnightUtc = new Date('2026-10-03T18:59:00.000Z');
    expect(getKarachiBusinessDate(justBeforeMidnightUtc)).toBe('2026-10-03');
  });

  it('formats human readable dates accurately', () => {
    expect(formatDisplayDate('2026-10-04')).toBe('04 Oct 2026');
    expect(formatDisplayDate('2026-01-15')).toBe('15 Jan 2026');
  });

  it('calculates yesterday in Asia/Karachi', () => {
    const reference = new Date('2026-10-04T05:00:00.000Z'); // 10 AM PKT on Oct 4
    expect(getYesterdayKarachiDate(reference)).toBe('2026-10-03');
  });

  it('validates and rejects unacceptable future date drift', () => {
    const reference = new Date('2026-10-04T10:00:00.000Z'); // Today is 2026-10-04

    // Same day is valid
    expect(validateDateDrift('2026-10-04', reference)).toEqual({ isValid: true });

    // Past date (backdating) is always valid
    expect(validateDateDrift('2026-10-01', reference)).toEqual({ isValid: true });

    // 1 day ahead (edge case / clock skew) is allowed
    expect(validateDateDrift('2026-10-05', reference)).toEqual({ isValid: true });

    // 2+ days ahead is rejected
    const invalidFuture = validateDateDrift('2026-10-07', reference);
    expect(invalidFuture.isValid).toBe(false);
    expect(invalidFuture.error).toContain('Future business date rejected');
  });
});
