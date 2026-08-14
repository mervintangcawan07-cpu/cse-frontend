const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { validateCSV } = require('../validators/csv_validator');

const STATE_DIR = path.resolve(__dirname, '../state');
const PROGRESS_FILE = path.join(STATE_DIR, 'progress.json');
const GENERATED_DIR = path.resolve(__dirname, '../generated_questions');

function inspectAndRecoverState() {
  logger.info('RESUME', 'Inspecting workspace and state for safe continuation...');

  if (!fs.existsSync(PROGRESS_FILE)) {
    throw new Error('Progress file missing. Cannot resume safely.');
  }

  const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  const csvFiles = fs.existsSync(GENERATED_DIR)
    ? fs.readdirSync(GENERATED_DIR).filter(f => f.endsWith('.csv'))
    : [];

  const verifiedBatches = [];
  const corruptedFiles = [];

  for (const file of csvFiles) {
    const filePath = path.join(GENERATED_DIR, file);
    const match = file.match(/^batch_(\d+)_/i);
    const batchNum = match ? parseInt(match[1], 10) : null;

    const val = validateCSV(filePath, { requireExactBatchSize: true });
    if (val.isValid) {
      if (batchNum !== null) {
        verifiedBatches.push({ batchNumber: batchNum, fileName: file, filePath });
      }
    } else {
      corruptedFiles.push({ fileName: file, errors: val.errors });
    }
  }

  verifiedBatches.sort((a, b) => a.batchNumber - b.batchNumber);

  const highestVerifiedBatch = verifiedBatches.length > 0
    ? verifiedBatches[verifiedBatches.length - 1].batchNumber
    : 0;

  const nextBatchToGenerate = highestVerifiedBatch + 1;

  // Reconcile with progress.json
  const confirmedCompletedList = verifiedBatches.map(b => b.batchNumber);
  progress.completed_batches = confirmedCompletedList;
  progress.last_confirmed_completed_batch = highestVerifiedBatch > 0 ? highestVerifiedBatch : null;
  progress.total_completed_questions = confirmedCompletedList.length * 10;
  progress.total_generated_csv_files = confirmedCompletedList.length;

  if (progress.last_confirmed_completed_batch === null) {
    progress.generation_status = 'NOT_STARTED';
    progress.current_batch_status = 'NOT_STARTED';
    progress.current_batch_number = null;
  } else {
    progress.generation_status = 'READY_TO_CONTINUE';
    progress.current_batch_status = 'READY';
    progress.current_batch_number = nextBatchToGenerate;
  }

  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf8');

  logger.info('RESUME', `State reconciled: ${confirmedCompletedList.length} verified batches found. Next batch: #${nextBatchToGenerate}`);

  return {
    success: true,
    highestVerifiedBatch,
    nextBatchToGenerate,
    totalVerifiedQuestions: progress.total_completed_questions,
    corruptedFiles,
    progress
  };
}

module.exports = {
  inspectAndRecoverState
};
