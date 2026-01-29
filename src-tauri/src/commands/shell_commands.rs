use std::fs;
use std::io::{self, BufRead};
use std::path::Path;

#[tauri::command]
pub fn get_available_shells() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        // On Windows, return PowerShell and cmd
        return Ok(vec![
            "powershell.exe".to_string(),
            "pwsh.exe".to_string(),
            "cmd.exe".to_string(),
        ]);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let path = Path::new("/etc/shells");
        if !path.exists() {
            return Ok(vec!["/bin/bash".to_string(), "/bin/sh".to_string()]);
        }

        let file = fs::File::open(path).map_err(|e| e.to_string())?;
        let reader = io::BufReader::new(file);

        let shells: Vec<String> = reader
            .lines()
            .filter_map(|line| line.ok())
            .map(|line| line.trim().to_string())
            .filter(|line| !line.is_empty() && !line.starts_with('#'))
            .collect();

        Ok(shells)
    }
}
