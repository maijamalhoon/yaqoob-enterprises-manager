/**
 * Integer Paisa Money Engine
 * In Pakistan, 1 Rupee = 100 Paisa.
 * All ledger amounts are strictly stored and computed as integer paisa (BIGINT in Postgres).
 * Zero floating-point rounding errors.
 */

/** Convert Rupee number (e.g. 300 or 300.50) to integer paisa (30000 or 30050) */
export function rupeesToPaisa(rupees: number): number {
  if (!Number.isFinite(rupees)) {
    throw new Error('Invalid rupee amount: must be a finite number');
  }
  return Math.round(rupees * 100);
}

/** Convert integer paisa to floating rupee value for display or calculation */
export function paisaToRupees(paisa: number): number {
  if (!Number.isSafeInteger(paisa)) {
    throw new Error('Paisa amount must be a safe integer');
  }
  return paisa / 100;
}

/** Format integer paisa as standard Pakistani Rupee currency string, e.g. "Rs 12,500" */
export function formatPaisa(paisa: number, options?: { showPaisaIfFraction?: boolean }): string {
  const rupees = paisaToRupees(paisa);
  const isFractional = paisa % 100 !== 0;

  if (isFractional && options?.showPaisaIfFraction) {
    const formatted = new Intl.NumberFormat('en-PK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(rupees);
    return `Rs ${formatted}`;
  }

  const roundedRupees = Math.round(rupees);
  const formatted = new Intl.NumberFormat('en-PK', {
    maximumFractionDigits: 0,
  }).format(roundedRupees);

  return `Rs ${formatted}`;
}

/** Parse an amount string from user input or parser (e.g. "300", "2000", "12.50", "200,000") into integer paisa */
export function parseInputToPaisa(input: string): { paisa: number; isValid: boolean; error?: string } {
  if (!input || typeof input !== 'string') {
    return { paisa: 0, isValid: false, error: 'Empty amount input' };
  }

  // Clean commas, spaces, currency symbols
  const cleaned = input
    .replace(/,/g, '')
    .replace(/rs\.?/gi, '')
    .replace(/pkr/gi, '')
    .replace(/\/-/g, '')
    .trim();

  const num = parseFloat(cleaned);
  if (isNaN(num) || !Number.isFinite(num)) {
    return { paisa: 0, isValid: false, error: `Invalid number format: "${input}"` };
  }

  if (num <= 0) {
    return { paisa: 0, isValid: false, error: 'Amount must be greater than zero' };
  }

  const paisa = Math.round(num * 100);
  if (!Number.isSafeInteger(paisa)) {
    return { paisa: 0, isValid: false, error: 'Amount exceeds safe integer range' };
  }

  return { paisa, isValid: true };
}

/** Calculate Net Profit strictly as Income - Expense */
export function calculateNetProfitPaisa(incomePaisa: number, expensePaisa: number): number {
  return incomePaisa - expensePaisa;
}
