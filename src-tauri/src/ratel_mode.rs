use anyhow::Result;

#[cfg(not(target_os = "windows"))]
use ratel_rust::RatelClient;

#[cfg(not(target_os = "windows"))]
pub fn run_ratel(addr: &str) -> Result<()> {
    // Run the real ratel client logic (includes auth handshake).
    // We are already inside a PTY, so stdin/stdout behave like a terminal.
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()?;

    rt.block_on(async {
        let mut client = RatelClient::new(addr.to_string(), None);
        client.start().await
    })
}

#[cfg(target_os = "windows")]
pub fn run_ratel(_addr: &str) -> Result<()> {
    anyhow::bail!("Ratel sessions are not supported on Windows")
}
