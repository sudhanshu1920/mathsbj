import { useRef, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { m as motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArchiveRestore, CheckCircle2, Download, FileCheck2,
  LoaderCircle, ShieldCheck, Upload, X,
} from 'lucide-react';
import { MOTION } from '@/lib/motion';
import { APP_VERSION_NAME } from '@/lib/appVersion';
import {
  captureBackupStorageSnapshot,
  createBackupText,
  LAST_BACKUP_STORAGE_KEY,
  refreshAppAfterRestore,
  replaceBackupStorageSnapshot,
  validateBackupText,
  type BackupEnvelope,
  type WidgetPreferenceSnapshot,
} from '@/lib/backupRestore';

interface NativeBackupPlugin {
  saveBackup(options: { filename: string; content: string }): Promise<{
    saved: boolean; cancelled?: boolean; bytesWritten?: number;
  }>;
  pickBackup(): Promise<{ content?: string; fileName?: string; cancelled?: boolean }>;
  getWidgetPreferences(): Promise<{ snapshot: string }>;
  restoreWidgetPreferences(options: { snapshot: string }): Promise<{
    restored: boolean; mappedInstances?: number; skippedInstances?: number;
  }>;
}
const NativeBackup = registerPlugin<NativeBackupPlugin>('MathMasterBackup');

type LastBackup = { filename: string; createdAt: string };
type RestoreCandidate = { fileName: string; backup: BackupEnvelope };
type BusyAction = 'creating' | 'reading' | 'restoring' | null;

function readLastBackup(): LastBackup | null {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_STORAGE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>;
    if (typeof item.filename !== 'string' || typeof item.createdAt !== 'string' ||
        !Number.isFinite(Date.parse(item.createdAt))) return null;
    return { filename: item.filename, createdAt: item.createdAt };
  } catch {
    return null;
  }
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : 'Not available';
}

function makeBackupFilename(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return 'MathMaster_Backup_' + year + '-' + month + '-' + day + '.mathbackup';
}

function downloadBackup(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/vnd.mathmaster.backup' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Something went wrong. Your existing data has not been intentionally cleared.';
}

const BackupRestorePanel = ({ onBack }: { onBack: () => void }) => {
  const [busy, setBusy] = useState<BusyAction>(null);
  const busyRef = useRef(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [lastBackup, setLastBackup] = useState<LastBackup | null>(() => readLastBackup());
  const [candidate, setCandidate] = useState<RestoreCandidate | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const native = Capacitor.isNativePlatform();

  const begin = (action: Exclude<BusyAction, null>): boolean => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(action);
    setStatus(null);
    return true;
  };

  const finish = () => {
    busyRef.current = false;
    setBusy(null);
  };

  const handleCreateBackup = async () => {
    if (!begin('creating')) return;
    try {
      // Read native preferences first, then capture all browser-backed app
      // records synchronously in one pass immediately before serialization.
      let widgetPreferences: WidgetPreferenceSnapshot | null = null;
      if (native) {
        const nativeSnapshot = await NativeBackup.getWidgetPreferences();
        widgetPreferences = JSON.parse(nativeSnapshot.snapshot) as WidgetPreferenceSnapshot;
      }
      const storageEntries = captureBackupStorageSnapshot();
      const createdAt = new Date();
      const filename = makeBackupFilename(createdAt);
      const text = await createBackupText({ storageEntries, widgetPreferences, createdAt, appVersion: APP_VERSION_NAME });
      if (native) {
        const result = await NativeBackup.saveBackup({ filename, content: text });
        if (result.cancelled) return;
        const expectedBytes = new TextEncoder().encode(text).byteLength;
        if (!result.saved || (typeof result.bytesWritten === 'number' && result.bytesWritten !== expectedBytes)) {
          throw new Error('The backup file was not fully written. Please choose another destination and try again.');
        }
      } else {
        downloadBackup(text, filename);
      }

      const saved = { filename, createdAt: createdAt.toISOString() };
      try { localStorage.setItem(LAST_BACKUP_STORAGE_KEY, JSON.stringify(saved)); } catch { /* Backup file is already saved. */ }
      setLastBackup(saved);
      setStatus({ kind: 'success', message: 'Backup created and saved successfully.' });
    } catch (error) {
      setStatus({ kind: 'error', message: getErrorMessage(error) });
    } finally {
      finish();
    }
  };

  const validateSelectedFile = async (text: string, fileName: string) => {
    if (!begin('reading')) return;
    try {
      const backup = await validateBackupText(text);
      setCandidate({ fileName: fileName || 'MathMaster backup', backup });
      setStatus(null);
    } catch (error) {
      setCandidate(null);
      setStatus({ kind: 'error', message: getErrorMessage(error) });
    } finally {
      finish();
    }
  };

  const handleChooseRestore = async () => {
    if (native) {
      if (!begin('reading')) return;
      try {
        const selected = await NativeBackup.pickBackup();
        if (selected.cancelled) return;
        if (!selected.content) throw new Error('The selected backup file is empty or could not be read.');
        const backup = await validateBackupText(selected.content);
        setCandidate({ fileName: selected.fileName || 'MathMaster backup', backup });
        setStatus(null);
      } catch (error) {
        setCandidate(null);
        setStatus({ kind: 'error', message: getErrorMessage(error) });
      } finally {
        finish();
      }
      return;
    }
    fileInputRef.current?.click();
  };

  const handleBrowserFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 64 * 1024 * 1024) {
      setStatus({ kind: 'error', message: 'The selected backup exceeds the supported 64 MB limit.' });
      return;
    }
    try {
      await validateSelectedFile(await file.text(), file.name);
    } catch (error) {
      setStatus({ kind: 'error', message: getErrorMessage(error) });
    }
  };

  const handleRestore = async () => {
    if (!candidate || !begin('restoring')) return;
    let previousStorage: Record<string, string> | null = null;
    let previousWidgetSnapshot: string | null = null;
    let storageReplacementAttempted = false;
    let widgetReplacementAttempted = false;
    const targetWidgetPreferences = candidate.backup.payload.native.widgetPreferences;
    try {
      previousStorage = captureBackupStorageSnapshot();
      if (native && targetWidgetPreferences) {
        previousWidgetSnapshot = (await NativeBackup.getWidgetPreferences()).snapshot;
      }
      storageReplacementAttempted = true;
      replaceBackupStorageSnapshot(candidate.backup.payload.storage);

      let skippedWidgetInstances = 0;
      if (native && targetWidgetPreferences) {
        widgetReplacementAttempted = true;
        const result = await NativeBackup.restoreWidgetPreferences({ snapshot: JSON.stringify(targetWidgetPreferences) });
        if (!result.restored) throw new Error('Android could not restore the saved widget preferences.');
        skippedWidgetInstances = result.skippedInstances ?? 0;
      }

      refreshAppAfterRestore();
      setCandidate(null);
      setStatus({
        kind: 'success',
        message: !native && targetWidgetPreferences
          ? 'Restore complete. Saved settings and progress are restored. Android widget preferences remain in the backup but cannot be applied in this browser.'
          : skippedWidgetInstances > 0
            ? 'Restore complete. Some per-instance widget settings could not be mapped to widgets on this device; launcher placement is managed by Android.'
            : targetWidgetPreferences
              ? 'Restore complete. Saved settings, progress and supported widget preferences are restored.'
              : 'Restore complete. Saved settings and progress are restored; this backup did not include launcher-widget preferences.',
      });
    } catch (error) {
      if (!previousStorage) {
        setStatus({ kind: 'error', message: 'Restore failed before any data was changed. ' + getErrorMessage(error) });
        return;
      }
      let rollbackFailed = false;
      try {
        if (storageReplacementAttempted) replaceBackupStorageSnapshot(previousStorage, localStorage, true);
        if (native && widgetReplacementAttempted && previousWidgetSnapshot !== null) {
          const rollback = await NativeBackup.restoreWidgetPreferences({ snapshot: previousWidgetSnapshot });
          if (!rollback.restored) throw new Error('Android could not restore previous widget preferences.');
        }
        refreshAppAfterRestore();
      } catch {
        rollbackFailed = true;
      }
      setStatus({
        kind: 'error',
        message: rollbackFailed
          ? 'Restore failed and automatic rollback could not be confirmed. Keep the app open and do not retry until storage is available.'
          : 'Restore failed; your previous app data was recovered. ' + getErrorMessage(error),
      });
    } finally {
      finish();
    }
  };

  const isBusy = busy !== null;
  const createdAt = candidate?.backup.createdAt;
  const storageCount = candidate ? Object.keys(candidate.backup.payload.storage).length : 0;
  const statusClass = status?.kind === 'error'
    ? 'border-destructive/35 bg-destructive/5 text-foreground'
    : 'border-success/30 bg-success/5 text-foreground';

  return (
    <div className="min-w-0 space-y-5" data-backup-restore-screen>
      <div className="flex items-center gap-3">
        <motion.button
          type="button"
          whileTap={{ scale: MOTION.scale.press }}
          onClick={onBack}
          disabled={isBusy}
          aria-label="Back to Settings"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/40 text-foreground transition-colors hover:border-primary/40 disabled:opacity-50"
        >
          <ArrowLeft size={17} />
        </motion.button>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold text-foreground">Backup &amp; Restore</h2>
          <p className="text-xs text-muted-foreground">Portable app data · SHA-256 integrity</p>
        </div>
        <ArchiveRestore size={19} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>

      <section className="space-y-3 rounded-2xl border border-border/70 bg-card/25 p-3.5">
        <h3 className="text-sm font-semibold text-foreground">Backup</h3>
        <motion.button
          type="button"
          whileTap={{ scale: MOTION.scale.press }}
          onClick={() => void handleCreateBackup()}
          disabled={isBusy}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-primary/35 bg-primary/8 px-3.5 py-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-primary/12 disabled:cursor-wait disabled:opacity-60"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            {busy === 'creating' ? <LoaderCircle size={17} className="animate-spin text-primary" /> : <Download size={17} className="text-primary" />}
            <span>{busy === 'creating' ? 'Creating backup…' : 'Create Backup'}</span>
          </span>
          <FileCheck2 size={17} className="shrink-0 text-muted-foreground" />
        </motion.button>
        <div className="flex items-start justify-between gap-3 border-t border-border/60 pt-3">
          <span className="text-xs font-medium text-muted-foreground">Last Backup</span>
          <span className="min-w-0 text-right text-xs text-foreground">
            {lastBackup ? (
              <>
                <span className="block">{formatDateTime(lastBackup.createdAt)}</span>
                <span className="mt-0.5 block max-w-52 truncate text-muted-foreground">{lastBackup.filename}</span>
              </>
            ) : 'Not available'}
          </span>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border/70 bg-card/25 p-3.5">
        <h3 className="text-sm font-semibold text-foreground">Restore</h3>
        <motion.button
          type="button"
          whileTap={{ scale: MOTION.scale.press }}
          onClick={() => void handleChooseRestore()}
          disabled={isBusy}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border/80 bg-card/40 px-3.5 py-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:border-primary/40 disabled:cursor-wait disabled:opacity-60"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            {busy === 'reading' ? <LoaderCircle size={17} className="animate-spin text-primary" /> : <Upload size={17} className="text-muted-foreground" />}
            <span>{busy === 'reading' ? 'Validating backup…' : 'Restore Backup'}</span>
          </span>
          <ShieldCheck size={17} className="shrink-0 text-muted-foreground" />
        </motion.button>
        {!native && (
          <input
            ref={fileInputRef}
            type="file"
            accept=".mathbackup,.json,application/json,application/octet-stream"
            onChange={(event) => { void handleBrowserFile(event); }}
            className="hidden"
            aria-label="Select backup file"
          />
        )}
      </section>

      {busy === 'restoring' && (
        <div className="flex items-center gap-2 rounded-lg bg-primary/8 px-3 py-2 text-xs text-foreground" role="status">
          <LoaderCircle size={15} className="animate-spin text-primary" />
          Restoring and verifying saved data…
        </div>
      )}

      {status && (
        <div
          role={status.kind === 'error' ? 'alert' : 'status'}
          className={'flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed ' + statusClass}
        >
          {status.kind === 'success'
            ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
            : <X size={16} className="mt-0.5 shrink-0 text-destructive" />}
          <span>{status.message}</span>
        </div>
      )}

      <AnimatePresence>
        {candidate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={(event) => { if (event.target === event.currentTarget && !isBusy) setCandidate(null); }}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="backup-restore-confirm-title"
              initial={{ opacity: 0, y: 8, scale: MOTION.scale.subtle }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: MOTION.scale.subtle }}
              className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-4 shadow-2xl"
            >
              <div className="flex items-start gap-3">
                <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
                  <ShieldCheck size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 id="backup-restore-confirm-title" className="text-sm font-bold text-foreground">Restore this backup?</h3>
                  <p className="mt-1 break-all text-xs text-muted-foreground">{candidate.fileName}</p>
                </div>
              </div>
              <div className="space-y-1 rounded-xl bg-muted/40 p-3 text-xs leading-relaxed text-foreground">
                <p>Backup created: {createdAt ? formatDateTime(createdAt) : 'Unknown date'}</p>
                <p>Saved app records: {storageCount}</p>
                <p className="pt-1 text-muted-foreground">This replaces current portable app data. A rollback snapshot is kept during restore. Sign-in credentials and Android launcher placement are not replaced.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setCandidate(null)}
                  className="min-h-10 flex-1 rounded-xl border border-border px-3 text-sm font-semibold text-foreground disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleRestore()}
                  className="min-h-10 flex-1 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                  {busy === 'restoring' ? 'Restoring…' : 'Restore & Replace'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BackupRestorePanel;
