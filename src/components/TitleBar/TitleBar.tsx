import { WindowControls } from './WindowControls';
import { MenuButton } from './MenuButton';
import { NewTabButton } from './NewTabButton';

export function TitleBar() {
  return (
    <div
      className="h-10 bg-gray-900 border-b border-gray-800 flex items-center justify-between select-none"
      data-tauri-drag-region
    >
      {/* Draggable left section */}
      <div className="flex items-center gap-2 px-3">
        <span className="text-sm font-semibold text-gray-200">AbbyTerm</span>
      </div>

      {/* Draggable middle spacer */}
      <div className="flex-1" />

      {/* Non-draggable buttons section */}
      <div className="flex items-center gap-1 pointer-events-auto" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <NewTabButton />
        <MenuButton />
      </div>

      <WindowControls />
    </div>
  );
}
