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
- **Theme & Styles:** The design uses a deep navy foundation (`bg-slate-950`, `bg-slate-900`, `border-slate-800`) paired with cyan (`#06b6d4`), teal, and amber accents.
