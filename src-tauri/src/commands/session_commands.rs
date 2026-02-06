use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum PaneSnapshot {
    #[serde(rename = "terminal")]
    Terminal {
        id: String,
        title: String,
        tab_type: String,
        cwd: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        session_id: Option<String>,
    },
    #[serde(rename = "split")]
    Split {
        id: String,
        direction: String,
        children: Vec<PaneSnapshot>,
        #[serde(skip_serializing_if = "Option::is_none")]
        sizes: Option<Vec<f64>>,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TabSnapshot {
    pub id: String,
    pub title: String,
    pub type_: String,
    pub session_id: String,
    pub root_pane: PaneSnapshot,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionSnapshot {
    pub name: String,
    pub created_at: String,
    pub tabs: Vec<TabSnapshot>,
}

fn get_sessions_dir() -> Result<PathBuf, String> {
    let config_dir = env::var("HOME")
        .map(PathBuf::from)
        .or_else(|_| env::var("XDG_CONFIG_HOME").map(PathBuf::from))
        .map_err(|_| "Could not find home directory".to_string())?;

    let sessions_dir = config_dir.join(".abbyterm").join("sessions");
    fs::create_dir_all(&sessions_dir)
        .map_err(|e| format!("Failed to create sessions directory: {}", e))?;

    Ok(sessions_dir)
}

#[tauri::command]
pub async fn save_session_snapshot(
    snapshot: SessionSnapshot,
) -> Result<(), String> {
    let sessions_dir = get_sessions_dir()?;
    let file_path = sessions_dir.join(format!("{}.json", sanitize_filename(&snapshot.name)));

    let json = serde_json::to_string_pretty(&snapshot)
        .map_err(|e| format!("Failed to serialize session: {}", e))?;

    fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write session file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_session_snapshots() -> Result<Vec<SessionSnapshot>, String> {
    let sessions_dir = get_sessions_dir()?;
    let mut snapshots = Vec::new();

    let entries = fs::read_dir(&sessions_dir)
        .map_err(|e| format!("Failed to read sessions directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.extension().map_or(false, |ext| ext == "json") {
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read session file: {}", e))?;

            let snapshot: SessionSnapshot = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse session file: {}", e))?;

            snapshots.push(snapshot);
        }
    }

    // Sort by creation date (newest first)
    snapshots.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(snapshots)
}

#[tauri::command]
pub async fn delete_session_snapshot(
    name: String,
) -> Result<(), String> {
    let sessions_dir = get_sessions_dir()?;
    let file_path = sessions_dir.join(format!("{}.json", sanitize_filename(&name)));

    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete session file: {}", e))?;

    Ok(())
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect()
}
