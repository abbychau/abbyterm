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
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md border border-gray-700 bg-[#1e1e1e] p-1 shadow-lg text-gray-300">
      <input
        ref={inputRef}
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find"
        className="h-7 w-48 rounded bg-[#2d2d2d] px-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
      />
      
      <div className="flex items-center gap-0.5 border-l border-gray-700 pl-1">
         <button
          onClick={() => setCaseSensitive(!caseSensitive)}
          className={`rounded p-1 hover:bg-[#3d3d3d] ${caseSensitive ? 'bg-[#3d3d3d] text-blue-400' : ''}`}
          title="Match Case"
        >
          <span className="text-xs font-bold">Aa</span>
        </button>
         <button
          onClick={() => setWholeWord(!wholeWord)}
          className={`rounded p-1 hover:bg-[#3d3d3d] ${wholeWord ? 'bg-[#3d3d3d] text-blue-400' : ''}`}
          title="Match Whole Word"
        >
          <span className="text-xs font-bold" style={{textDecoration: 'underline'}}>ab</span>
        </button>
         <button
          onClick={() => setUseRegex(!useRegex)}
          className={`rounded p-1 hover:bg-[#3d3d3d] ${useRegex ? 'bg-[#3d3d3d] text-blue-400' : ''}`}
          title="Use Regular Expression"
        >
          <span className="text-xs font-bold">.*</span>
        </button>
      </div>

      <div className="flex items-center border-l border-gray-700 pl-1">
        <button
          onClick={findPrevious}
          className="rounded p-1 hover:bg-[#3d3d3d]"
          title="Previous Match (Shift+Enter)"
        >
          <ArrowUp size={14} />
        </button>
        <button
          onClick={findNext}
          className="rounded p-1 hover:bg-[#3d3d3d]"
          title="Next Match (Enter)"
        >
          <ArrowDown size={14} />
        </button>
      </div>

      <button
        onClick={onClose}
        className="ml-1 rounded p-1 hover:bg-[#3d3d3d] hover:text-red-400"
      >
        <X size={14} />
      </button>
    </div>
  );
}
