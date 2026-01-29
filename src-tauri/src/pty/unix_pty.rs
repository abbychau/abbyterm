use anyhow::{Context, Result};
use libc::{self, winsize};
use std::fs::File;
use std::io::Write;
use std::os::unix::io::{FromRawFd, RawFd};
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};

fn terminfo_entry_exists(term: &str) -> bool {
    let first = term.chars().next().unwrap_or('x');
    let subdir = if first.is_ascii_alphanumeric() {
        first.to_ascii_lowercase().to_string()
    } else {
        format!("{:x}", first as u32)
    };

    let mut search_dirs: Vec<PathBuf> = Vec::new();

    if let Ok(dir) = std::env::var("TERMINFO") {
        if !dir.trim().is_empty() {
            search_dirs.push(PathBuf::from(dir));
        }
    }

    if let Ok(dirs) = std::env::var("TERMINFO_DIRS") {
        for part in dirs.split(':') {
            let trimmed = part.trim();
            if trimmed.is_empty() {
                continue;
            }
            search_dirs.push(PathBuf::from(trimmed));
        }
    }

    // Common system terminfo locations.
    search_dirs.push(PathBuf::from("/usr/share/terminfo"));
    search_dirs.push(PathBuf::from("/lib/terminfo"));
    search_dirs.push(PathBuf::from("/etc/terminfo"));
    search_dirs.push(PathBuf::from("/usr/share/lib/terminfo"));

    let rel_path = Path::new(&subdir).join(term);
    search_dirs.into_iter().any(|dir| dir.join(&rel_path).exists())
}

fn choose_term() -> &'static str {
    if terminfo_entry_exists("xterm-256color") {
        return "xterm-256color";
    }
    if terminfo_entry_exists("xterm") {
        return "xterm";
    }
    // Broadly available fallback that still provides sane cursor-key behavior.
    "ansi"
}

pub struct UnixPty {
    pub master_fd: RawFd,
    pub master_file: File,
    pub child: Child,
}

// UnixPty implementation for managing pseudo-terminals on Unix-like systems.
//
// This implementation handles the lifecycle of a PTY pair (master/slave) and the associated
// child process (shell).
//
// Key concepts:
// - **Master PTY**: The side held by this application. We write input to it (which the shell receives) and read output from it (which the shell produced).
// - **Slave PTY**: The side given to the child process. It acts as the child's stdin, stdout, and stderr.
// - **Session & Controlling Terminal**: The child process is placed in a new session (`setsid`) and the slave PTY is set as its controlling terminal (`TIOCSCTTY`). This ensures signals like Ctrl+C are handled correctly.
// - **Non-blocking I/O**: The master FD is set to non-blocking mode to allow asynchronous reading.
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

        // If no custom args provided, make it a login shell to source profile files
        if let Some(args) = args {
            command.args(args);
        } else {
            // Run as login shell to source ~/.zprofile, ~/.bash_profile, etc.
            command.arg("-l");
        }

        command.env("TERM", choose_term());

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
                if libc::ioctl(slave_fd, libc::TIOCSCTTY as _, 0) < 0 {
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
