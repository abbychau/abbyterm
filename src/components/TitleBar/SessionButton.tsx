import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Save, FolderOpen, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useSessionManager } from '@/hooks/useSessionManager';
import {
  Dropdown,
  DropdownItem,
  DropdownSeparator,
  DropdownStateMessage,
} from './Dropdown/Dropdown';

interface SaveSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}

function SaveSessionModal({ isOpen, onClose, onSave }: SaveSessionModalProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
      onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="app-surface-2 app-text shadow-2xl w-96 border app-border" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="flex items-center justify-between p-4 border-b app-border">
          <h3 className="text-lg font-semibold">Save Session</h3>
          <button onClick={onClose} className="app-text-muted hover:text-[color:var(--app-text)] transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <label className="block text-sm font-medium mb-2 app-text">Session Name</label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 bg-[color:var(--app-background)] border app-border app-text rounded focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)]"
            placeholder="Enter session name"
          />
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 app-text hover:bg-[color:var(--app-border)] rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 bg-[color:var(--app-accent)] app-text rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel }: ConfirmModalProps) {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter') {
      onConfirm();
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="app-surface-2 app-text shadow-2xl w-96 border app-border" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="flex items-center justify-between p-4 border-b app-border">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-yellow-500" />
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
          <button onClick={onCancel} className="app-text-muted hover:text-[color:var(--app-text)] transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          <p className="text-sm app-text-muted mb-4">{message}</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 app-text hover:bg-[color:var(--app-border)] rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm();
                onCancel();
              }}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error';
  onClose: () => void;
}

function AlertModal({ isOpen, title, message, type = 'success', onClose }: AlertModalProps) {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'Enter') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="app-surface-2 app-text shadow-2xl w-96 border app-border" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="flex items-center justify-between p-4 border-b app-border">
          <div className="flex items-center gap-2">
            {type === 'success' ? (
              <CheckCircle size={20} className="text-green-500" />
            ) : (
              <AlertTriangle size={20} className="text-red-500" />
            )}
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
          <button onClick={onClose} className="app-text-muted hover:text-[color:var(--app-text)] transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          <p className="text-sm app-text-muted mb-4">{message}</p>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[color:var(--app-accent)] app-text rounded hover:opacity-90 transition-opacity"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SessionButton() {
  const { saveSession, loadSession } = useSessionManager();
  const [savedSessions, setSavedSessions] = useState<any[]>([]);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success'
  });

  const loadSavedSessions = async () => {
    try {
      const sessions = await invoke<any[]>('get_session_snapshots');
      setSavedSessions(sessions);
    } catch (err) {
      console.error('Failed to load saved sessions:', err);
    }
  };

  const handleSaveSession = async (name: string) => {
    try {
      await saveSession(name);
      await loadSavedSessions();
    } catch (err) {
      console.error('Failed to save session:', err);
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: 'Failed to save session: ' + err,
        type: 'error'
      });
    }
  };

  const handleLoadSession = async (session: any) => {
    try {
      await loadSession(session);
    } catch (err) {
      console.error('Failed to load session:', err);
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: 'Failed to load session: ' + err,
        type: 'error'
      });
    }
  };

  const handleDeleteSession = async (session: any) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Session',
      message: 'Delete saved session?',
      onConfirm: async () => {
        try {
          await invoke('delete_session_snapshot', { name: session.name });
          await loadSavedSessions();
        } catch (err) {
          console.error('Failed to delete session:', err);
          setAlertModal({
            isOpen: true,
            title: 'Error',
            message: 'Failed to delete session: ' + err,
            type: 'error'
          });
        }
      }
    });
  };

  // Load saved sessions on mount
  useEffect(() => {
    loadSavedSessions();
  }, []);

  return (
    <>
      <Dropdown
        trigger={<FolderOpen size={16} className="app-text" />}
        ariaLabel="Sessions"
        minWidth={300}
      >
        <DropdownItem
          onSelect={() => setIsSaveModalOpen(true)}
          icon={<Save size={14} strokeWidth={2} />}
        >
          Save Current Session
        </DropdownItem>

        <DropdownSeparator />

        {savedSessions.length === 0 && (
          <DropdownStateMessage type="empty" message="No saved sessions" />
        )}

        {savedSessions.length > 0 && (
          <>
            {savedSessions.map((session) => (
              <div key={session.name} className="relative group">
                <DropdownItem
                  onSelect={() => handleLoadSession(session)}
                  icon={<FolderOpen size={14} className="app-text-muted flex-shrink-0" strokeWidth={2} />}
                  className="pr-8"
                >
                  <div className="truncate flex-1 min-w-0">{session.name}</div>
                  <div className="text-[11px] app-text-muted flex-shrink-0">
                    {new Date(session.created_at).toLocaleDateString()}
                  </div>
                </DropdownItem>

                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 hover:text-[color:var(--app-danger)] app-text-muted transition-opacity p-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(session);
                  }}
                  type="button"
                  aria-label={`Delete ${session.name}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </>
        )}
      </Dropdown>

      <SaveSessionModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSaveSession}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />

      <AlertModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
      />
    </>
  );
}
