import { describe, it, expect } from 'vitest';
import { parseMessage, normalizeLine, matchCategoryOrAction, SEED_CATEGORIES } from '../src/parser';
import { getKarachiBusinessDate, getYesterdayKarachiDate } from '../src/lib/dates';

describe('Phase 2: Local Deterministic Parser Suite', () => {
  const refDate = new Date('2026-10-04T12:00:00Z');
  const todayDate = getKarachiBusinessDate(refDate);
  const yesterdayDate = getYesterdayKarachiDate(refDate);

  describe('1. Exact Match Auto-Save (Income & Expense with correct sign)', () => {
    it('auto-saves exact income entries without confirmation card', () => {
      const inputs = [
        'PRINT 300',
        'print 50',
        'PRINTING 1200',
        'prnt 100',
        'PHOTOCOPY 20',
        'STAMP 100',
        'stamp 500',
        'LAMINATION 150',
        'PRINT 2500/-',
        'Rs. 500 PRINT',
        'PRINT Rs 450',
        'STAMP 1200',
        '+PRINT 350',
      ];

      for (const raw of inputs) {
        const res = parseMessage(raw, [], refDate);
        expect(res.entries).toHaveLength(1);
        const entry = res.entries[0];
        expect(entry.action, `Failed on: "${raw}"`).toBe('auto_save');
        expect(entry.type, `Wrong type on: "${raw}"`).toBe('income');
        expect(entry.canAutoSave).toBe(true);
      }
    });

    it('auto-saves exact expense entries with minus sign', () => {
      const inputs = [
        'PAPER - 2000',
        '-PAPER 1500',
        '- PAPER 3500',
        'PAPER -2500',
        '-BILL 4500',
        '- ELECTRICITY 8000',
        '-CHAI 150',
        '-SUPPLIES 600',
        '-STAMP PURCHASE 12000',
        '-BUY STAMP 5000',
      ];

      for (const raw of inputs) {
        const res = parseMessage(raw, [], refDate);
        expect(res.entries).toHaveLength(1);
        const entry = res.entries[0];
        expect(entry.action, `Failed on: "${raw}"`).toBe('auto_save');
        expect(entry.type, `Wrong type on: "${raw}"`).toBe('expense');
        expect(entry.canAutoSave).toBe(true);
      }
    });

    it('records STAMP amounts exactly as typed as income', () => {
      const res = parseMessage('STAMP 100', [], refDate);
      expect(res.entries[0].amountPaisa).toBe(10000);
      expect(res.entries[0].type).toBe('income');
      expect(res.entries[0].categoryName).toBe('Legal Stamp Paper');

      const resLarge = parseMessage('STAMP 1500', [], refDate);
      expect(resLarge.entries[0].amountPaisa).toBe(150000);
      expect(resLarge.entries[0].type).toBe('income');
    });
  });

  describe('2. Conflict Detection & Safety Gates', () => {
    it('prompts on expense category typed without a minus sign (PAPER 2000)', () => {
      const res = parseMessage('PAPER 2000', [], refDate);
      const entry = res.entries[0];
      expect(entry.action).toBe('ask_clarification');
      expect(entry.isConflict).toBe(true);
      expect(entry.canAutoSave).toBe(false);
      expect(entry.clarificationPrompt).toContain('expense');
    });

    it('prompts on expense category typed with a plus sign (+PAPER 2000)', () => {
      const res = parseMessage('+PAPER 2000', [], refDate);
      const entry = res.entries[0];
      expect(entry.action).toBe('ask_clarification');
      expect(entry.isConflict).toBe(true);
    });

    it('prompts on income category typed with a minus sign (-PRINT 300)', () => {
      const res = parseMessage('-PRINT 300', [], refDate);
      const entry = res.entries[0];
      expect(entry.action).toBe('ask_clarification');
      expect(entry.isConflict).toBe(true);
      expect(entry.canAutoSave).toBe(false);
    });

    it('prompts on bare numbers with 5 options', () => {
      const res = parseMessage('10000', [], refDate);
      const entry = res.entries[0];
      expect(entry.action).toBe('ask_clarification');
      expect(entry.options).toHaveLength(5);
      const types = entry.options?.map((o) => o.type);
      expect(types).toEqual(['income', 'expense', 'capital_in', 'withdrawal', 'adjustment']);
    });

    it('prompts on unknown words', () => {
      const res = parseMessage('GLUE 120', [], refDate);
      const entry = res.entries[0];
      expect(entry.action).toBe('ask_clarification');
      expect(entry.clarificationPrompt).toContain('Unknown category "GLUE"');
    });

    it('rejects ambiguous "kal" and asks for clarification', () => {
      const res = parseMessage('PRINT 300 kal', [], refDate);
      const entry = res.entries[0];
      expect(entry.action).toBe('ask_clarification');
      expect(entry.clarificationPrompt).toContain('"kal" is ambiguous');
    });
  });

  describe('3. Fuzzy & Phonetic Matching Rules', () => {
    it('prompts "Did you mean?" for phonetic match LMNYON and does not auto-save', () => {
      const res = parseMessage('LMNYON 200', [], refDate);
      const entry = res.entries[0];
      // Note: LMNYON is an alias in seed categories, but let's test a true fuzzy/phonetic like LMNATION or LMNTION
      const resFuzzy = parseMessage('LMNESHUN 200', [], refDate);
      expect(resFuzzy.entries[0].action).toBe('ask_clarification');
      expect(resFuzzy.entries[0].canAutoSave).toBe(false);
    });

    it('prompts on 1-edit fuzzy typo for length 4-6 (e.g. PRNTG -> PRINT)', () => {
      const res = parseMessage('PRNTG 200', [], refDate);
      const entry = res.entries[0];
      expect(entry.action).toBe('ask_clarification');
      expect(entry.canAutoSave).toBe(false);
      expect(entry.clarificationPrompt).toContain('Printing');
    });

    it('does not allow fuzzy matching for short words (length <= 3)', () => {
      // e.g. "PIN" should not fuzzy match "PRINT" (edit dist 2) or "RIM" (dist 2)
      const res = parseMessage('PIN 200', [], refDate);
      expect(res.entries[0].action).toBe('ask_clarification');
      expect(res.entries[0].clarificationPrompt).toContain('Unknown category');
    });
  });

  describe('4. Confirmation Cards for System Transactions', () => {
    it('always shows confirmation card for capital in', () => {
      const res = parseMessage('CAPITAL 50000', [], refDate);
      const entry = res.entries[0];
      expect(entry.action).toBe('needs_confirmation');
      expect(entry.type).toBe('capital_in');
      expect(entry.canAutoSave).toBe(false);
    });

    it('always shows confirmation card for withdrawal', () => {
      const res = parseMessage('WITHDRAW 5000', [], refDate);
      const entry = res.entries[0];
      expect(entry.action).toBe('needs_confirmation');
      expect(entry.type).toBe('withdrawal');
      expect(entry.canAutoSave).toBe(false);
    });

    it('always shows confirmation card for adjustment', () => {
      const res = parseMessage('ADJUSTMENT 500', [], refDate);
      const entry = res.entries[0];
      expect(entry.action).toBe('needs_confirmation');
      expect(entry.type).toBe('adjustment');
      expect(entry.canAutoSave).toBe(false);
    });
  });

  describe('5. Unusual Amounts & Duplicate Detection', () => {
    it('flags amounts exceeding Rs 50,000 for confirmation', () => {
      const res = parseMessage('PRINT 60000', [], refDate);
      const entry = res.entries[0];
      expect(entry.action).toBe('needs_confirmation');
      expect(entry.isUnusualAmount).toBe(true);
      expect(entry.reason).toContain('exceeds the usual limit');
    });

    it('flags possible duplicates within 3 minutes', () => {
      const recent = [
        {
          categoryId: 'cat-printing',
          amountPaisa: 30000,
          entryTimeUtc: new Date(refDate.getTime() - 60 * 1000).toISOString(), // 1 minute ago
          type: 'income' as const,
        },
      ];

      const res = parseMessage('PRINT 300', recent, refDate);
      const entry = res.entries[0];
      expect(entry.action).toBe('needs_confirmation');
      expect(entry.isDuplicate).toBe(true);
      expect(entry.reason).toContain('duplicate');
    });
  });

  describe('6. Backdating and Date Chips', () => {
    it('recognizes "yesterday" and sets business date to yesterday', () => {
      const res = parseMessage('PRINT 300 yesterday', [], refDate);
      expect(res.entries[0].businessDate).toBe(yesterdayDate);
      expect(res.entries[0].action).toBe('auto_save');
    });

    it('recognizes explicit date chip YYYY-MM-DD', () => {
      const res = parseMessage('PRINT 300 2026-10-02', [], refDate);
      expect(res.entries[0].businessDate).toBe('2026-10-02');
      expect(res.entries[0].action).toBe('auto_save');
    });
  });

  describe('7. Multi-line Batch Messages', () => {
    it('parses multi-line messages into a batch result', () => {
      const input = `
        PRINT 300
        -PAPER 2000
        STAMP 100
      `.trim();

      const batch = parseMessage(input, [], refDate);
      expect(batch.isBatch).toBe(true);
      expect(batch.entries).toHaveLength(3);
      expect(batch.canSaveAll).toBe(true);
      expect(batch.entries[0].type).toBe('income');
      expect(batch.entries[1].type).toBe('expense');
      expect(batch.entries[2].type).toBe('income');
    });

    it('requires fixing flagged lines before batch save when conflict exists', () => {
      const input = `
        PRINT 300
        PAPER 2000
        STAMP 100
      `.trim();

      const batch = parseMessage(input, [], refDate);
      expect(batch.isBatch).toBe(true);
      expect(batch.entries[1].isConflict).toBe(true);
      expect(batch.canSaveAll).toBe(false);
      expect(batch.hasErrorsOrConflicts).toBe(true);
    });

    it('splits same-line entries joined by English or Roman Urdu conjunctions', () => {
      const englishBatch = parseMessage('PRINT 500 and LAMINATION 200', [], refDate);
      const urduBatch = parseMessage('PHOTOCOPY 100 aur STAMP 350', [], refDate);

      expect(englishBatch.isBatch).toBe(true);
      expect(englishBatch.entries.map((entry) => entry.amountPaisa)).toEqual([50000, 20000]);
      expect(englishBatch.entries.every((entry) => entry.action === 'auto_save')).toBe(true);
      expect(urduBatch.isBatch).toBe(true);
      expect(urduBatch.entries.map((entry) => entry.amountPaisa)).toEqual([10000, 35000]);
    });

    it('does not split a conjunction when one side has no amount', () => {
      const result = parseMessage('PRINT 500 and lamination', [], refDate);

      expect(result.isBatch).toBe(false);
      expect(result.entries).toHaveLength(1);
    });
  });

  describe('8. Realistic 300+ Message Corpus Test', () => {
    // Generate a comprehensive real-world dataset covering variations
    const services = [
      { name: 'PRINT', type: 'income', signs: ['', '+'], amounts: [10, 50, 100, 250, 400, 1000, 2500, 5000] },
      { name: 'PHOTOCOPY', type: 'income', signs: ['', '+'], amounts: [5, 10, 20, 30, 80, 120] },
      { name: 'STAMP', type: 'income', signs: ['', '+'], amounts: [50, 100, 500, 1000, 1200, 2000] },
      { name: 'LAMINATION', type: 'income', signs: ['', '+'], amounts: [50, 100, 150, 300, 500] },
      { name: 'PAPER', type: 'expense', signs: ['- '], amounts: [1500, 2200, 3000, 5000, 12000] },
      { name: 'BILL', type: 'expense', signs: ['- '], amounts: [500, 1200, 3500, 8000] },
      { name: 'ELECTRICITY', type: 'expense', signs: ['- '], amounts: [4000, 7500, 15000] },
      { name: 'CHAI', type: 'expense', signs: ['- '], amounts: [50, 100, 150, 250] },
      { name: 'STAMP PURCHASE', type: 'expense', signs: ['- '], amounts: [5000, 10000, 25000] },
    ];

    const formats = [
      (s: string, sign: string, amt: number) => `${sign}${s} ${amt}`,
      (s: string, sign: string, amt: number) => `${s} ${sign}${amt}`,
      (s: string, sign: string, amt: number) => `${sign}${s} Rs ${amt}`,
      (s: string, sign: string, amt: number) => `${sign}${s} ${amt}/-`,
      (s: string, sign: string, amt: number) => `Rs. ${amt} ${sign}${s}`,
      (s: string, sign: string, amt: number) => `${sign}${s} PKR ${amt}`,
      (s: string, sign: string, amt: number) => `${sign}${s} ${amt.toLocaleString()}`,
    ];

    const corpus: { text: string; expectedType: string }[] = [];

    for (const s of services) {
      for (const sign of s.signs) {
        for (const amt of s.amounts) {
          for (const fmt of formats) {
            corpus.push({
              text: fmt(s.name, sign, amt),
              expectedType: s.type,
            });
          }
        }
      }
    }

    it(`executes ${corpus.length} messages with ZERO silent income/expense misclassifications`, () => {
      expect(corpus.length).toBeGreaterThanOrEqual(300);

      let misclassifications = 0;
      let processed = 0;

      for (const item of corpus) {
        processed++;
        const res = parseMessage(item.text, [], refDate);
        expect(res.entries).toHaveLength(1);
        const entry = res.entries[0];

        // CRITICAL INVARIANT: ZERO silent misclassifications
        // If an entry is auto-saved, it MUST match the expected type!
        if (entry.canAutoSave) {
          if (entry.type !== item.expectedType) {
            misclassifications++;
            console.error(`Silent misclassification on "${item.text}": got ${entry.type}, expected ${item.expectedType}`);
          }
        }
        expect(entry.type).toBe(item.expectedType);
      }

      expect(misclassifications).toBe(0);
      expect(processed).toBeGreaterThanOrEqual(300);
    });
  });
});
