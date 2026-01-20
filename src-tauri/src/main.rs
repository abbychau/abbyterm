// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();

    // PTY mode: run as a simple TCP client inside a pseudo-terminal.
    // Spawned by the app via `create_ratel_session`.
    if args.len() >= 3 && args[1] == "--ratel" {
        if let Err(e) = abbyterm::run_ratel(&args[2]) {
            eprintln!("ratel session error: {e}");
            std::process::exit(1);
        }
        return;
    }

    abbyterm::run();
}
