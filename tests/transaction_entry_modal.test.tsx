import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { parseMessage, SEED_CATEGORIES } from '../src/parser';
import { LedgerAccount } from '../src/types/ledger';
import { ConfirmationModal } from '../src/components/chat/ConfirmationModal';

const accounts: LedgerAccount[] = [
  {
    id: 'cash-shop-1',
    organization_id: 'shop-1',
    name: 'Till Cash',
    type: 'CASH',
    balance_paisa: 100_000,
    current_balance: 1000,
    opening_balance: 1000,
    is_active: true,
    is_default: true,
    created_at: '2026-10-10T00:00:00Z',
  },
  {
    id: 'bank-shop-1',
    organization_id: 'shop-1',
    name: 'Shop Bank',
    type: 'BANK',
    balance_paisa: 0,
    current_balance: 0,
    opening_balance: 0,
    is_active: true,
    is_default: false,
    created_at: '2026-10-10T00:00:00Z',
  },
];

function parseEntry(input: string) {
  return parseMessage(input, [], new Date('2026-10-10T10:00:00+05:00'), SEED_CATEGORIES)
    .entries[0];
}

describe('Unified transaction entry review', () => {
  it('reviews a recognized income and posts it to the selected active account in the same dialog', async () => {
    const onConfirmSingle = vi.fn().mockResolvedValue(undefined);
    render(
      <ConfirmationModal
        result={parseEntry('PRINT 300')}
        accounts={accounts}
        categories={SEED_CATEGORIES}
        onConfirmSingle={onConfirmSingle}
        onConfirmBatch={vi.fn()}
        onSkipToReview={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('PRINT 300')).toBeTruthy();
    expect((screen.getByLabelText('Transaction type') as HTMLSelectElement).value)
      .toBe('income');
    expect((screen.getByLabelText('Payment account') as HTMLSelectElement).value)
      .toBe('cash-shop-1');
    fireEvent.change(screen.getByLabelText('Payment account'), {
      target: { value: 'bank-shop-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & post' }));

    await waitFor(() => expect(onConfirmSingle).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'income',
        categoryId: 'cat-printing',
        amountPaisa: 30_000,
      }),
      'bank-shop-1',
    ));
  });

  it('keeps an expense classification and requires an account as part of confirmation', () => {
    render(
      <ConfirmationModal
        result={parseEntry('PAPER - 2000')}
        accounts={accounts}
        categories={SEED_CATEGORIES}
        onConfirmSingle={vi.fn().mockResolvedValue(undefined)}
        onConfirmBatch={vi.fn()}
        onSkipToReview={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect((screen.getByLabelText('Transaction type') as HTMLSelectElement).value)
      .toBe('expense');
    expect((screen.getByLabelText('Payment account') as HTMLSelectElement).value)
      .toBe('cash-shop-1');
    expect((screen.getByRole('button', { name: 'Confirm & post' }) as HTMLButtonElement).disabled)
      .toBe(false);
  });

  it('blocks an ambiguous category until a classification and valid category are selected', () => {
    render(
      <ConfirmationModal
        result={parseEntry('GLUE 120')}
        accounts={accounts}
        categories={SEED_CATEGORIES}
        onConfirmSingle={vi.fn().mockResolvedValue(undefined)}
        onConfirmBatch={vi.fn()}
        onSkipToReview={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const confirm = screen.getByRole('button', { name: 'Confirm & post' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Income \(GLUE\)/ }));
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'cat-printing' },
    });
    expect(confirm.disabled).toBe(false);
  });

  it('does not allow a batch containing an invalid row to post', () => {
    const entries = parseMessage(
      'PRINT 300\nGLUE 120',
      [],
      new Date('2026-10-10T10:00:00+05:00'),
      SEED_CATEGORIES,
    ).entries;
    const onConfirmBatch = vi.fn().mockResolvedValue(undefined);
    render(
      <ConfirmationModal
        result={null}
        batchEntries={entries}
        accounts={accounts}
        categories={SEED_CATEGORIES}
        onConfirmSingle={vi.fn().mockResolvedValue(undefined)}
        onConfirmBatch={onConfirmBatch}
        onSkipToReview={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect((screen.getByRole('button', { name: 'Complete required fields' }) as HTMLButtonElement).disabled)
      .toBe(true);
    expect(onConfirmBatch).not.toHaveBeenCalled();
  });

  it('keeps a single failed batch row in the batch retry review', () => {
    const entry = parseEntry('PRINT 300');
    render(
      <ConfirmationModal
        result={null}
        batchEntries={[entry]}
        accounts={accounts}
        categories={SEED_CATEGORIES}
        onConfirmSingle={vi.fn().mockResolvedValue(undefined)}
        onConfirmBatch={vi.fn().mockResolvedValue(undefined)}
        onSkipToReview={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Review 1 entries together' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Review transaction' })).toBeNull();
  });
});
