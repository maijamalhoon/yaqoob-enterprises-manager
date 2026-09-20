import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Deterministic financial rounding to 2 decimal places.
 * Avoids IEEE-754 floating point arithmetic anomalies like 0.1 + 0.2 = 0.30000000000000004
 */
export function roundMoney(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Format currency with organization symbol or default PKR / Rs.
 */
export function formatCurrency(amount: number, symbol = 'Rs.'): string {
  const rounded = roundMoney(amount);
  const parts = Math.abs(rounded).toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = rounded < 0 ? '-' : '';
  return `${sign}${symbol} ${parts[0]}.${parts[1]}`;
}

export function formatCompactCurrency(amount: number, symbol = 'Rs.'): string {
  const rounded = roundMoney(amount);
  if (Math.abs(rounded) >= 1_000_000) {
    return `${symbol} ${(rounded / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(rounded) >= 1_000) {
    return `${symbol} ${(rounded / 1_000).toFixed(1)}k`;
  }
  return formatCurrency(rounded, symbol);
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Weighted Average Cost (WAC) calculation:
 * When adding purchases to existing inventory:
 * newAvgCost = ( (currentStock * currentAvgCost) + (newQty * newUnitCost) ) / (currentStock + newQty)
 */
export function calculateWeightedAverageCost(
  currentStock: number,
  currentAvgCost: number,
  incomingQty: number,
  incomingUnitCost: number
): { newStock: number; newAvgCost: number; newStockValue: number } {
  const safeCurrentStock = Math.max(0, currentStock);
  const safeCurrentAvgCost = Math.max(0, currentAvgCost);
  const safeIncomingQty = Math.max(0, incomingQty);
  const safeIncomingUnitCost = Math.max(0, incomingUnitCost);

  const existingValue = roundMoney(safeCurrentStock * safeCurrentAvgCost);
  const incomingValue = roundMoney(safeIncomingQty * safeIncomingUnitCost);
  const newStock = roundMoney(safeCurrentStock + safeIncomingQty);

  if (newStock <= 0) {
    return {
      newStock: 0,
      newAvgCost: safeIncomingUnitCost > 0 ? safeIncomingUnitCost : safeCurrentAvgCost,
      newStockValue: 0,
    };
  }

  const newAvgCost = roundMoney((existingValue + incomingValue) / newStock);
  const newStockValue = roundMoney(newStock * newAvgCost);

  return {
    newStock,
    newAvgCost,
    newStockValue,
  };
}

/**
 * Format ISO string to readable localized date
 */
export function formatDate(isoString: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export function formatDateTime(isoString: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

export function formatTime(isoString: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

/**
 * Quick Date filter comparisons
 */
export function isToday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function isYesterday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  );
}

export function isThisWeek(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
  firstDay.setHours(0, 0, 0, 0);
  return date >= firstDay;
}

export function isThisMonth(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  return (
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

export function isThisYear(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  return date.getFullYear() === now.getFullYear();
}

/**
 * Export tabular data directly to CSV download
 */
export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = [
    headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
