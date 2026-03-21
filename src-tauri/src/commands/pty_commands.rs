use crate::pty::manager::PtyManager;
use serde::Serialize;
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, State};
use uuid::Uuid;

#[derive(Serialize)]
pub struct ZmodemUploadFile {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub last_modified_ms: u64,
}

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
    // Expand tilde in cwd path
    let cwd_path = cwd.map(|path| {
        if path.starts_with("~/") || path == "~" {
            let home = std::env::var("HOME").unwrap_or_else(|_| "/".to_string());
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
pub async fn pty_write_bytes(
    session_id: String,
    data: Vec<u8>,
    manager: State<'_, PtyManager>,
) -> Result<(), String> {
    let id = Uuid::parse_str(&session_id).map_err(|e| e.to_string())?;
    manager.write(id, &data).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pty_resize(
    session_id: String,
    cols: u16,
    rows: u16,
    manager: State<'_, PtyManager>,
) -> Result<(), String> {
    let id = Uuid::parse_str(&session_id).map_err(|e| e.to_string())?;
    manager
        .resize(id, cols, rows)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pty_kill(session_id: String, manager: State<'_, PtyManager>) -> Result<(), String> {
    let id = Uuid::parse_str(&session_id).map_err(|e| e.to_string())?;
    manager.kill(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_session_cwd(
    session_id: String,
    manager: State<'_, PtyManager>,
) -> Result<String, String> {
    let id = Uuid::parse_str(&session_id).map_err(|e| e.to_string())?;
    manager.get_cwd(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn prepare_zmodem_upload_files(
    paths: Vec<String>,
) -> Result<Vec<ZmodemUploadFile>, String> {
    tokio::task::spawn_blocking(move || {
        let mut files = Vec::new();

        for path in paths {
            let path_buf = std::path::PathBuf::from(&path);
            let metadata = std::fs::metadata(&path_buf)
                .map_err(|e| format!("Failed to read metadata for {}: {}", path, e))?;

            if !metadata.is_file() {
                return Err(format!("Not a regular file: {}", path));
            }

            let name = path_buf
                .file_name()
                .and_then(|s| s.to_str())
                .ok_or_else(|| format!("Failed to determine filename for {}", path))?
                .to_string();

            let size = metadata.len();

            let last_modified_ms = metadata
                .modified()
                .ok()
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
                .unwrap_or(0);

            files.push(ZmodemUploadFile {
                name,
                path,
                size,
                last_modified_ms,
            });
        }

        Ok(files)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn read_zmodem_upload_chunk(
    path: String,
    offset: u64,
    max_len: usize,
) -> Result<Vec<u8>, String> {
    tokio::task::spawn_blocking(move || {
        use std::io::{Read, Seek, SeekFrom};

        let path_buf = std::path::PathBuf::from(&path);
        let metadata = std::fs::metadata(&path_buf)
            .map_err(|e| format!("Failed to read metadata for {}: {}", path, e))?;
        if !metadata.is_file() {
            return Err(format!("Not a regular file: {}", path));
        }

        let file_len = metadata.len();
        if offset >= file_len {
            return Ok(Vec::new());
        }

        let safe_max_len = max_len.clamp(1, 1024 * 1024);
        let remaining = (file_len - offset) as usize;
        let to_read = safe_max_len.min(remaining);

        let mut file = std::fs::File::open(&path_buf)
            .map_err(|e| format!("Failed to open file {}: {}", path, e))?;
        file.seek(SeekFrom::Start(offset))
            .map_err(|e| format!("Failed to seek file {}: {}", path, e))?;

        let mut buf = vec![0u8; to_read];
        file.read_exact(&mut buf)
            .map_err(|e| format!("Failed to read file {}: {}", path, e))?;
        Ok(buf)
    })
    .await
    .map_err(|e| e.to_string())?
}
