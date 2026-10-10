import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, getSavedTheme } from '../src/lib/theme';

describe('persisted application theme', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('restores the saved preference after reinitialization', () => {
    localStorage.setItem('yaqoob-theme', 'dark');
    applyTheme(getSavedTheme());

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(getSavedTheme()).toBe('dark');
  });

  it('falls back to light mode when no valid preference exists', () => {
    localStorage.setItem('yaqoob-theme', 'invalid');
    applyTheme(getSavedTheme());

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(getSavedTheme()).toBe('light');
  });

  it('falls back safely when browser storage is unavailable', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage is unavailable');
    });

    expect(getSavedTheme()).toBe('light');
    applyTheme(getSavedTheme());
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    getItem.mockRestore();
  });
});
