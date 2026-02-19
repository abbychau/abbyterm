import { openUrl } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  const [buildDate, setBuildDate] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      invoke<string>('get_build_date')
        .then(setBuildDate)
        .catch(() => setBuildDate('Unknown'));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="app-surface-2 app-text shadow-2xl w-80 border app-border" onClick={e => e.stopPropagation()}>
        {/* Header with close button */}
        <div className="flex items-start justify-end p-3 pb-0">
          <button
            onClick={onClose}
            className="app-text-muted hover:text-[color:var(--app-text)] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 pt-1">
          <div className="flex items-center gap-3 mb-3">
            <img src="/hamham.png" alt="AbbyTerm" className="w-16 h-16" />
            <div>
              <h2 className="text-xl font-bold app-text mb-0.5">AbbyTerm</h2>
              <p className="app-text-muted text-xs">Version 0.2.0</p>
            </div>
          </div>

          <p className="app-text mb-2 text-xs">
            AbbyTerm is a terminal emulator for Abby and you.
          </p>

          <p className="app-text-muted mb-3 text-xs">
            Built: {buildDate}
          </p>

          <div className="flex gap-3">
            <button
              onClick={async () => await openUrl('https://github.com/abbychau/abbyterm')}
              className="app-text-accent text-xs hover:underline"
            >
              GitHub
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
