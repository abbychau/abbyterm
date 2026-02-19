#[tauri::command]
pub fn get_build_date() -> String {
    // The build timestamp will be set by the build script
    env!("VERGEN_BUILD_TIMESTAMP").to_string()
}

#[tauri::command]
pub fn get_build_date_short() -> String {
    // Return a shorter date format (YYYY-MM-DD)
    env!("VERGEN_BUILD_DATE").to_string()
}
