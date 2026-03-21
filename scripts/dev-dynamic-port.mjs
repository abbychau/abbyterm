import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const tauriConfigPath = path.join(repoRoot, 'src-tauri', 'tauri.conf.json');
const tempConfigPath = path.join(repoRoot, 'tauri.dev.dynamic.json');

async function chooseDevPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen({ port: 0, host: '127.0.0.1' }, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Failed to obtain dynamic dev port'));
        return;
      }

      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

async function main() {
  console.log('DO NOT RUN under VSCode.');

  const port = await chooseDevPort();
  const config = JSON.parse(await fs.readFile(tauriConfigPath, 'utf8'));

  config.build = {
    ...config.build,
    beforeDevCommand: `vite dev --port ${port} --strictPort`,
    devUrl: `http://localhost:${port}`,
  };

  await fs.writeFile(tempConfigPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  console.log(`Using dev port ${port}`);

  const tauriBin = path.join(
    repoRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tauri.cmd' : 'tauri'
  );

  const child =
    process.platform === 'win32'
      ? spawn(`"${tauriBin}" dev --config "${tempConfigPath}"`, [], {
          cwd: repoRoot,
          stdio: 'inherit',
          shell: true,
        })
      : spawn(tauriBin, ['dev', '--config', tempConfigPath], {
          cwd: repoRoot,
          stdio: 'inherit',
        });

  const cleanup = async () => {
    try {
      await fs.unlink(tempConfigPath);
    } catch {
      // ignore
    }
  };

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  child.on('exit', async (code, signal) => {
    await cleanup();

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
