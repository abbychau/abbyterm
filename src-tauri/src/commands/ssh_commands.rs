use crate::ssh_config::{parse_ssh_config, SshHost};

#[tauri::command]
pub fn get_ssh_hosts() -> Result<Vec<SshHost>, String> {
    parse_ssh_config().map_err(|e| e.to_string())
}
