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
      invoke<string>('get_build_date_short')
        .then(setBuildDate)
        .catch(() => setBuildDate('Unknown'));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="app-surface-2 app-text shadow-2xl w-96 border app-border" onClick={e => e.stopPropagation()}>
        {/* Header with close button */}
        <div className="flex items-start justify-end p-4 pb-0">
          <button
            onClick={onClose}
            className="app-text-muted hover:text-[color:var(--app-text)] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 pt-2">
          <div className="flex items-center gap-4 mb-4">
            <img src="/hamham.png" alt="AbbyTerm" className="w-24 h-24" />
            <div>
              <h2 className="text-2xl font-bold app-text mb-1">AbbyTerm</h2>
              <p className="app-text-muted">Version 0.2.0</p>
            </div>
          </div>

          <p className="app-text mb-4 text-sm">
            AbbyTerm is a terminal emulator for Abby and you.
          </p>

          <p className="app-text-muted mb-6 text-sm">
            Built: {buildDate}
          </p>

          <div className="flex gap-4">
            <button
              onClick={async () => await openUrl('https://github.com/abbychau/abbyterm')}
              className="app-text-accent text-sm hover:underline"
            >
              GitHub
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
