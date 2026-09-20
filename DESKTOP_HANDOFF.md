# Desktop Handoff: Tauri 2 Migration Roadmap

## Executive Overview

**Yaqoob Enterprises Manager** was engineered to compile cleanly into a cross-platform Windows desktop binary via **Tauri 2**. The design uses the Repository Pattern with strict interfaces in `src/services/contracts.ts`.

Migrating to Tauri 2 requires **zero rewrites** of the user interface, state management, or business logic.

---

## 1. Tauri 2 Project Initialization

In the project root, initialize Tauri:
```bash
npm install -D @tauri-apps/cli@latest
npx tauri init
```

Recommended configuration in `src-tauri/tauri.conf.json`:
```json
{
  "productName": "Yaqoob Enterprises Manager",
  "version": "1.0.0",
  "identifier": "com.yaqoobenterprises.pos",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:3000",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Yaqoob Enterprises Manager",
        "width": 1280,
        "height": 800,
        "minWidth": 1024,
        "minHeight": 700,
        "fullscreen": false,
        "resizable": true
      }
    ]
  }
}
```

---

## 2. Decoupled Persistence Adapter

Currently, `src/services/index.ts` delegates to `StorageEngine`. When Tauri is detected (`window.__TAURI_INTERNALS__ !== undefined`), an embedded SQLite repository implementation can be mounted:

```text
[ React UI Components ]
         │
         ▼
[ contracts.ts Interfaces (e.g. ISalesRepository) ]
         │
    ┌────┴─────────────────────────────┐
    │                                  │
    ▼ (Web Mode)                       ▼ (Tauri 2 Mode)
[ StorageEngine / Supabase ]    [ Tauri IPC -> Rust SQLite ]
```

### Example Tauri IPC Bridge
```typescript
// src/services/tauriBridge.ts
import { invoke } from '@tauri-apps/api/core';
import { ISalesRepository } from './contracts';
import { Sale } from '../types';

export class TauriSalesRepository implements ISalesRepository {
  async getSales(organizationId: string): Promise<Sale[]> {
    return await invoke('get_sales', { organizationId });
  }

  async createSale(organizationId: string, payload: any): Promise<Sale> {
    return await invoke('create_sale', { organizationId, payload });
  }

  async voidSale(organizationId: string, saleId: string, userId: string, userName: string, reason: string): Promise<Sale> {
    return await invoke('void_sale', { organizationId, saleId, userId, userName, reason });
  }
}
```

---

## 3. Native Windows Capabilities

When running within Tauri 2, the following native capabilities can be enabled without third-party browser constraints:

1. **Silent Thermal Printing:** Direct ESC/POS printing to 80mm USB and network receipt printers (e.g. Xprinter, Epson) via native Rust USB sockets, bypassing the standard browser print dialog.
2. **Cash Drawer Kick:** Sending raw hex pulses (`ESC p m t1 t2` or `0x1B 0x70 0x00 0x19 0xFA`) through the RJ11 printer port upon successful sale completion.
3. **Local SQLite Engine:** Fully offline database stored in `%APPDATA%/YaqoobEnterprises/data.db` with WAL mode enabled for rapid checkout under peak shop volume.
4. **USB Barcode Scanner Support:** Raw HID event listening to prevent lost keypresses when scanning rapidly into the cart.
