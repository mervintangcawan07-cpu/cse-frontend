const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const STATE_DIR = path.resolve(__dirname, '../state');
const BACKUPS_DIR = path.resolve(__dirname, '../backups');

if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

function getTimestampString() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function createStateBackup(tag = 'auto') {
  const ts = getTimestampString();
  const backupFolder = path.join(BACKUPS_DIR, `backup_${ts}_${tag}`);

  try {
    fs.mkdirSync(backupFolder, { recursive: true });

    // 1. Backup progress.json
    const progressFile = path.join(STATE_DIR, 'progress.json');
    if (fs.existsSync(progressFile)) {
      fs.copyFileSync(progressFile, path.join(backupFolder, 'progress.json'));
    }

    // 2. Backup generation_profile.json
    const profileFile = path.join(STATE_DIR, 'generation_profile.json');
    if (fs.existsSync(profileFile)) {
      fs.copyFileSync(profileFile, path.join(backupFolder, 'generation_profile.json'));
    }

    // 3. Backup exclusions if any
    const exclusionsSrc = path.join(STATE_DIR, 'exclusions');
    if (fs.existsSync(exclusionsSrc)) {
      const exclusionsDest = path.join(backupFolder, 'exclusions');
      fs.mkdirSync(exclusionsDest, { recursive: true });
      const files = fs.readdirSync(exclusionsSrc);
      for (const f of files) {
        if (f.endsWith('.json')) {
          fs.copyFileSync(path.join(exclusionsSrc, f), path.join(exclusionsDest, f));
        }
      }
    }

    logger.info('BACKUP_CREATED', `State backup successfully created: ${backupFolder}`);
    return { success: true, backupFolder, timestamp: ts };
  } catch (err) {
    logger.error('BACKUP_ERROR', `Failed to create backup: ${err.message}`);
    return { success: false, error: err.message };
  }
}

function listBackups() {
  if (!fs.existsSync(BACKUPS_DIR)) return [];
  const entries = fs.readdirSync(BACKUPS_DIR, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory() && e.name.startsWith('backup_'))
    .map(e => e.name)
    .sort()
    .reverse();
}

module.exports = {
  createStateBackup,
  listBackups,
  BACKUPS_DIR
};
