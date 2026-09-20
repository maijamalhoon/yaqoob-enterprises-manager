# Yaqoob Enterprises Manager - Release & Deployment Guide

## 1. Release Overview & Versioning

Yaqoob Enterprises Manager follows [Semantic Versioning 2.0.0](https://semver.org/):
- **Current Version:** `1.0.0`
- **Target OS:** Windows 10 & 11 (64-bit / x86_64)
- **Installer Format:** NSIS Standalone Executable (`Yaqoob Enterprises Manager_1.0.0_x64-setup.exe`)
- **Distribution Model:** Offline-ready single file installer

---

## 2. Pre-Release Verification Checklist

Before creating a production release binary, execute all automated validation gates:

### Gate 1: Type Checking & Lints
```powershell
cmd /c "npm run lint"
```
*Requirement:* Must pass with 0 errors and 0 warnings.

### Gate 2: Full Automated Unit Test Suite
```powershell
cmd /c "npm test"
```
*Requirement:* All 28 tests must pass 100% across:
- `wac.test.ts` (Weighted Average Costing & rounding)
- `rbac.test.ts` (Permission boundaries)
- `sync.test.ts` (SQLite queue & schema migrations)
- `accounts.test.ts` (Double-entry transfers & ledger segregation)
- `closing.test.ts` (Drawer reconciliation & difference calculation)
- `sales.test.ts` (Sale totals, recipe consumption, split payments, void restock)

### Gate 3: Web Assets Compilation
```powershell
cmd /c "npm run build"
```
*Requirement:* `dist/` directory successfully created with minified HTML, CSS, and JS bundles.

---

## 3. Building the Windows NSIS Desktop Installer

### Build Command
Run the Tauri production bundler:
```powershell
cmd /c "npm run tauri build"
```

### Build Artifacts Location
Upon completion, the installer and release binaries are generated in:
```text
src-tauri/target/release/
├── yaqoob-enterprises-manager.exe        # Standalone executable
└── bundle/
    └── nsis/
        └── Yaqoob Enterprises Manager_1.0.0_x64-setup.exe  # Standard Windows installer
```

---

## 4. Windows Installation & Smoke Testing

### Installation Verification Steps
1. Double-click `Yaqoob Enterprises Manager_1.0.0_x64-setup.exe`.
2. Follow the NSIS installation wizard (installs to `C:\Program Files\Yaqoob Enterprises Manager`).
3. Verify that the desktop shortcut with the high-resolution logo is placed on the Windows Desktop.
4. Verify that the application appears in the Windows Start Menu under "Yaqoob Enterprises Manager".

### Operational Smoke Test
1. Launch the application from the desktop shortcut.
2. Complete a test sale on the POS terminal with an A4 photocopy (verify paper inventory decreases by 1 sheet).
3. Record a petty cash expense (Rs. 100).
4. Perform an inter-account transfer from Cash Drawer to HBL Bank.
5. Open Reports & P&L and confirm revenue, expenses, and net profit reconcile.
6. Submit a daily cash closing with counted cash.
7. Disconnect Wi-Fi / Ethernet, make a sale, and verify local persistence and sync queue accumulation.
8. Reconnect Wi-Fi and verify background queue draining.

---

## 5. Code Signing (Optional for Enterprise Distribution)

For commercial distribution without the Windows SmartScreen warning, sign the executable and installer with an Authenticode digital certificate:

```powershell
signtool sign /f "path\to\certificate.pfx" /p "your-password" /tr "http://timestamp.digicert.com" /td sha256 /fd sha256 "src-tauri\target\release\bundle\nsis\Yaqoob Enterprises Manager_1.0.0_x64-setup.exe"
```
