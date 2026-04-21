import fs from 'fs';
import path from 'path';
import { getDatabasePath } from '../models/database';

function getLogFilePath(): string {
  const dataDir = path.dirname(getDatabasePath());
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'ctf.log');
}

export function logAction(event: string, details?: string): void {
  const logFile = getLogFilePath();
  const timestamp = new Date().toISOString();
  const payload = details && details.trim().length > 0 ? `${timestamp} | ${event} | ${details}` : `${timestamp} | ${event}`;
  fs.appendFile(logFile, `${payload}\n`, (err) => {
    if (err) {
      console.error('Failed to write ctf action log:', err);
    }
  });
  console.log(payload);
}

