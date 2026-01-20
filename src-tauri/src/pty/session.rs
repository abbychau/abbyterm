use super::unix_pty::UnixPty;
use anyhow::Result;
use std::path::PathBuf;
use uuid::Uuid;

pub struct PtySession {
    pub id: Uuid,
    pub pty: UnixPty,
    pub cols: u16,
    pub rows: u16,
}

impl PtySession {
    pub fn new(
        shell: Option<String>,
        args: Option<Vec<String>>,
        cwd: Option<PathBuf>,
        cols: u16,
        rows: u16,
    ) -> Result<Self> {
        let pty = UnixPty::new(shell, args, cwd, cols, rows)?;

        Ok(Self {
            id: Uuid::new_v4(),
            pty,
            cols,
            rows,
        })
    }

    pub fn resize(&mut self, cols: u16, rows: u16) -> Result<()> {
        self.cols = cols;
        self.rows = rows;
        self.pty.resize(cols, rows)
    }

    pub fn write(&mut self, data: &[u8]) -> Result<usize> {
        self.pty.write(data)
    }

    pub fn try_clone_reader(&self) -> Result<std::fs::File> {
        self.pty.try_clone_reader()
    }

    pub fn kill(&mut self) -> Result<()> {
        let _ = self.pty.child.kill();
        Ok(())
    }

    pub fn get_child_pid(&self) -> u32 {
        self.pty.child.id()
    }
}
