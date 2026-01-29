use super::session::PtySession;
use anyhow::Result;
use std::collections::HashMap;
use std::io::Read;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use uuid::Uuid;

pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<Uuid, PtySession>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn create_session(
        &self,
        shell: Option<String>,
        args: Option<Vec<String>>,
        cwd: Option<PathBuf>,
        cols: u16,
        rows: u16,
        app: AppHandle,
    ) -> Result<Uuid> {
        let session = PtySession::new(shell, args, cwd, cols, rows)?;
        let id = session.id;
        let reader = session.get_reader();

        self.sessions.lock().await.insert(id, session);
        
        // Start output reading task using spawn_blocking for the blocking read
        let event_name = format!("pty-output-{}", id);
        let exit_event = format!("pty-exit-{}", id);
        
        tokio::spawn(async move {
            loop {
                let reader_clone = Arc::clone(&reader);
                let event_name_clone = event_name.clone();
                let exit_event_clone = exit_event.clone();
                let app_clone = app.clone();

                // Run the blocking read in a thread pool
                let result = tokio::task::spawn_blocking(move || {
                    let mut buf = vec![0u8; 8192];
                    match reader_clone.blocking_lock().read(&mut buf) {
                        Ok(n) if n > 0 => Some((true, buf[..n].to_vec())),
                        Ok(_) => None,
                        Err(e) => {
                            eprintln!("PTY read error: {}", e);
                            None
                        }
                    }
                })
                .await;

                match result {
                    Ok(Some((true, data))) => {
                        let data_str = String::from_utf8_lossy(&data).to_string();
                        let _ = app_clone.emit(&event_name_clone, data_str);
                    }
                    Ok(Some((false, _))) | Ok(None) => {
                        let _ = app_clone.emit(&exit_event_clone, ());
                        break;
                    }
                    Err(e) => {
                        eprintln!("PTY spawn_blocking error: {}", e);
                        let _ = app_clone.emit(&exit_event_clone, ());
                        break;
                    }
                }
            }
        });

        Ok(id)
    }

    pub async fn write(&self, id: Uuid, data: &[u8]) -> Result<()> {
        let mut sessions = self.sessions.lock().await;
        if let Some(session) = sessions.get_mut(&id) {
            session.write(data).await?;
        }
        Ok(())
    }

    pub async fn resize(&self, id: Uuid, cols: u16, rows: u16) -> Result<()> {
        let mut sessions = self.sessions.lock().await;
        if let Some(session) = sessions.get_mut(&id) {
            session.resize(cols, rows).await?;
        }
        Ok(())
    }

    pub async fn kill(&self, id: Uuid) -> Result<()> {
        let mut sessions = self.sessions.lock().await;
        if let Some(mut session) = sessions.remove(&id) {
            let _ = session.kill();
        }
        Ok(())
    }

    pub async fn get_cwd(&self, id: Uuid) -> Result<String> {
        let sessions = self.sessions.lock().await;
        if let Some(_session) = sessions.get(&id) {
            Ok(std::env::current_dir()?.to_string_lossy().to_string())
        } else {
            Err(anyhow::anyhow!("Session not found"))
        }
    }
}

impl Default for PtyManager {
    fn default() -> Self {
        Self::new()
    }
}
