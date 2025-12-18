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
        args: Option<Vec<String>>,
        cwd: Option<PathBuf>,
        cols: u16,
        rows: u16,
        app: AppHandle,
    ) -> Result<Uuid> {
        let session = PtySession::new(shell, args, cwd, cols, rows)?;
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

    pub async fn get_cwd(&self, id: Uuid) -> Result<String> {
        let sessions = self.sessions.lock().await;
        if let Some(session) = sessions.get(&id) {
            let pid = session.get_child_pid();
            //eprintln!("Getting cwd for PID: {}", pid);
            let result = get_process_cwd(pid as i32);
            // match &result {
            //     Ok(cwd) => eprintln!("Got cwd: {}", cwd),
            //     Err(e) => eprintln!("Error getting cwd: {}", e),
            // }
            result
        } else {
            Err(anyhow::anyhow!("Session not found"))
        }
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
                // Use poll to wait for data to be available
                let mut pollfd = libc::pollfd {
                    fd,
                    events: libc::POLLIN,
                    revents: 0,
                };

                let poll_result = unsafe {
                    libc::poll(&mut pollfd as *mut libc::pollfd, 1, -1)
                };

                if poll_result < 0 {
                    let errno = unsafe {
                        #[cfg(target_os = "linux")]
                        { *libc::__errno_location() }
                        #[cfg(target_os = "macos")]
                        { *libc::__error() }
                    };
                    if errno == libc::EINTR {
                        // Interrupted by signal, retry
                        continue;
                    } else {
                        eprintln!("Error polling PTY: errno {}", errno);
                        break;
                    }
                }

                if poll_result == 0 {
                    // Timeout (shouldn't happen with -1 timeout)
                    continue;
                }

                // Check if there's data to read or if fd was closed
                if pollfd.revents & libc::POLLIN != 0 {
                    // Data available, read it
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
                        let errno = unsafe {
                            #[cfg(target_os = "linux")]
                            { *libc::__errno_location() }
                            #[cfg(target_os = "macos")]
                            { *libc::__error() }
                        };
                        if errno == libc::EAGAIN || errno == libc::EWOULDBLOCK {
                            // Should not happen after successful poll, but continue anyway
                            continue;
                        } else {
                            eprintln!("Error reading from PTY: errno {}", errno);
                            break;
                        }
                    }
                }

                if pollfd.revents & (libc::POLLHUP | libc::POLLERR) != 0 {
                    // PTY closed or error
                    break;
                }
            }

            // Close the fd
            unsafe { libc::close(fd) };

            // Emit process exit event
            let _ = app.emit(&format!("pty-exit-{}", id), ());
        });
    }
}

#[cfg(target_os = "macos")]
fn get_process_cwd(pid: i32) -> Result<String> {
    use std::process::Command;

    // Use lsof to get the current working directory
    let output = Command::new("lsof")
        .args(&["-p", &pid.to_string(), "-a", "-d", "cwd", "-Fn"])
        .output()
        .map_err(|e| anyhow::anyhow!("Failed to run lsof: {}", e))?;

    if !output.status.success() {
        return Err(anyhow::anyhow!("lsof command failed"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse lsof output - format is:
    // p<pid>
    // n<path>
    for line in stdout.lines() {
        if line.starts_with('n') {
            let path = &line[1..]; // Skip the 'n' prefix
            return Ok(path.to_string());
        }
    }

    Err(anyhow::anyhow!("Could not find cwd in lsof output"))
}

#[cfg(target_os = "linux")]
fn get_process_cwd(pid: i32) -> Result<String> {
    let cwd_path = format!("/proc/{}/cwd", pid);
    std::fs::read_link(&cwd_path)
        .map(|p| p.display().to_string())
        .map_err(|e| anyhow::anyhow!("Failed to read /proc/{}/cwd: {}", pid, e))
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn get_process_cwd(_pid: i32) -> Result<String> {
    Err(anyhow::anyhow!("Getting process CWD is not supported on this platform"))
}

impl Default for PtyManager {
    fn default() -> Self {
        Self::new()
    }
}
