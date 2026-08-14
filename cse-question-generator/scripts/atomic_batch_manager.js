const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { validateCSV, serializeQuestionsToCSV, REQUIRED_BATCH_SIZE } = require('../validators/csv_validator');
const { normalizeScopeKey, checkDuplicateInScope, registerQuestionsToScope } = require('../validators/duplicate_detector');
const { createStateBackup } = require('./backup_manager');

const STATE_DIR = path.resolve(__dirname, '../state');
const PROGRESS_FILE = path.join(STATE_DIR, 'progress.json');
const GENERATED_DIR = path.resolve(__dirname, '../generated_questions');

if (!fs.existsSync(GENERATED_DIR)) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

function loadProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) {
    throw new Error(`Progress file does not exist at ${PROGRESS_FILE}`);
  }
  return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
}

function saveProgress(progress) {
  progress.last_update = new Date().toISOString();
  const tmpPath = `${PROGRESS_FILE}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(progress, null, 2), 'utf8');
  fs.renameSync(tmpPath, PROGRESS_FILE);
  logger.info('PROGRESS_UPDATE', `Progress saved: batch=${progress.current_batch_number}, total=${progress.total_completed_questions} questions`);
}

/**
 * Executes atomic batch completion process.
 */
function processBatchCompletion({
  batchNumber,
  batchId,
  category,
  component,
  subtopic,
  microSubtopic,
  questions,
  modelName = 'Gemini 3.6 Flash'
}) {
  logger.info('BATCH_STARTED', `Starting processing for Batch #${batchNumber} (${batchId})`);

  // 1. Check Questions Array Length
  if (!Array.isArray(questions) || questions.length !== REQUIRED_BATCH_SIZE) {
    const msg = `Batch ${batchNumber} failed: Expected exactly ${REQUIRED_BATCH_SIZE} questions, but received ${questions ? questions.length : 0}`;
    logger.error('BATCH_ERROR', msg);
    return { success: false, error: msg };
  }

  // 2. Micro-Subtopic Scoped Duplicate Check
  const scopeKey = normalizeScopeKey(category, component, subtopic, microSubtopic);
  for (let i = 0; i < questions.length; i++) {
    const qText = questions[i].Question || questions[i].prompt || questions[i].question;
    const dupCheck = checkDuplicateInScope(qText, scopeKey);
    if (dupCheck.isDuplicate) {
      const msg = `Duplicate detected in question #${i + 1} for scope [${scopeKey}]: ${dupCheck.reason}`;
      logger.warn('DUPLICATE_REJECTION', msg, { prompt: qText.slice(0, 100), scopeKey });
      return { success: false, error: msg, duplicateScope: scopeKey };
    }
  }

  // 3. Serialize and Write CSV
  const csvContent = serializeQuestionsToCSV(questions);
  const fileName = `batch_${String(batchNumber).padStart(3, '0')}_${scopeKey}.csv`;
  const filePath = path.join(GENERATED_DIR, fileName);

  try {
    fs.writeFileSync(filePath, csvContent, 'utf8');
  } catch (err) {
    const msg = `Failed to write CSV file ${fileName}: ${err.message}`;
    logger.error('BATCH_ERROR', msg);
    return { success: false, error: msg };
  }

  // 4. Reopen and Validate Written CSV File
  const validationResult = validateCSV(filePath, { requireExactBatchSize: true });
  if (!validationResult.isValid) {
    // Validation failed: Remove the invalid file and abort batch completion
    try {
      fs.unlinkSync(filePath);
    } catch {}
    const msg = `Batch ${batchNumber} validation failed: ${validationResult.errors.join('; ')}`;
    logger.error('VALIDATION_FAILURE', msg);
    return { success: false, error: msg, errors: validationResult.errors };
  }

  // 5. Update Micro-Subtopic Exclusion Record
  registerQuestionsToScope(questions, scopeKey);

  // 6. Update Progress State Atomically
  const progress = loadProgress();
  progress.generation_status = 'IN_PROGRESS';
  progress.current_category = category;
  progress.current_component = component;
  progress.current_subtopic = subtopic;
  progress.current_micro_subtopic = microSubtopic;
  progress.current_batch_number = batchNumber;
  progress.current_batch_id = batchId;
  progress.current_batch_status = 'COMPLETED';
  progress.last_confirmed_completed_batch = batchNumber;
  
  if (!progress.completed_batches.includes(batchNumber)) {
    progress.completed_batches.push(batchNumber);
  }

  const microKey = `${category} > ${component} > ${subtopic} > ${microSubtopic}`;
  if (!progress.completed_micro_subtopics.includes(microKey)) {
    // Only mark micro-subtopic completed if fully done per taxonomy
  }

  progress.total_completed_questions = progress.completed_batches.length * REQUIRED_BATCH_SIZE;
  progress.total_generated_csv_files = progress.completed_batches.length;
  progress.current_model = modelName;
  progress.last_successful_file = fileName;
  progress.last_error = null;

  saveProgress(progress);

  // 7. Auto Backup
  createStateBackup(`batch_${batchNumber}`);

  logger.info('BATCH_COMPLETED', `Batch #${batchNumber} successfully completed and verified: ${fileName}`);

  return {
    success: true,
    batchNumber,
    batchId,
    fileName,
    filePath,
    questionsCount: questions.length,
    totalQuestions: progress.total_completed_questions
  };
}

module.exports = {
  loadProgress,
  saveProgress,
  processBatchCompletion,
  GENERATED_DIR,
  PROGRESS_FILE
};
