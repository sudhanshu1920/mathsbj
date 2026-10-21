# Backup & Restore

Math Master exports a versioned `.mathbackup` JSON envelope with app version, UTC creation timestamp, backup-format and data-schema versions, deterministic saved records and a SHA-256 checksum. It captures app-owned `math-app-*` storage records plus supported standalone preferences in one synchronous Web Storage pass. Authentication/session keys, cloud sync-account metadata, caches, temporary/offline-ready flags, guest mode and the last-backup UI status are excluded.

On Android, Create Backup uses the Storage Access Framework destination picker and Restore Backup uses the system document picker; no broad external-storage permission is requested. Browser/PWA installations download the same format and use the browser file picker. The payload includes validated supported launcher-widget global and per-instance customization. Android controls pinned IDs and placement, so restore maps saved preferences onto widgets currently installed on the device rather than trying to recreate launcher placement.

Restore validates format/schema versions, record sizes, app storage key allowlists, key records and widget preferences before confirmation. SHA-256 integrity is checked before writing. The current portable app records and native widget preferences are snapshotted for rollback; localStorage writes are read-back verified and failures trigger rollback attempts.

Sign-in credentials, passwords, cloud account identity/sync metadata, OS notification grants, launcher placement and files outside app-owned Web Storage/the supported widget preference store are not backed up. SHA-256 detects accidental corruption but is not a signature or proof that a file is trusted.
