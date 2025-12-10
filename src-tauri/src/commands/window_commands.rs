use tauri::Window;
static IS_MAXIMIZED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[tauri::command]
pub async fn window_minimize(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn window_maximize(window: Window) -> Result<(), String> {
    IS_MAXIMIZED.store(true, std::sync::atomic::Ordering::Relaxed);
    window.maximize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn window_unmaximize(window: Window) -> Result<(), String> {
    IS_MAXIMIZED.store(false, std::sync::atomic::Ordering::Relaxed);
    window.unmaximize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn window_close(window: Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn is_maximized(window: Window) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        return Ok(IS_MAXIMIZED.load(std::sync::atomic::Ordering::Relaxed));
    }
    
    #[cfg(not(target_os = "macos"))]
    window.is_maximized().map_err(|e| e.to_string())
}
