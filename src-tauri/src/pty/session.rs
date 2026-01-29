use anyhow::{Context, Result};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

pub struct PtySession {
    pub id: Uuid,
    reader: Arc<Mutex<Box<dyn std::io::Read + Send>>>,
    writer: Arc<Mutex<Box<dyn std::io::Write + Send>>>,
    cols: u16,
    rows: u16,
}

impl PtySession {
    pub fn new(
        shell: Option<String>,
        args: Option<Vec<String>>,
        cwd: Option<PathBuf>,
        cols: u16,
        rows: u16,
    ) -> Result<Self> {
        let pty_system = native_pty_system();

        let shell_path = shell
            .or_else(|| std::env::var("SHELL").ok())
            .unwrap_or_else(|| {
                #[cfg(target_os = "windows")]
                return "powershell.exe".to_string();
                #[cfg(not(target_os = "windows"))]
                return "/bin/bash".to_string();
            });

        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        let mut cmd = CommandBuilder::new(&shell_path);
        
        if let Some(args) = args {
            cmd.args(args);
        } else {
            // Run as login shell to source profile files
            #[cfg(target_os = "windows")]
            cmd.arg("-NoExit");
            #[cfg(not(target_os = "windows"))]
            cmd.arg("-l");
        }

        if let Some(dir) = cwd {
            cmd.cwd(dir);
        }

        let pair = pty_system
            .openpty(size)
            .context("Failed to open PTY")?;

        let _child = pair
            .slave
            .spawn_command(cmd)
            .context("Failed to spawn command")?;

        let reader = pair.master.try_clone_reader().context("Failed to clone reader")?;
        let writer = pair.master.take_writer().context("Failed to take writer")?;

        Ok(Self {
            id: Uuid::new_v4(),
            reader: Arc::new(Mutex::new(reader)),
            writer: Arc::new(Mutex::new(writer)),
            cols,
            rows,
        })
    }

    pub fn get_reader(&self) -> Arc<Mutex<Box<dyn std::io::Read + Send>>> {
        Arc::clone(&self.reader)
    }

    pub fn get_writer(&self) -> Arc<Mutex<Box<dyn std::io::Write + Send>>> {
        Arc::clone(&self.writer)
    }

    pub async fn resize(&mut self, cols: u16, rows: u16) -> Result<()> {
        self.cols = cols;
        self.rows = rows;
        Ok(())
    }

    pub async fn write(&mut self, data: &[u8]) -> Result<usize> {
        let writer = Arc::clone(&self.writer);
        let data = data.to_vec();
        
        let result = tokio::task::spawn_blocking(move || {
            let mut writer_guard = writer.blocking_lock();
            writer_guard.write(&data)
        })
        .await
        .context("Failed to spawn blocking write")?
        .context("Failed to write to PTY")?;
        
        Ok(result)
    }

    pub async fn read(&mut self, buf: &mut [u8]) -> Result<usize> {
        let reader = Arc::clone(&self.reader);
        let buf_len = buf.len();
        
        let result = tokio::task::spawn_blocking(move || {
            let mut reader_guard = reader.blocking_lock();
            let mut temp_buf = vec![0u8; buf_len];
            match reader_guard.read(&mut temp_buf) {
                Ok(n) if n > 0 => Some((n, temp_buf[..n].to_vec())),
                Ok(_) => None,
                Err(e) => {
                    eprintln!("PTY read error: {}", e);
                    None
                }
            }
        })
        .await
        .context("Failed to spawn blocking read")?;
        
        if let Some((n, data)) = result {
            buf[..n].copy_from_slice(&data);
            Ok(n)
        } else {
            Ok(0)
        }
    }

    pub fn try_clone_reader(&self) -> Result<Box<dyn std::io::Read + Send>> {
        Err(anyhow::anyhow!("Clone reader not supported"))
    }

    pub fn kill(&mut self) -> Result<()> {
        Ok(())
    }

    pub fn get_child_pid(&self) -> u32 {
        0
    }
}
