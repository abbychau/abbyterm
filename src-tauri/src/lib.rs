mod commands;
mod pty;
mod ssh_config;
mod ratel_mode;

use commands::pty_commands::*;
use commands::ssh_commands::*;
use commands::window_commands::*;
use commands::shell_commands::*;
use commands::container_commands::*;
use pty::manager::PtyManager;
use std::sync::Mutex;
use tauri::State;

pub use ratel_mode::run_ratel;

struct InitialCliArgs {
    args: Mutex<Option<Vec<String>>>,
}

#[tauri::command]
fn get_initial_args(state: State<'_, InitialCliArgs>) -> Option<Vec<String>> {
    state.args.lock().unwrap().clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    let mut initial_args = None;
    
    if let Some(index) = args.iter().position(|arg| arg == "-e") {
        if index + 1 < args.len() {
             initial_args = Some(args[index+1..].to_vec());
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(PtyManager::new())
        .manage(InitialCliArgs { args: Mutex::new(initial_args) })
        .setup(|_app| {
            // linux
            
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
            create_ratel_session,
            pty_write,
            pty_resize,
            pty_kill,
            get_session_cwd,
            // SSH commands
            get_ssh_hosts,
            // Shell commands
            get_available_shells,
            // Container commands
            get_docker_containers,
            get_kubernetes_pods,
            check_kubectl_available,
            check_docker_available,
            // CLI args
            get_initial_args,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
