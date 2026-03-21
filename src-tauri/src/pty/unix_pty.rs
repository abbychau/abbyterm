use anyhow::Result;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::io::Write;
use std::path::Path;
use std::path::PathBuf;

pub struct UnixPty {
    pub master: Box<dyn MasterPty + Send>,
    pub writer: Box<dyn Write + Send>,
    pub child: Box<dyn portable_pty::Child + Send + Sync>,
}

impl UnixPty {
    pub fn new(
        shell: Option<String>,
        args: Option<Vec<String>>,
        cwd: Option<PathBuf>,
        cols: u16,
        rows: u16,
    ) -> Result<Self> {
        let pty_system = native_pty_system();
        let pair = pty_system.openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        let shell_path = choose_shell(shell);
        let mut command = CommandBuilder::new(shell_path.clone());

        if let Some(args) = args {
            command.args(args);
        } else {
            #[cfg(not(target_os = "windows"))]
            {
                let shell_name = Path::new(&shell_path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_ascii_lowercase();
                let supports_login_flag = matches!(
                    shell_name.as_str(),
                    "bash" | "zsh" | "fish" | "ksh" | "mksh"
                );

                if supports_login_flag {
                    command.arg("-l");
                }
                command.arg("-i");
            }

            #[cfg(target_os = "windows")]
            {
                let shell_name = Path::new(&shell_path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_ascii_lowercase();

                if shell_name == "powershell.exe" || shell_name == "pwsh.exe" {
                    command.arg("-NoLogo");
                } else if shell_name == "cmd.exe" {
                    command.arg("/Q");
                }
            }
        }

        command.env("TERM", "xterm-256color");

        if let Some(dir) = cwd {
            command.cwd(dir);
        }

        let child = pair.slave.spawn_command(command)?;
        let writer = pair.master.take_writer()?;

        Ok(Self {
            master: pair.master,
            writer,
            child,
        })
    }

    pub fn resize(&self, cols: u16, rows: u16) -> Result<()> {
        self.master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
    }

    pub fn write(&mut self, data: &[u8]) -> Result<usize> {
        self.writer.write_all(data)?;
        self.writer.flush()?;
        Ok(data.len())
    }

    pub fn try_clone_reader(&self) -> Result<Box<dyn std::io::Read + Send>> {
        self.master.try_clone_reader()
    }
}

fn default_shell() -> String {
    #[cfg(target_os = "windows")]
    {
        if command_exists("pwsh.exe") {
            return "pwsh.exe".to_string();
        }
        if command_exists("powershell.exe") {
            return "powershell.exe".to_string();
        }
        std::env::var("ComSpec").unwrap_or_else(|_| "cmd.exe".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
    }
}

fn choose_shell(shell: Option<String>) -> String {
    let shell = shell
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    #[cfg(target_os = "windows")]
    {
        if let Some(shell) = shell {
            if shell.starts_with('/') {
                return default_shell();
            }
            return shell;
        }
        return default_shell();
    }

    #[cfg(not(target_os = "windows"))]
    {
        shell.unwrap_or_else(default_shell)
    }
}

#[cfg(target_os = "windows")]
fn command_exists(command: &str) -> bool {
    std::env::var_os("PATH")
        .map(|paths| std::env::split_paths(&paths).any(|dir| dir.join(command).is_file()))
        .unwrap_or(false)
}
