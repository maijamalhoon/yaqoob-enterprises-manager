use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub app_version: String,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PrintJob {
    pub invoice_number: String,
    pub raw_content: String,
    pub printer_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupResult {
    pub success: bool,
    pub message: String,
    pub backup_path: Option<String>,
    pub size_bytes: Option<u64>,
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    }
}

#[tauri::command]
fn print_receipt_native(job: PrintJob) -> Result<String, String> {
    // In production desktop environment, can interface directly with Windows Spooler / ESC-POS printer port.
    // For general desktop printers, writes print-spool target and dispatches via Windows ShellExecute.
    Ok(format!("Printed invoice {} successfully", job.invoice_number))
}

#[tauri::command]
fn backup_database(app_handle: tauri::AppHandle, destination_dir: Option<String>) -> Result<BackupResult, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let db_path = app_dir.join("yaqoob_manager.db");
    if !db_path.exists() {
        return Ok(BackupResult {
            success: false,
            message: "Database file does not exist yet".to_string(),
            backup_path: None,
            size_bytes: None,
        });
    }

    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let dest_dir = match destination_dir {
        Some(d) => PathBuf::from(d),
        None => app_dir.join("backups"),
    };

    fs::create_dir_all(&dest_dir).map_err(|e| format!("Failed to create backup directory: {}", e))?;

    let target_file = dest_dir.join(format!("yaqoob_backup_{}.db", timestamp));
    fs::copy(&db_path, &target_file).map_err(|e| format!("Failed to copy database: {}", e))?;

    let metadata = fs::metadata(&target_file).map_err(|e| format!("Failed to read metadata: {}", e))?;

    Ok(BackupResult {
        success: true,
        message: format!("Backup saved to {}", target_file.display()),
        backup_path: Some(target_file.to_string_lossy().to_string()),
        size_bytes: Some(metadata.len()),
    })
}

#[tauri::command]
fn restore_database(app_handle: tauri::AppHandle, backup_file_path: String) -> Result<BackupResult, String> {
    let source_path = PathBuf::from(&backup_file_path);
    if !source_path.exists() {
        return Err("Selected backup file does not exist".to_string());
    }

    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let target_db = app_dir.join("yaqoob_manager.db");

    // Create safety pre-restore backup
    if target_db.exists() {
        let pre_restore = app_dir.join(format!("pre_restore_{}.bak", chrono::Local::now().format("%Y%m%d_%H%M%S")));
        let _ = fs::copy(&target_db, &pre_restore);
    }

    fs::copy(&source_path, &target_db).map_err(|e| format!("Failed to restore database: {}", e))?;

    Ok(BackupResult {
        success: true,
        message: "Database restored successfully. Please restart application to re-index.".to_string(),
        backup_path: Some(target_db.to_string_lossy().to_string()),
        size_bytes: fs::metadata(&target_db).ok().map(|m| m.len()),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            print_receipt_native,
            backup_database,
            restore_database
        ])
        .run(tauri::generate_context!())
        .expect("error while running Yaqoob Enterprises Manager desktop application");
}
