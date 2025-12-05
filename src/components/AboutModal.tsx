import { openUrl } from '@tauri-apps/plugin-opener';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg shadow-2xl w-96 p-6 flex flex-col items-center border border-gray-700" onClick={e => e.stopPropagation()}>
        <img src="/hamham.png" alt="AbbyTerm" className="w-24 h-24 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">AbbyTerm</h2>
        <p className="text-gray-400 mb-6">Version 0.1.0</p>
        
        <p className="text-gray-300 text-center mb-6 text-sm">
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

        <button
          onClick={onClose}
          className="mt-8 px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
