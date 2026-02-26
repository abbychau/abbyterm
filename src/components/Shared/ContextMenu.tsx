import * as RadixContextMenu from '@radix-ui/react-context-menu';
import { ReactNode } from 'react';

/* ============================================================================
   SHARED STYLING CONSTANTS
   All context menus use consistent styling for unified look and feel
============================================================================ */

const CONTENT_CLASSES = 'min-w-[220px] app-surface-2 overflow-hidden rounded-md p-1 shadow-lg border app-border z-[9999]';

const ITEM_CLASSES = 'group text-xs leading-none app-text flex items-center h-[28px] px-3 py-2 relative select-none outline-none cursor-pointer app-hover transition-colors';

const SEPARATOR_CLASSES = 'h-px w-full my-1 bg-[color:var(--app-border)]';

/* ============================================================================
   CONTEXT MENU COMPONENTS
============================================================================ */

interface ContextMenuRootProps {
  children: ReactNode;
}

/**
 * Root wrapper for context menu - wraps the trigger element
 */
export function ContextMenuRoot({ children }: ContextMenuRootProps) {
  return (
    <RadixContextMenu.Root>
      {children}
    </RadixContextMenu.Root>
  );
}

interface ContextMenuTriggerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Trigger element that opens context menu on right-click
 */
export function ContextMenuTrigger({ children, className = 'w-full h-full block' }: ContextMenuTriggerProps) {
  return (
    <RadixContextMenu.Trigger className={className}>
      {children}
    </RadixContextMenu.Trigger>
  );
}

interface ContextMenuContentProps {
  children: ReactNode;
}

/**
 * Content wrapper for context menu items
 */
export function ContextMenuContent({ children }: ContextMenuContentProps) {
  return (
    <RadixContextMenu.Portal>
      <RadixContextMenu.Content className={CONTENT_CLASSES}>
        {children}
      </RadixContextMenu.Content>
    </RadixContextMenu.Portal>
  );
}

/* ============================================================================
   MENU ITEM COMPONENTS
============================================================================ */

interface ContextMenuItemProps {
  children: ReactNode;
  onSelect?: () => void;
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
}

/**
 * Standard context menu item
 */
export function ContextMenuItem({
  children,
  onSelect,
  icon,
  shortcut,
  danger = false,
  disabled = false,
}: ContextMenuItemProps) {
  return (
    <RadixContextMenu.Item
      className={`${ITEM_CLASSES} ${danger ? 'data-[highlighted]:bg-[color:var(--app-danger)] data-[highlighted]:text-[color:var(--app-on-danger)]' : ''}`}
      onSelect={onSelect}
      disabled={disabled}
    >
      {icon && (
        <div className="mr-2 app-text-muted group-data-[highlighted]:text-[color:var(--app-text)]">
          {icon}
        </div>
      )}
      <span className="flex-1">{children}</span>
      {shortcut && (
        <div className="ml-auto pl-5 app-text-muted group-data-[highlighted]:text-[color:var(--app-text)] text-[10px]">
          {shortcut}
        </div>
      )}
    </RadixContextMenu.Item>
  );
}

/**
 * Context menu separator
 */
export function ContextMenuSeparator() {
  return <RadixContextMenu.Separator className={SEPARATOR_CLASSES} />;
}
