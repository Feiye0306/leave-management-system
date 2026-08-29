const STORAGE_KEY = 'leave_system_last_backup';
const BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 Days

export const AutoBackupService = {
    /**
     * Records the current timestamp as the last backup time.
     */
    recordBackup: () => {
        localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    },

    /**
     * Checks if a backup is needed.
     * Returns true if last backup was > 7 days ago.
     */
    needsBackup: (): boolean => {
        const lastBackup = localStorage.getItem(STORAGE_KEY);
        if (!lastBackup) return true; // Never backed up

        const lastDate = new Date(lastBackup).getTime();
        const now = new Date().getTime();

        return (now - lastDate) > BACKUP_INTERVAL_MS;
    },

    /**
     * Checks needsBackup and runs the callback if true.
     * Also manages a "snooze" mechanism (session based) so we don't spam the user on every refresh.
     */
    checkAndRemind: (remindCallback: () => void) => {
        // Check if we already reminded in this session
        if (sessionStorage.getItem('backup_reminded')) return;

        if (AutoBackupService.needsBackup()) {
            remindCallback();
            sessionStorage.setItem('backup_reminded', 'true');
        }
    },

    getLastBackupDate: (): string | null => {
        return localStorage.getItem(STORAGE_KEY);
    }
};
