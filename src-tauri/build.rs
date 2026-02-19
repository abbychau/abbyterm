fn main() {
    // Set build timestamp environment variables
    let now = chrono::Local::now();
    println!("cargo:rustc-env=VERGEN_BUILD_TIMESTAMP={}", now.format("%Y-%m-%d %H:%M:%S"));
    println!("cargo:rustc-env=VERGEN_BUILD_DATE={}", now.format("%Y-%m-%d"));

    tauri_build::build()
}
