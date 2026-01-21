import React, { useEffect, useRef, useState } from 'react';
import { SearchAddon } from 'xterm-addon-search';
import { ArrowUp, ArrowDown, X } from 'lucide-react';

interface SearchBoxProps {
  searchAddon: SearchAddon;
  onClose: () => void;
}

export function SearchBox({ searchAddon, onClose }: SearchBoxProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (searchTerm) {
        // We don't auto-find on every keystroke to avoid jumping around too much, 
        // but VS Code does. Let's try to mimic VS Code.
        // However, xterm-addon-search might be a bit different.
        // Let's try finding next immediately.
        searchAddon.findNext(searchTerm, {
            caseSensitive,
            regex: useRegex,
            wholeWord,
            incremental: true, 
        });
    }
  }, [searchTerm, caseSensitive, useRegex, wholeWord, searchAddon]);

  const findNext = () => {
    searchAddon.findNext(searchTerm, {
      caseSensitive,
      regex: useRegex,
      wholeWord,
    });
  };

  const findPrevious = () => {
    searchAddon.findPrevious(searchTerm, {
      caseSensitive,
      regex: useRegex,
      wholeWord,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        findPrevious();
      } else {
        findNext();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 border app-border app-surface-2 p-1 shadow-lg app-text">
      <input
        ref={inputRef}
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find"
        className="h-7 w-48 app-surface px-2 text-sm outline-none focus:ring-1 focus:ring-[color:var(--app-accent)]"
      />
      
      <div className="flex items-center gap-0.5 border-l app-border pl-1">
         <button
          onClick={() => setCaseSensitive(!caseSensitive)}
          className={`p-1 app-hover-2 ${caseSensitive ? 'bg-[color:var(--app-hover-2)] text-[color:var(--app-accent)]' : ''}`}
          title="Match Case"
        >
          <span className="text-xs font-bold font-mono">Aa</span>
        </button>
         <button
          onClick={() => setWholeWord(!wholeWord)}
          className={`p-1 app-hover-2 ${wholeWord ? 'bg-[color:var(--app-hover-2)] text-[color:var(--app-accent)]' : ''}`}
          title="Match Whole Word"
        >
          <span className="text-xs font-bold font-mono" style={{textDecoration: 'underline'}}>ab</span>
        </button>
         <button
          onClick={() => setUseRegex(!useRegex)}
          className={`p-1 app-hover-2 ${useRegex ? 'bg-[color:var(--app-hover-2)] text-[color:var(--app-accent)]' : ''}`}
          title="Use Regular Expression"
        >
          <span className="text-xs font-bold font-mono">.*</span>
        </button>
      </div>

      <div className="flex items-center border-l app-border pl-1">
        <button
          onClick={findPrevious}
          className="p-1 app-hover-2"
          title="Previous Match (Shift+Enter)"
        >
          <ArrowUp size={14} />
        </button>
        <button
          onClick={findNext}
          className="p-1 app-hover-2"
          title="Next Match (Enter)"
        >
          <ArrowDown size={14} />
        </button>
      </div>

      <button
        onClick={onClose}
        className="ml-1 p-1 app-hover-2 hover:text-[color:var(--app-danger)]"
      >
        <X size={14} />
      </button>
    </div>
  );
}
