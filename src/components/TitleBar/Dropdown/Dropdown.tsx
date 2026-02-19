import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ReactNode, MouseEvent } from 'react';

/* ============================================================================
   SHARED STYLING CONSTANTS
   All dropdown menus use consistent styling for unified look and feel
============================================================================ */

const TRIGGER_CLASSES = 'px-3 h-8 flex items-center justify-center app-hover transition-colors';

const CONTENT_CLASSES = 'app-surface-2 shadow-lg border app-border z-50';

const CONTENT_BASE = 'rounded-md p-1 max-h-[500px] overflow-y-auto';

const ITEM_CLASSES = 'px-3 py-2 text-xs app-text app-hover outline-none cursor-pointer flex items-center gap-2';

const LABEL_CLASSES = 'text-xs app-text-muted font-semibold px-3 py-2';

const SEPARATOR_CLASSES = 'h-px my-1 bg-[color:var(--app-border)]';

const SUB_CONTENT_CLASSES = 'app-surface-2 rounded-md shadow-lg p-1 border app-border z-50 max-h-[400px] overflow-y-auto';

const SUB_TRIGGER_CLASSES = 'px-3 py-2 text-xs app-text app-hover outline-none cursor-pointer flex items-center gap-2';

/* ============================================================================
   DROPDOWN COMPONENTS
============================================================================ */

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: 'start' | 'center' | 'end';
  minWidth?: number;
  ariaLabel?: string;
}

/**
 * Unified dropdown wrapper component
 */
export function Dropdown({
  trigger,
  children,
  isOpen,
  onOpenChange,
  align = 'start',
  minWidth = 280,
  ariaLabel,
}: DropdownProps) {
  return (
    <DropdownMenu.Root modal={false} open={isOpen} onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>
        <button
          className={TRIGGER_CLASSES}
          type="button"
          aria-label={ariaLabel}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {trigger}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={`${CONTENT_CLASSES} ${CONTENT_BASE}`}
          style={{ minWidth }}
          align={align}
          sideOffset={5}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/* ============================================================================
   MENU ITEM COMPONENTS
============================================================================ */

interface DropdownItemProps {
  children: ReactNode;
  onSelect?: () => void;
  icon?: ReactNode;
  className?: string;
}

/**
 * Standard dropdown menu item
 */
export function DropdownItem({ children, onSelect, icon, className = '' }: DropdownItemProps) {
  return (
    <DropdownMenu.Item
      className={`${ITEM_CLASSES} ${className}`.trim()}
      onSelect={onSelect}
    >
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}

/* ============================================================================
   HEADER COMPONENT (with optional refresh button)
============================================================================ */

interface DropdownHeaderProps {
  label: string;
  onRefresh?: (e: MouseEvent<HTMLButtonElement>) => void;
  isRefreshing?: boolean;
}

/**
 * Header for dropdown menus with optional refresh button
 */
export function DropdownHeader({ label, onRefresh, isRefreshing }: DropdownHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <DropdownMenu.Label className={LABEL_CLASSES}>
        {label}
      </DropdownMenu.Label>
      {onRefresh && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRefresh(e);
          }}
          className="p-1 app-hover transition-colors"
          disabled={isRefreshing}
          type="button"
        >
          <RefreshIcon isSpinning={isRefreshing} />
        </button>
      )}
    </div>
  );
}

/* ============================================================================
   STATE MESSAGE COMPONENTS (loading, error, empty)
============================================================================ */

interface StateMessageProps {
  type: 'loading' | 'error' | 'empty';
  message?: string;
}

/**
 * Unified state messages for loading, error, and empty states
 */
export function DropdownStateMessage({ type, message }: StateMessageProps) {
  const defaultMessages = {
    loading: 'Loading...',
    error: 'An error occurred',
    empty: 'No items found',
  };

  const displayMessage = message || defaultMessages[type];

  const baseClasses = 'px-3 py-2 text-xs italic';
  const typeClasses = {
    loading: 'app-text-muted',
    error: 'text-[color:var(--app-danger)]',
    empty: 'app-text-muted',
  };

  return <div className={`${baseClasses} ${typeClasses[type]}`}>{displayMessage}</div>;
}

/* ============================================================================
   SUB-MENU COMPONENTS
============================================================================ */

interface DropdownSubProps {
  trigger: ReactNode;
  triggerIcon?: ReactNode;
  triggerLabel?: string;
  triggerCount?: number;
  children: ReactNode;
}

/**
 * Sub-menu for grouped items (e.g., Docker projects, K8s namespaces)
 */
export function DropdownSub({
  trigger,
  triggerIcon,
  triggerLabel,
  triggerCount,
  children,
}: DropdownSubProps) {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className={SUB_TRIGGER_CLASSES}>
        {triggerIcon}
        {triggerLabel && <span className="flex-1 truncate">{triggerLabel}</span>}
        {triggerCount && <span className="text-xs app-text-muted">({triggerCount})</span>}
        <ChevronRightIcon />
        {!triggerLabel && trigger}
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent className={SUB_CONTENT_CLASSES}>
          {children}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}

/* ============================================================================
   UTILITY COMPONENTS
============================================================================ */

/**
 * Dropdown separator
 */
export function DropdownSeparator() {
  return <DropdownMenu.Separator className={SEPARATOR_CLASSES} />;
}

/**
 * Dropdown label/section header
 */
export function DropdownLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu.Label className={LABEL_CLASSES}>
      {children}
    </DropdownMenu.Label>
  );
}

/* ============================================================================
   ICON COMPONENTS
============================================================================ */

interface RefreshIconProps {
  isSpinning?: boolean;
}

/**
 * Refresh icon with optional spin animation
 */
export function RefreshIcon({ isSpinning }: RefreshIconProps) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`app-text-muted ${isSpinning ? 'animate-spin' : ''}`}
    >
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );
}

/**
 * Chevron right icon for sub-menus
 */
export function ChevronRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
