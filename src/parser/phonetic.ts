/**
 * Phonetic Matching Utilities
 * Implements a Metaphone-inspired phonetic encoder tuned for English & Urdu transliterated shop terms.
 */

export function soundex(str: string): string {
  if (!str) return '';
  const clean = str.toUpperCase().replace(/[^A-Z]/g, '');
  if (clean.length === 0) return '';

  const firstLetter = clean[0];
  const mappings: Record<string, string> = {
    B: '1', F: '1', P: '1', V: '1',
    C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
    D: '3', T: '3',
    L: '4',
    M: '5', N: '5',
    R: '6',
  };

  let code = firstLetter;
  let prevCode = mappings[firstLetter] || '0';

  for (let i = 1; i < clean.length; i++) {
    const char = clean[i];
    const currCode = mappings[char] || '0';
    if (currCode !== '0' && currCode !== prevCode) {
      code += currCode;
    }
    prevCode = currCode;
    if (code.length === 4) break;
  }

  return code.padEnd(4, '0');
}

/**
 * Custom shop phonetic encoder.
 * Transforms words to their phonetic skeletons:
 * - Drops consecutive duplicate consonants
 * - Normalizes common transliteration patterns (ph->f, wr->r, kn->n, etc.)
 * - Keeps initial vowel, drops intermediate unaccented vowels
 * - Equates similar sound groups (y/i/e, tion/sion/yon/shun)
 */
export function phoneticCode(word: string): string {
  if (!word) return '';
  let s = word.trim().toLowerCase();

  // Normalize common phonetic equivalences in Urdu/English shop slang
  s = s.replace(/tion|sion|shun|nyon/g, 'xn');
  s = s.replace(/ph/g, 'f');
  s = s.replace(/ck/g, 'k');
  s = s.replace(/qu/g, 'k');
  s = s.replace(/gh/g, 'g');
  s = s.replace(/dg/g, 'j');
  s = s.replace(/c([eiy])/g, 's$1');
  s = s.replace(/c/g, 'k');
  s = s.replace(/w([aeiou])/g, 'v$1');
  s = s.replace(/y([aeiou])/g, 'i$1');
  s = s.replace(/oo/g, 'u');
  s = s.replace(/ee/g, 'i');

  // Remove consecutive duplicates
  let dedupe = '';
  for (let i = 0; i < s.length; i++) {
    if (i === 0 || s[i] !== s[i - 1]) {
      dedupe += s[i];
    }
  }
  s = dedupe;

  // Keep first char, drop inner vowels
  if (s.length === 0) return '';
  const first = s[0];
  const rest = s.slice(1).replace(/[aeiouy]/g, '');

  return (first + rest).toUpperCase();
}

/**
 * Checks if two words have similar phonetic representations.
 */
export function isPhoneticMatch(wordA: string, wordB: string): boolean {
  if (!wordA || !wordB) return false;
  const a = wordA.trim().toLowerCase();
  const b = wordB.trim().toLowerCase();
  if (a === b) return true;

  // Compare custom phonetic code
  const codeA = phoneticCode(a);
  const codeB = phoneticCode(b);
  if (codeA === codeB && codeA.length >= 2) return true;

  // Compare Soundex
  const soundA = soundex(a);
  const soundB = soundex(b);
  if (soundA === soundB && soundA !== '0000') return true;

  return false;
}
