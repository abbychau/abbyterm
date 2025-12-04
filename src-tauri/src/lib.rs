mod commands;
mod pty;
mod ssh_config;

use commands::pty_commands::*;
use commands::ssh_commands::*;
use commands::window_commands::*;
use pty::manager::PtyManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(PtyManager::new())
        .setup(|_app| {
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Window commands
            window_minimize,
            window_maximize,
            window_unmaximize,
            window_close,
            is_maximized,
            // PTY commands
            create_pty_session,
            pty_write,
            pty_resize,
            pty_kill,
            // SSH commands
            get_ssh_hosts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
