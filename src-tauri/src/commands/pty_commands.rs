use crate::pty::manager::PtyManager;
use tauri::{AppHandle, State};
use uuid::Uuid;

#[tauri::command]
pub async fn create_pty_session(
    shell: Option<String>,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
    manager: State<'_, PtyManager>,
    app: AppHandle,
) -> Result<String, String> {
    let cwd_path = cwd.map(std::path::PathBuf::from);
    let id = manager
        .create_session(shell, cwd_path, cols, rows, app)
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
