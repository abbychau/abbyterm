use super::session::PtySession;
use anyhow::Result;
use std::collections::HashMap;
use std::os::unix::io::AsRawFd;
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
        cwd: Option<PathBuf>,
        cols: u16,
        rows: u16,
        app: AppHandle,
    ) -> Result<Uuid> {
        let session = PtySession::new(shell, cwd, cols, rows)?;
        let id = session.id;

        // Get the raw fd for direct reading
        let reader = session.try_clone_reader()?;
        let fd = reader.as_raw_fd();

        self.sessions.lock().await.insert(id, session);

        // Start output task with the raw fd
        // We need to forget the File to prevent it from closing the fd
        std::mem::forget(reader);
        self.start_output_task(id, fd, app);

        Ok(id)
    }

    pub async fn write(&self, id: Uuid, data: &[u8]) -> Result<()> {
        let mut sessions = self.sessions.lock().await;
        if let Some(session) = sessions.get_mut(&id) {
            session.write(data)?;
        }
        Ok(())
    }

    pub async fn resize(&self, id: Uuid, cols: u16, rows: u16) -> Result<()> {
        let mut sessions = self.sessions.lock().await;
        if let Some(session) = sessions.get_mut(&id) {
            session.resize(cols, rows)?;
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

    fn start_output_task(
        &self,
        id: Uuid,
        fd: std::os::unix::io::RawFd,
        app: AppHandle,
    ) {
        std::thread::spawn(move || {
            let mut buf = [0u8; 8192];
            let event_name = format!("pty-output-{}", id);

            loop {
                // Use direct libc::read instead of File::read
                let n = unsafe {
                    libc::read(fd, buf.as_mut_ptr() as *mut libc::c_void, buf.len())
                };

                if n > 0 {
                    let data = String::from_utf8_lossy(&buf[..(n as usize)]).to_string();
                    let _ = app.emit(&event_name, data);
                } else if n == 0 {
                    // EOF - process exited
                    break;
                } else {
                    // n < 0: error occurred
                    let errno = unsafe { *libc::__errno_location() };
                    if errno == libc::EAGAIN || errno == libc::EWOULDBLOCK {
                        // No data available, sleep briefly
                        std::thread::sleep(std::time::Duration::from_millis(10));
                        continue;
                    } else {
                        eprintln!("Error reading from PTY: errno {}", errno);
                        break;
                    }
                }
            }

            // Close the fd
            unsafe { libc::close(fd) };

            // Emit process exit event
            let _ = app.emit(&format!("pty-exit-{}", id), ());
        });
    }
}

impl Default for PtyManager {
    fn default() -> Self {
        Self::new()
    }
}
