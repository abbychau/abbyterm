use anyhow::{Context, Result};
use libc::{self, winsize};
use std::fs::File;
use std::io::{Read, Write};
use std::os::unix::io::{FromRawFd, RawFd};
use std::os::unix::process::CommandExt;
use std::process::{Child, Command};

pub struct UnixPty {
    pub master_fd: RawFd,
    pub master_file: File,
    pub child: Child,
}

impl UnixPty {
    pub fn new(
        shell: Option<String>,
        args: Option<Vec<String>>,
        cwd: Option<std::path::PathBuf>,
        cols: u16,
        rows: u16,
    ) -> Result<Self> {
        // Create PTY master
        let master_fd = unsafe { libc::posix_openpt(libc::O_RDWR | libc::O_NOCTTY) };
        if master_fd < 0 {
            return Err(anyhow::anyhow!("Failed to create PTY master"));
        }

        // Grant access to slave
        if unsafe { libc::grantpt(master_fd) } != 0 {
            unsafe { libc::close(master_fd) };
            return Err(anyhow::anyhow!("grantpt failed"));
        }

        // Unlock slave
        if unsafe { libc::unlockpt(master_fd) } != 0 {
            unsafe { libc::close(master_fd) };
            return Err(anyhow::anyhow!("unlockpt failed"));
        }

        // Get slave name
        let slave_name = unsafe {
            let name_ptr = libc::ptsname(master_fd);
            if name_ptr.is_null() {
                libc::close(master_fd);
                return Err(anyhow::anyhow!("ptsname failed"));
            }
            std::ffi::CStr::from_ptr(name_ptr)
                .to_string_lossy()
                .into_owned()
        };

        // Set window size
        let ws = winsize {
            ws_row: rows,
            ws_col: cols,
            ws_xpixel: 0,
            ws_ypixel: 0,
        };
        unsafe {
            libc::ioctl(master_fd, libc::TIOCSWINSZ, &ws as *const _);
        }

        // Set master to non-blocking
        unsafe {
            let flags = libc::fcntl(master_fd, libc::F_GETFL);
            libc::fcntl(master_fd, libc::F_SETFL, flags | libc::O_NONBLOCK);
        }

        // Spawn child process
        let shell_path = shell
            .or_else(|| std::env::var("SHELL").ok())
            .unwrap_or_else(|| "/bin/bash".to_string());

        let mut command = Command::new(&shell_path);
        if let Some(args) = args {
            command.args(args);
        }
        command.env("TERM", "xterm-256color");

        if let Some(dir) = cwd {
            command.current_dir(dir);
        }

        // Open slave for child
        let slave_fd = unsafe {
            let fd = libc::open(
                slave_name.as_ptr() as *const i8,
                libc::O_RDWR,
            );
            if fd < 0 {
                libc::close(master_fd);
                return Err(anyhow::anyhow!("Failed to open slave"));
            }
            fd
        };

        // Spawn child with slave as stdin/stdout/stderr
        unsafe {
            command.pre_exec(move || {
                // Create new session
                if libc::setsid() < 0 {
                    return Err(std::io::Error::last_os_error());
                }

                // Set controlling terminal
                if libc::ioctl(slave_fd, libc::TIOCSCTTY, 0) < 0 {
                    return Err(std::io::Error::last_os_error());
                }

                // Redirect stdin/stdout/stderr to slave
                libc::dup2(slave_fd, 0);
                libc::dup2(slave_fd, 1);
                libc::dup2(slave_fd, 2);

                // Close slave fd if it's not 0, 1, or 2
                if slave_fd > 2 {
                    libc::close(slave_fd);
                }

                Ok(())
            });
        }

        let child = command.spawn().context("Failed to spawn shell")?;

        // Close slave in parent
        unsafe {
            libc::close(slave_fd);
        }

        // Create File from master_fd for reading/writing
        let master_file = unsafe { File::from_raw_fd(master_fd) };

        Ok(UnixPty {
            master_fd,
            master_file,
            child,
        })
    }

    pub fn resize(&self, cols: u16, rows: u16) -> Result<()> {
        let ws = winsize {
            ws_row: rows,
            ws_col: cols,
            ws_xpixel: 0,
            ws_ypixel: 0,
        };
        unsafe {
            if libc::ioctl(self.master_fd, libc::TIOCSWINSZ, &ws as *const _) < 0 {
                return Err(anyhow::anyhow!("ioctl TIOCSWINSZ failed"));
            }
        }
        Ok(())
    }

    pub fn write(&mut self, data: &[u8]) -> Result<usize> {
        self.master_file
            .write(data)
            .context("Failed to write to PTY")
    }

    pub fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        self.master_file.read(buf)
    }

    pub fn try_clone_reader(&self) -> Result<File> {
        let new_fd = unsafe { libc::dup(self.master_fd) };
        if new_fd < 0 {
            return Err(anyhow::anyhow!("Failed to dup master fd"));
        }

        // Set the duplicated fd to non-blocking as well
        unsafe {
            let flags = libc::fcntl(new_fd, libc::F_GETFL);
            if flags < 0 || libc::fcntl(new_fd, libc::F_SETFL, flags | libc::O_NONBLOCK) < 0 {
                libc::close(new_fd);
                return Err(anyhow::anyhow!("Failed to set non-blocking mode on duplicated fd"));
            }
        }

        Ok(unsafe { File::from_raw_fd(new_fd) })
    }
}

impl Drop for UnixPty {
    fn drop(&mut self) {
        let _ = self.child.kill();
    }
}
