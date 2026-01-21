import { useState, useEffect, useRef } from 'react';

interface ShortcutRecorderProps {
  value: string;
  onChange: (value: string) => void;
}

export function ShortcutRecorder({ value, onChange }: ShortcutRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const modifiers = [];
      if (e.ctrlKey) modifiers.push('Ctrl');
      if (e.shiftKey) modifiers.push('Shift');
      if (e.altKey) modifiers.push('Alt');
      if (e.metaKey) modifiers.push('Meta');

      let key = e.key;
      if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') {
        return; // Wait for the actual key
      }
      
      // Handle special keys
      if (key === ' ') key = 'Space';
      if (key.length === 1) key = key.toUpperCase();

      const shortcut = [...modifiers, key].join('+');
      onChange(shortcut);
      setIsRecording(false);
    };

    // Use capture to intercept events before they bubble
    window.addEventListener('keydown', handleKeyDown, true);
    
    // Click outside to cancel
    const handleClickOutside = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsRecording(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isRecording, onChange]);

  return (
    <button
      ref={buttonRef}
      onClick={() => setIsRecording(true)}
      className={`px-3 py-1.5 border text-sm font-mono min-w-[120px] text-center transition-colors ${
        isRecording
          ? 'bg-blue-600 border-blue-500 text-white animate-pulse'
          : 'app-surface-2 app-border app-text hover:border-[color:var(--app-text-muted)]'
      }`}
    >
      {isRecording ? 'Press keys...' : value || 'None'}
    </button>
  );
}
