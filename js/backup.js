import { getAll, clearAllStores, putOne, STORE_NAMES } from "./database.js";

const BACKUP_VERSION = 1;

export async function exportBackup() {
  const data = {};
  for (const storeName of STORE_NAMES) {
    data[storeName] = await getAll(storeName);
  }

  const backup = {
    app: "money-tracker",
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateStamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `money-tracker-backup-${dateStamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Confirms the parsed file at least looks like a backup we can trust. */
export function validateBackupShape(parsed) {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("This file isn't a valid backup.");
  }
  if (parsed.app !== "money-tracker") {
    throw new Error("This file wasn't created by Money Tracker.");
  }
  if (!parsed.data || typeof parsed.data !== "object") {
    throw new Error("This backup file is missing its data.");
  }
  for (const storeName of STORE_NAMES) {
    if (parsed.data[storeName] && !Array.isArray(parsed.data[storeName])) {
      throw new Error(`The "${storeName}" section of this backup looks corrupted.`);
    }
  }
  return true;
}

/** Reads a File object (from an <input type="file">) and parses it as JSON. */
export async function readBackupFile(file) {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("This file isn't valid JSON.");
  }
  validateBackupShape(parsed);
  return parsed;
}

/** Replaces ALL current data with the contents of a validated backup. */
export async function restoreBackup(parsedBackup) {
  await clearAllStores();
  for (const storeName of STORE_NAMES) {
    const records = parsedBackup.data[storeName] || [];
    for (const record of records) {
      await putOne(storeName, record);
    }
  }
}
