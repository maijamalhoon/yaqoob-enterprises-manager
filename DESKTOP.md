# Yaqoob Enterprises Manager - Windows Desktop Application Guide

## 1. Overview & Desktop Paradigm

**Yaqoob Enterprises Manager** is packaged as a native Windows desktop executable using **Tauri 2** and **Rust**.

### Advantages Over Electron
- **Minimal Footprint:** Tauri uses the built-in Microsoft Edge WebView2 control already installed on Windows 10 and 11, resulting in an installer size of under ~15MB (compared to 150MB+ for Electron).
- **Sub-50MB Memory Usage:** Boots instantly and consumes less than 50MB of RAM during active cashier operations.
- **Hardware Direct Access:** Direct USB and COM port interfacing for receipt printers and serial barcode scanners via native Rust system calls.
- **Native Offline SQLite:** High-speed embedded database engine running directly on the host machine filesystem.

---

## 2. Desktop Shell Architecture (`src-tauri`)

```text
src-tauri/
├── Cargo.toml               # Rust package manifest & native dependencies
├── build.rs                 # Tauri native build hook
├── tauri.conf.json          # Desktop window, bundling, and NSIS installer specs
├── capabilities/
│   └── default.json         # Tauri 2 security permissions (core, sql, dialog)
├── icons/                   # Windows application icons (.ico, .png)
│   ├── icon.ico             # Multi-layer Windows desktop icon
│   ├── 32x32.png
│   ├── 128x128.png
│   ├── 128x128@2x.png
│   └── icon.png
└── src/
    ├── lib.rs               # Native IPC commands & hardware interfaces
    └── main.rs              # Desktop executable entry point
```

---

## 3. Native Rust IPC Commands (`src-tauri/src/lib.rs`)

The desktop frontend communicates with the Rust backend via Tauri's high-performance IPC bridge:

### `get_system_info`
Retrieves underlying OS metadata and hardware characteristics:
```rust
#[tauri::command]
fn get_system_info() -> Result<serde_json::Value, String>
```
Returns:
- `os`: `"Windows"`
- `arch`: `"x86_64"`
- `version`: Windows OS build string
- `hostname`: Machine name
- `app_version`: `"1.0.0"`

### `print_receipt_native`
Interfaces with physical 80mm or 58mm thermal receipt printers:
```rust
#[tauri::command]
fn print_receipt_native(receipt_data: String, printer_name: Option<String>) -> Result<bool, String>
```
Sends raw text or ESC/POS binary commands directly to the local Windows spooler or raw printer device without showing a browser print preview modal.

### `backup_database`
Generates a verified, timestamped archive of the local SQLite database to the user's chosen folder:
```rust
#[tauri::command]
fn backup_database(destination_path: String) -> Result<String, String>
```

### `restore_database`
Safely validates and writes a verified backup back to the local database file:
```rust
#[tauri::command]
fn restore_database(backup_path: String) -> Result<bool, String>
```

---

## 4. Hardware Interfacing: Printers & Scanners

### Thermal Receipt Printers (80mm / 58mm)
- **Standard Windows Driver Mode:** The application supports the standard Windows print subsystem (`window.print()`) with dedicated CSS thermal formatting (`@media print`) that suppresses headers, footers, and margins.
- **ESC/POS Native Mode:** Invoked through `print_receipt_native` for direct cutter actuation, cash drawer kick (pulse signal via RJ11 connector `27, 112, 0, 25, 250`), and rapid raw text printing.

### USB & Bluetooth Barcode Scanners
- Scanners configured in **HID Keyboard Emulation Mode** send rapid keystrokes followed by an `Enter` character (`\n` or `\r`).
- The POS search input captures scanned barcode/SKU strings automatically, selects the matched product or service, adds it to the cart, and resets the input field ready for the next scan.

---

## 5. Windows NSIS Installer Configuration (`tauri.conf.json`)

The desktop installer is generated using the **Nullsoft Scriptable Install System (NSIS)**:

```json
{
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "icon": ["icons/icon.ico", "icons/icon.png"],
    "windows": {
      "nsis": {
        "installMode": "perMachine",
        "languages": ["en-US"],
        "displayLanguageSelector": false
      }
    }
  }
}
```

### Key Installer Characteristics
- **`installMode: perMachine`:** Installs the software into `C:\Program Files\Yaqoob Enterprises Manager`, ensuring accessibility for all Windows user accounts (cashiers, store managers, administrators).
- **Desktop & Start Menu Shortcuts:** Automatically generated with high-resolution app icons.
- **Clean Uninstaller:** Fully uninstalls the executable and clears cached webview assets while offering to preserve the local SQLite database.

---

## 6. Building the Windows Installer

### Prerequisites
1. **Rust Toolchain:**
   Download and run `rustup-init.exe` from [rustup.rs](https://rustup.rs). Select default host architecture (`x86_64-pc-windows-msvc`).
2. **Visual Studio C++ Build Tools:**
   Ensure "Desktop development with C++" workload is installed with Windows 10/11 SDK.
3. **WebView2 Runtime:**
   Pre-installed on Windows 10 (version 1803+) and all Windows 11 systems.

### Build Command
```powershell
# 1. Compile web assets
npm run build

# 2. Package native Windows executable & NSIS setup installer
npm run tauri build
```

The compiled installer will be output to:
`src-tauri/target/release/bundle/nsis/Yaqoob Enterprises Manager_1.0.0_x64-setup.exe`

---

## 7. Troubleshooting & Diagnostics

### Application Logs
In desktop mode, local diagnostic logs are written to:
`%APPDATA%\com.yaqoobenterprises.manager\logs\`

### SQLite Database File Location
The embedded SQLite database file is located at:
`%APPDATA%\com.yaqoobenterprises.manager\yaqoob_manager.db`

To inspect the local database using SQLite CLI:
```powershell
sqlite3 "$env:APPDATA\com.yaqoobenterprises.manager\yaqoob_manager.db" ".tables"
```
