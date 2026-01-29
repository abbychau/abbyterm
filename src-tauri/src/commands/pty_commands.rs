use crate::pty::manager::PtyManager;
use tauri::{AppHandle, State};
use uuid::Uuid;

#[cfg(unix)]
#[tauri::command]
pub async fn create_ratel_session(
    host: String,
    port: u16,
    cols: u16,
    rows: u16,
    manager: State<'_, PtyManager>,
    app: AppHandle,
) -> Result<String, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe = exe.to_string_lossy().to_string();

    let addr = format!("{}:{}", host.trim(), port);
    let args = vec!["--ratel".to_string(), addr];

    let id = manager
        .create_session(Some(exe), Some(args), None, cols, rows, app)
        .await
        .map_err(|e| e.to_string())?;

    Ok(id.to_string())
}

#[tauri::command]
pub async fn create_pty_session(
    shell: Option<String>,
    args: Option<Vec<String>>,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
    manager: State<'_, PtyManager>,
    app: AppHandle,
) -> Result<String, String> {
    let cwd_path = cwd.map(|path| {
        if path.starts_with("~/") || path == "~" {
            let home = std::env::var("HOME").unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_else(|_| "/".to_string()));
            let expanded = if path == "~" {
                home
            } else {
                path.replacen("~", &home, 1)
            };
            std::path::PathBuf::from(expanded)
        } else {
            std::path::PathBuf::from(path)
        }
    });
    let id = manager
        .create_session(shell, args, cwd_path, cols, rows, app)
        .await
        .map_err(|e| e.to_string())?;
    Ok(id.to_string())
}

#[tauri::command]
pub async fn pty_write(
    session_id: String,
    data: String,
    manager: State<'_, PtyManager>,
) -> Result<(), String> {
    let id = Uuid::parse_str(&session_id).map_err(|e| e.to_string())?;
    manager
        .write(id, data.as_bytes())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pty_resize(
    session_id: String,
    cols: u16,
    rows: u16,
    manager: State<'_, PtyManager>,
) -> Result<(), String> {
    let id = Uuid::parse_str(&session_id).map_err(|e| e.to_string())?;
    manager.resize(id, cols, rows).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pty_kill(session_id: String, manager: State<'_, PtyManager>) -> Result<(), String> {
    let id = Uuid::parse_str(&session_id).map_err(|e| e.to_string())?;
    manager.kill(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_session_cwd(session_id: String, manager: State<'_, PtyManager>) -> Result<String, String> {
    let id = Uuid::parse_str(&session_id).map_err(|e| e.to_string())?;
    manager.get_cwd(id).await.map_err(|e| e.to_string())
}
