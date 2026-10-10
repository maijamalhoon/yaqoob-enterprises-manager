# Development Guide

## Prerequisites

- Node.js 18+ or 20+
- npm or bun

---

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables (Optional for cloud backend):**
   ```bash
   cp .env.example .env
   ```
   Add your Supabase configuration:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
   *Note:* If left blank, the application automatically operates using the built-in LocalStorage Engine.

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application runs on `http://localhost:3000`.

4. **Verify TypeScript & Linting:**
   ```bash
   npm run lint
   ```

5. **Build for Production:**
   ```bash
   npm run build
   ```

---

## Code Organization & Guidelines

- **New Views:** Add new views to `src/components/<domain>/` and register them inside `App.tsx` and `types/index.ts` under `AppView`.
- **Database Access:** Always route mutations and queries through the repository contracts in `src/services/contracts.ts` rather than querying drivers directly.
- **Financial Calculations:** Never perform raw arithmetic on financial amounts without wrapping results in `roundMoney(...)` from `src/lib/utils.ts`.
- **Ledger Entry:** Text entries use the shared review modal. Confirm amount, type, category/date, and an active account there; submit through `ledgerService` and its draft-posting RPC. Retain the Review Queue path for uncertain input and old drafts for recovery.
- **Theme & Styles:** `src/index.css` is authoritative. Use semantic surface, text, border, and state tokens so light and dark appearances remain coherent; the persisted preference key is `yaqoob-theme`.
- **Ledger Mutations:** Voids/restores/edits are online-only and use optimistic timestamps. Voids require a reason and derive actor attribution from the authenticated database context; database ledger triggers own account reversals.
- **Validation:** Run `npm run lint`, `npm run test`, and `npm run build` for changes to the application or its database contracts.
