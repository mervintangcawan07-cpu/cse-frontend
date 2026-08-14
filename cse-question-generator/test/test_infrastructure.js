/**
 * CSE-PPT Generator Infrastructure Test Suite
 * STRICTLY USES SYNTHETIC TEST DUMMY DATA.
 * DOES NOT GENERATE REAL CSE QUESTIONS.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const logger = require('../scripts/logger');
const { validateCSV, serializeQuestionsToCSV, EXPECTED_HEADERS } = require('../validators/csv_validator');
const {
  normalizeScopeKey,
  computeHash,
  loadScopeExclusions,
  saveScopeExclusions,
  checkDuplicateInScope,
  registerQuestionsToScope,
  EXCLUSIONS_DIR
} = require('../validators/duplicate_detector');
const { createStateBackup, listBackups } = require('../scripts/backup_manager');
const { processBatchCompletion, loadProgress, saveProgress, PROGRESS_FILE, GENERATED_DIR } = require('../scripts/atomic_batch_manager');
const { inspectAndRecoverState } = require('../scripts/resume_manager');
const { handleModelExhaustion, recordModelResume } = require('../scripts/model_fallback_manager');

function generateSyntheticDummyBatch(batchIndex = 1, scopeName = "SYNTHETIC_TEST") {
  const records = [];
  for (let i = 1; i <= 10; i++) {
    records.push({
      'Question': `[SYNTHETIC DUMMY TEST ONLY ${batchIndex}-${i}] What is the mock placeholder value for property X in unit test ${i}?`,
      'Option A': `[SYNTHETIC] Mock Alpha Value ${i}`,
      'Option B': `[SYNTHETIC] Mock Beta Value ${i}`,
      'Option C': `[SYNTHETIC] Mock Gamma Value ${i}`,
      'Option D': `[SYNTHETIC] Mock Delta Value ${i}`,
      'Correct Answer': ['A', 'B', 'C', 'D'][(i - 1) % 4],
      'Explanation': `[SYNTHETIC] Step-by-step mock explanation for unit test item ${i}.`,
      'Elimination A': `[SYNTHETIC] Option A mock elimination reasoning for item ${i}.`,
      'Elimination B': `[SYNTHETIC] Option B mock elimination reasoning for item ${i}.`,
      'Elimination C': `[SYNTHETIC] Option C mock elimination reasoning for item ${i}.`,
      'Elimination D': `[SYNTHETIC] Option D mock elimination reasoning for item ${i}.`,
      'Category': `SYNTHETIC_CATEGORY_${scopeName}`,
      'Tags': `mock_tag_1, mock_tag_2, test_${i}`
    });
  }
  return records;
}

const testResults = [];

function runTest(name, fn) {
  try {
    fn();
    testResults.push({ name, status: 'PASS' });
    console.log(`  ✅ PASS: ${name}`);
  } catch (err) {
    testResults.push({ name, status: 'FAIL', error: err.message });
    console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
  }
}

console.log("\n============================================================");
console.log("RUNNING CSE GENERATOR PRE-FLIGHT INFRASTRUCTURE TESTS");
console.log("============================================================\n");

// 1. JSON Validity Test
runTest("JSON Validity of state/progress.json and state/generation_profile.json", () => {
  const progressPath = path.resolve(__dirname, '../state/progress.json');
  const profilePath = path.resolve(__dirname, '../state/generation_profile.json');

  assert(fs.existsSync(progressPath), "progress.json exists");
  assert(fs.existsSync(profilePath), "generation_profile.json exists");

  const progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

  assert.strictEqual(progress.version, "3.0", "progress version is 3.0");
  assert.strictEqual(profile.version, "3.0", "profile version is 3.0");
  assert.strictEqual(profile.csv_specification.required_columns_count, 13, "Profile specifies 13 columns");
});

// 2. CSV Serialization & Header Verification
runTest("CSV Serialization produces exact 13 headers and RFC-4180 quotes", () => {
  const dummyQuestions = generateSyntheticDummyBatch(1);
  const csvText = serializeQuestionsToCSV(dummyQuestions);

  const lines = csvText.split(/\r?\n/).filter(l => l.trim() !== '');
  assert.strictEqual(lines.length, 11, "CSV contains 1 header line + 10 data lines");

  const headers = lines[0].replace(/"/g, '').split(',');
  assert.strictEqual(headers.length, 13, "Exactly 13 headers present");
  assert.deepStrictEqual(headers, EXPECTED_HEADERS, "Headers match expected column names exactly");
});

// 3. CSV Validation - Valid 10-item batch
runTest("CSV Validator accepts perfectly structured 13-column, 10-record synthetic batch", () => {
  const dummyQuestions = generateSyntheticDummyBatch(1);
  const csvText = serializeQuestionsToCSV(dummyQuestions);
  const result = validateCSV(csvText, { requireExactBatchSize: true });

  assert.strictEqual(result.isValid, true, "Validation should pass for valid synthetic batch");
  assert.strictEqual(result.rowCount, 10, "Row count is exactly 10");
  assert.strictEqual(result.errors.length, 0, "Zero validation errors");
});

// 4. CSV Validation - Incomplete batch (9 items)
runTest("CSV Validator rejects batch with fewer than 10 records", () => {
  const dummyQuestions = generateSyntheticDummyBatch(1).slice(0, 9);
  const csvText = serializeQuestionsToCSV(dummyQuestions);
  const result = validateCSV(csvText, { requireExactBatchSize: true });

  assert.strictEqual(result.isValid, false, "Validation should fail for 9 items");
  assert(result.errors.some(e => e.includes("must contain exactly 10")), "Error message mentions 10 records requirement");
});

// 5. CSV Validation - Invalid Answer & Missing Field
runTest("CSV Validator catches invalid answer letters and missing explanations", () => {
  const dummyQuestions = generateSyntheticDummyBatch(1);
  dummyQuestions[0]['Correct Answer'] = 'E'; // Invalid
  dummyQuestions[1]['Explanation'] = ''; // Missing
  dummyQuestions[2]['Elimination C'] = ''; // Missing elimination

  const csvText = serializeQuestionsToCSV(dummyQuestions);
  const result = validateCSV(csvText, { requireExactBatchSize: true });

  assert.strictEqual(result.isValid, false, "Validation must fail for bad answer/missing fields");
  assert(result.errors.some(e => e.includes("must be exactly A, B, C, or D")), "Catches invalid answer");
  assert(result.errors.some(e => e.includes('"Explanation" is empty')), "Catches empty explanation");
  assert(result.errors.some(e => e.includes('"Elimination C" is empty')), "Catches empty elimination");
});

// 6. Micro-Subtopic Scoped Duplicate Prevention
runTest("Duplicate Detection correctly identifies exact & normalized duplicates within micro-subtopic scope", () => {
  const testScope = "SYNTHETIC-TEST-SCOPE-A";
  const dummyQuestions = generateSyntheticDummyBatch(1, "SCOPE_A");

  // Initial check: should not be duplicate
  const initialCheck = checkDuplicateInScope(dummyQuestions[0].Question, testScope);
  assert.strictEqual(initialCheck.isDuplicate, false, "Not duplicate initially");

  // Register questions
  registerQuestionsToScope(dummyQuestions, testScope);

  // Second check: exact duplicate must be caught
  const secondCheck = checkDuplicateInScope(dummyQuestions[0].Question, testScope);
  assert.strictEqual(secondCheck.isDuplicate, true, "Exact duplicate detected");
  assert.strictEqual(secondCheck.reason, "EXACT_HASH_MATCH", "Matched exact hash");

  // Third check: modified whitespace / casing duplicate must be caught
  const alteredText = dummyQuestions[0].Question.toUpperCase() + "   ";
  const thirdCheck = checkDuplicateInScope(alteredText, testScope);
  assert.strictEqual(thirdCheck.isDuplicate, true, "Normalized duplicate detected");

  // Cross-scope independence check: different scope must NOT be blocked
  const differentScope = "SYNTHETIC-TEST-SCOPE-B";
  const crossScopeCheck = checkDuplicateInScope(dummyQuestions[0].Question, differentScope);
  assert.strictEqual(crossScopeCheck.isDuplicate, false, "Cross-scope does not block unrelated scope");
});

// 7. Atomic Batch Completion Workflow
runTest("Atomic Batch Completion writes CSV, validates, registers exclusions, and creates backups", () => {
  const dummyBatch = generateSyntheticDummyBatch(999, "ATOMIC_TEST");
  const testScope = {
    batchNumber: 999,
    batchId: "TEST-BATCH-999",
    category: "SYNTHETIC_VERBAL",
    component: "SYNTHETIC_READING",
    subtopic: "SYNTHETIC_CAUSE",
    microSubtopic: "SYNTHETIC_EFFECT",
    questions: dummyBatch
  };

  const res = processBatchCompletion(testScope);
  assert.strictEqual(res.success, true, "Atomic batch completed successfully");
  assert(fs.existsSync(res.filePath), "Generated CSV file exists on disk");

  const progress = loadProgress();
  assert.strictEqual(progress.last_confirmed_completed_batch, 999, "Progress updated with completed batch");
  assert.strictEqual(progress.current_batch_status, "COMPLETED", "Current batch status is COMPLETED");

  const backups = listBackups();
  assert(backups.length > 0, "Auto-backup created");
  assert(backups[0].includes("batch_999"), "Backup folder tagged with batch number");

  // Clean up test batch file
  if (fs.existsSync(res.filePath)) fs.unlinkSync(res.filePath);
});

// 8. Logging and Secret Sanitization
runTest("Logging logs events securely without recording secrets or sensitive tokens", () => {
  const secretPassword = "mySuperSecretPassword999";
  const secretBearer = "abc999def888ghi777";
  logger.info("TEST_EVENT", `Test log with secret token: bearer ${secretBearer} and password: ${secretPassword}`);
  const logLines = fs.readFileSync(logger.LOG_FILE, 'utf8').trim().split('\n');
  const lastLine = logLines[logLines.length - 1];

  assert(lastLine.includes("[TEST_EVENT]"), "Log contains event type");
  assert(!lastLine.includes(secretPassword), "Password was sanitized");
  assert(!lastLine.includes(secretBearer), "Bearer token was sanitized");
  assert(lastLine.includes("[REDACTED_SECRET]"), "Redaction placeholder inserted");
});

// 9. Interruption and Incomplete Batch Recovery
runTest("Resume Manager reconciles verified batches and handles corrupted/incomplete files", () => {
  // Create an incomplete/corrupted file in generated_questions
  const corruptedFile = path.join(GENERATED_DIR, "batch_998_CORRUPTED.csv");
  fs.writeFileSync(corruptedFile, "Question,Option A\nIncomplete Row\n", 'utf8');

  const recovery = inspectAndRecoverState();
  assert.strictEqual(recovery.success, true, "Recovery inspection succeeded");
  assert(recovery.corruptedFiles.some(f => f.fileName.includes("batch_998")), "Corrupted file identified");

  // Clean up corrupted file
  if (fs.existsSync(corruptedFile)) fs.unlinkSync(corruptedFile);
});

// 10. Model Fallback and Safe Pause/Resume
runTest("Model Fallback transitions safely to PAUSED / MODEL_LIMIT without losing state", () => {
  const pauseRes = handleModelExhaustion("Synthetic quota limit reached");
  assert.strictEqual(pauseRes.status, "PAUSED", "State transitioned to PAUSED");

  const progress = loadProgress();
  assert.strictEqual(progress.generation_status, "PAUSED", "generation_status is PAUSED");
  assert.strictEqual(progress.current_batch_status, "MODEL_LIMIT", "current_batch_status is MODEL_LIMIT");

  const resumed = recordModelResume();
  assert.strictEqual(resumed.generation_status, "IN_PROGRESS", "Resumed to IN_PROGRESS");
});

// Reset progress state back to clean initial NOT_STARTED state
const initialCleanProgress = {
  "version": "3.0",
  "generation_status": "NOT_STARTED",
  "current_category": null,
  "current_component": null,
  "current_subtopic": null,
  "current_micro_subtopic": null,
  "current_batch_number": null,
  "current_batch_id": null,
  "current_batch_status": "NOT_STARTED",
  "last_confirmed_completed_batch": null,
  "completed_batches": [],
  "completed_micro_subtopics": [],
  "total_completed_questions": 0,
  "total_generated_csv_files": 0,
  "current_model": null,
  "available_models": [],
  "exhausted_models": [],
  "last_successful_file": null,
  "last_error": null,
  "last_update": null
};

fs.writeFileSync(PROGRESS_FILE, JSON.stringify(initialCleanProgress, null, 2), 'utf8');

// Clean up any test exclusion files created in test scope
const testExclusionA = path.join(EXCLUSIONS_DIR, "SYNTHETIC-TEST-SCOPE-A.json");
const testExclusionB = path.join(EXCLUSIONS_DIR, "SYNTHETIC-TEST-SCOPE-B.json");
const testExclusionAtomic = path.join(EXCLUSIONS_DIR, "SYNTHETIC_VERBAL-SYNTHETIC_READING-SYNTHETIC_CAUSE-SYNTHETIC_EFFECT.json");
if (fs.existsSync(testExclusionA)) fs.unlinkSync(testExclusionA);
if (fs.existsSync(testExclusionB)) fs.unlinkSync(testExclusionB);
if (fs.existsSync(testExclusionAtomic)) fs.unlinkSync(testExclusionAtomic);

console.log("\n============================================================");
const passedCount = testResults.filter(t => t.status === 'PASS').length;
const totalCount = testResults.length;
console.log(`TEST SUMMARY: ${passedCount}/${totalCount} INFRASTRUCTURE TESTS PASSED.`);
console.log("PROGRESS STATE SAFELY RESET TO CLEAN INITIAL 'NOT_STARTED' STATE.");
console.log("REAL CSE QUESTIONS GENERATED: 0");
console.log("============================================================\n");
