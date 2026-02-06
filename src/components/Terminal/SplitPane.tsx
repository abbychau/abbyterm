import { useState, useRef, useCallback, useEffect } from 'react';
import { Pane } from '@/types/tab';
import { Terminal } from './Terminal';
import { useTabStore, tabStore } from '@/store/tabStore';

interface SplitPaneProps {
  pane: Pane;
  isActive: boolean;
  tabId?: string;
}

interface SplitPaneProps {
  pane: Pane;
  isActive: boolean;
  tabId?: string;
}

export function SplitPane({ pane, isActive, tabId }: SplitPaneProps) {
  const [isDragging, setIsDragging] = useState<number | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const initialSizes = useRef<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const updateTab = useTabStore((state) => state.updateTab);

  const handleMouseDown = useCallback((index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (pane.type !== 'split') return;

    setIsDragging(index);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    initialSizes.current = pane.sizes?.slice() ?? Array(pane.children.length).fill(1 / pane.children.length);
  }, [pane]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging === null || pane.type !== 'split') return;

    const isHorizontal = pane.direction === 'horizontal';
    const index = isDragging;
    const container = containerRef.current;
    
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const totalSize = isHorizontal ? rect.width : rect.height;
    const delta = isHorizontal 
      ? e.clientX - dragStartPos.current.x 
      : e.clientY - dragStartPos.current.y;

    const newSizes = [...initialSizes.current];
    const deltaFraction = delta / totalSize;
    
    // Adjust sizes of the two adjacent panes
    newSizes[index] -= deltaFraction;
    newSizes[index - 1] += deltaFraction;
    
    // Clamp sizes to prevent negative values or too small
    const minSize = 0.05; // 5% minimum
    
    if (newSizes[index] < minSize || newSizes[index - 1] < minSize) {
      return;
    }
    
    // Normalize to ensure total is 1
    const currentTotal = newSizes.reduce((a, b) => a + b, 0);
    const normalizedSizes = newSizes.map(s => s / currentTotal);
    
    // Update the split pane's sizes
    if (tabId) {
      const updatePane = (p: Pane): Pane => {
        if (p.type === 'split' && p.id === pane.id) {
          return { ...p, sizes: normalizedSizes };
        } else if (p.type === 'split') {
          return { ...p, children: p.children.map(updatePane) };
        }
        return p;
      };
      
      const currentTab = tabStore.getState().tabs.find(t => t.id === tabId);
      if (currentTab) {
        updateTab(tabId, { rootPane: updatePane(currentTab.rootPane) });
      }
    }
  }, [isDragging, pane, tabId, updateTab]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  // Add global event listeners for dragging
  useEffect(() => {
    if (isDragging !== null) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (pane.type === 'terminal') {
    const tabs = tabStore.getState().tabs;
    const tab = tabs.find(t => t.id === tabId);
    const isPrimaryPane = tab ? tab.sessionId === pane.sessionId : false;

    return (
      <div className="w-full h-full border app-border">
        <Terminal sessionId={pane.sessionId} isActive={isActive} tabId={tabId} paneId={pane.id} isPrimaryPane={isPrimaryPane} />
      </div>
    );
  }

  if (pane.type === 'split') {
    const isHorizontal = pane.direction === 'horizontal';

    return (
      <div
        ref={containerRef}
        className={`flex-1 ${isHorizontal ? 'flex flex-row' : 'flex flex-col'} w-full h-full`}
        style={{
          [isHorizontal ? 'height' : 'width']: '100%',
        }}
      >
        {pane.children.map((child, index) => {
          const size = pane.sizes?.[index] ?? 1 / pane.children.length;
          
          return (
            <div
              key={child.id}
              style={{
                flex: size,
                minWidth: isHorizontal ? '100px' : undefined,
                minHeight: isHorizontal ? undefined : '100px',
              }}
              className="overflow-hidden relative border app-border"
            >
              {index > 0 && (
                <div
                  className={`absolute ${
                    isHorizontal
                      ? 'top-0 bottom-0 left-0 w-2'
                      : 'left-0 right-0 top-0 h-2'
                  } app-border z-20 hover:bg-[color:var(--app-accent)] hover:opacity-50 transition-colors ${isHorizontal ? 'cursor-ew-resize' : 'cursor-ns-resize'}`}
                  onMouseDown={(e) => handleMouseDown(index, e)}
                />
              )}
              <div className="w-full h-full overflow-hidden">
                {child.type === 'terminal' ? (
                  <Terminal
                    sessionId={child.sessionId}
                    isActive={isActive}
                    tabId={tabId}
                    paneId={child.id}
                  />
                ) : (
                  <SplitPane pane={child} isActive={isActive} tabId={tabId} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}
