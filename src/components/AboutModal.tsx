import { openUrl } from '@tauri-apps/plugin-opener';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg shadow-2xl w-96 border border-gray-700" onClick={e => e.stopPropagation()}>
        {/* Header with close button */}
        <div className="flex items-start justify-end p-4 pb-0">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 pt-2">
          <div className="flex items-center gap-4 mb-4">
            <img src="/hamham.png" alt="AbbyTerm" className="w-24 h-24" />
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">AbbyTerm</h2>
              <p className="text-gray-400">Version 0.2.0</p>
            </div>
          </div>

          <p className="text-gray-300 mb-6 text-sm">
            AbbyTerm is a terminal emulator for Abby and you.
          </p>

          <div className="flex gap-4">
            <button
              onClick={async () => await openUrl('https://github.com/abbychau/abbyterm')}
              className="text-blue-400 hover:text-blue-300 text-sm hover:underline"
            >
              GitHub
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
