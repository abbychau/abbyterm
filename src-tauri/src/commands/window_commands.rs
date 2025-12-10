use tauri::Window;

#[tauri::command]
pub async fn window_minimize(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn window_maximize(window: Window) -> Result<(), String> {
    window.maximize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn window_unmaximize(window: Window) -> Result<(), String> {
    window.unmaximize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn window_close(window: Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn is_maximized(window: Window) -> Result<bool, String> {
    // if macOS, always return false as macOS does not have maximized state
    #[cfg(target_os = "macos")]
    {
        return Ok(false);
    }
    window.is_maximized().map_err(|e| e.to_string())
}
