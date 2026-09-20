import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';
import { setSecurityPrincipal } from '../src/lib/security';

// In-memory mock localStorage if jsdom doesn't fully retain or needs isolation
class LocalStorageMock {
  private store: Record<string, string> = {};

  clear() {
    this.store = {};
  }

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }
}

if (typeof window !== 'undefined') {
  if (!window.localStorage || typeof window.localStorage.getItem !== 'function') {
    Object.defineProperty(window, 'localStorage', {
      value: new LocalStorageMock(),
      writable: true,
    });
  }

  // Mock URL.createObjectURL and revokeObjectURL
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  }
  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = vi.fn();
  }
}

beforeEach(() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
  setSecurityPrincipal({
    id: 'test-owner',
    email: 'test-owner@example.com',
    full_name: 'Test Owner',
    role: 'OWNER',
    organization_id: 'org-yaqoob-001',
    is_active: true,
    created_at: new Date().toISOString(),
  });
});
