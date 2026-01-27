import type { TerminalPluginDefinition } from './types';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  r: number;
  g: number;
  b: number;
};

const MAX_PARTICLES = 500;
const GRAVITY = 0.08;
const FADE = 0.955;
const MIN_ALPHA = 0.08;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const hexToRgb = (hex: string) => {
  const normalized = hex.trim();
  const m = normalized.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return { r, g, b };
};

const pickColor = (hexColors: string[]) => {
  for (let tries = 0; tries < hexColors.length; tries++) {
    const hex = hexColors[Math.floor(Math.random() * hexColors.length)] ?? '';
    const rgb = hexToRgb(hex);
    if (rgb) return rgb;
  }
  return { r: 255, g: 255, b: 255 };
};

const getCellSize = (term: any) => {
  const dims = term?._core?._renderService?.dimensions;
  const width = dims?.css?.cell?.width ?? dims?.actualCellWidth;
  const height = dims?.css?.cell?.height ?? dims?.actualCellHeight;
  if (typeof width === 'number' && width > 0 && typeof height === 'number' && height > 0) {
    return { width, height };
  }
  return null;
};

export const particlesPlugin: TerminalPluginDefinition = {
  id: 'particles',
  name: 'Particles',
  description: 'Spawns subtle particles (and a tiny shake) near the cursor when typing.',
  defaultEnabled: false,
  activate: ({ term, container, getThemeColors }) => {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '5';

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { dispose: () => {} };
    }

    container.appendChild(canvas);

    const particles: Particle[] = [];
    let rafId: number | null = null;
    let needsFrame = false;

    const baseTransform = container.style.transform;
    let shakeTimeout: number | null = null;
    let lastShake = 0;
    const minShakeIntervalMs = 90;

    const shake = () => {
      const now = performance.now();
      if (now - lastShake < minShakeIntervalMs) return;
      lastShake = now;

      const intensity = rand(0.5, 2.0);
      const x = intensity * (Math.random() > 0.5 ? -1 : 1);
      const y = intensity * (Math.random() > 0.5 ? -1 : 1);

      container.style.transform = baseTransform ? `${baseTransform} translate3d(${x}px, ${y}px, 0)` : `translate3d(${x}px, ${y}px, 0)`;
      if (shakeTimeout != null) window.clearTimeout(shakeTimeout);
      shakeTimeout = window.setTimeout(() => {
        container.style.transform = baseTransform;
        shakeTimeout = null;
      }, 60);
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(resize);
    });
    ro.observe(container);

    const spawnAt = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const colors = getThemeColors();
      const count = 5 + Math.floor(Math.random() * 6);
      for (let i = 0; i < count; i++) {
        const { r, g, b } = pickColor(colors);
        particles.push({
          x: x + rand(-2, 2),
          y: y + rand(-2, 2),
          vx: rand(-1.1, 1.1),
          vy: rand(-3.2, -1.4),
          alpha: 1,
          r,
          g,
          b,
        });
      }

      if (particles.length > MAX_PARTICLES) {
        particles.splice(0, particles.length - MAX_PARTICLES);
      }

      needsFrame = true;
      if (rafId == null) rafId = requestAnimationFrame(drawFrame);
    };

    const computeCursorClientPosition = () => {
      const root = term.element as HTMLElement | null;
      if (!root) return null;

      const screen = root.querySelector('.xterm-screen') as HTMLElement | null;
      const origin = (screen ?? root).getBoundingClientRect();
      const cell = getCellSize(term as any);
      if (!cell) return null;

      const cx = term.buffer.active.cursorX;
      const cy = term.buffer.active.cursorY;

      return {
        clientX: origin.left + cx * cell.width + cell.width / 2,
        clientY: origin.top + cy * cell.height + cell.height / 2,
      };
    };

    let lastSpawn = 0;
    const minIntervalMs = 18;

    const keyDisposable = term.onKey(() => {
      const now = performance.now();
      if (now - lastSpawn < minIntervalMs) return;
      lastSpawn = now;

      const pos = computeCursorClientPosition();
      if (!pos) return;
      spawnAt(pos.clientX, pos.clientY);

      shake();
    });

    const drawFrame = () => {
      rafId = null;
      if (!needsFrame) return;
      needsFrame = false;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.vy += GRAVITY;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha *= FADE;

        if (p.alpha > MIN_ALPHA) {
          ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${p.alpha})`;
          ctx.fillRect(Math.round(p.x - 1), Math.round(p.y - 1), 3, 3);
          needsFrame = true;
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i].alpha <= MIN_ALPHA) particles.splice(i, 1);
      }

      if (needsFrame) rafId = requestAnimationFrame(drawFrame);
    };

    return {
      dispose: () => {
        keyDisposable.dispose();
        ro.disconnect();
        if (rafId != null) cancelAnimationFrame(rafId);
        if (shakeTimeout != null) window.clearTimeout(shakeTimeout);
        container.style.transform = baseTransform;
        canvas.remove();
      },
    };
  },
};
