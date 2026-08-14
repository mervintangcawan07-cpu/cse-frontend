const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const logger = require('../scripts/logger');

const EXPECTED_HEADERS = [
  'Question',
  'Option A',
  'Option B',
  'Option C',
  'Option D',
  'Correct Answer',
  'Explanation',
  'Elimination A',
  'Elimination B',
  'Elimination C',
  'Elimination D',
  'Category',
  'Tags'
];

const VALID_ANSWERS = new Set(['A', 'B', 'C', 'D']);
const REQUIRED_BATCH_SIZE = 10;

/**
 * Validates a CSV string or CSV file against the exact CSE 13-column, 10-record standard.
 */
function validateCSV(csvInput, options = {}) {
  const isFilePath = typeof csvInput === 'string' && fs.existsSync(csvInput);
  let csvText = '';

  if (isFilePath) {
    try {
      csvText = fs.readFileSync(csvInput, 'utf8');
    } catch (err) {
      return {
        isValid: false,
        errors: [`Cannot read CSV file: ${err.message}`],
        warnings: [],
        rowCount: 0,
        headers: []
      };
    }
  } else {
    csvText = String(csvInput || '');
  }

  if (!csvText.trim()) {
    return {
      isValid: false,
      errors: ['CSV content is empty.'],
      warnings: [],
      rowCount: 0,
      headers: []
    };
  }

  // Parse raw rows without header transformation to check exact column counts and structure
  const rawParsed = Papa.parse(csvText, {
    skipEmptyLines: 'greedy',
    quoteChar: '"',
    escapeChar: '"',
  });

  const errors = [];
  const warnings = [];

  if (rawParsed.errors && rawParsed.errors.length > 0) {
    for (const pErr of rawParsed.errors) {
      errors.push(`Parse error at row ${pErr.row}: ${pErr.message} (${pErr.code || 'UNKNOWN'})`);
    }
  }

  const rows = rawParsed.data;
  if (!rows || rows.length < 2) {
    errors.push(`CSV must contain a header row and at least 1 data row. Found ${rows ? rows.length : 0} rows.`);
    return {
      isValid: false,
      errors,
      warnings,
      rowCount: 0,
      headers: []
    };
  }

  // 1. Validate Header Row
  const headerRow = rows[0].map(h => (h || '').trim());
  if (headerRow.length !== 13) {
    errors.push(`Header row must have exactly 13 columns. Found ${headerRow.length} columns: [${headerRow.join(', ')}]`);
  } else {
    for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
      if (headerRow[i] !== EXPECTED_HEADERS[i]) {
        errors.push(`Header column ${i + 1} mismatch: Expected "${EXPECTED_HEADERS[i]}", but found "${headerRow[i]}"`);
      }
    }
  }

  // 2. Validate Row Count (Exactly 10 data rows for completed batches)
  const dataRows = rows.slice(1);
  const strictBatchSize = options.requireExactBatchSize ?? true;
  if (strictBatchSize && dataRows.length !== REQUIRED_BATCH_SIZE) {
    errors.push(`CSV batch must contain exactly ${REQUIRED_BATCH_SIZE} question records. Found ${dataRows.length} rows.`);
  }

  // 3. Validate Each Data Row (Columns 1 to 13)
  dataRows.forEach((row, idx) => {
    const rowNum = idx + 1;

    // Check column count on the row
    if (row.length !== 13) {
      errors.push(`Row ${rowNum}: Expected 13 columns, but found ${row.length} columns.`);
      return;
    }

    const [
      question,
      optA,
      optB,
      optC,
      optD,
      correctAns,
      explanation,
      elimA,
      elimB,
      elimC,
      elimD,
      category,
      tags
    ] = row.map(cell => (cell === null || cell === undefined) ? '' : String(cell).trim());

    // 1. Question prompt
    if (!question) {
      errors.push(`Row ${rowNum}: "Question" prompt is empty.`);
    }

    // 2-5. Four Options
    if (!optA) errors.push(`Row ${rowNum}: "Option A" is empty.`);
    if (!optB) errors.push(`Row ${rowNum}: "Option B" is empty.`);
    if (!optC) errors.push(`Row ${rowNum}: "Option C" is empty.`);
    if (!optD) errors.push(`Row ${rowNum}: "Option D" is empty.`);

    // 6. Correct Answer (Must be exact A, B, C, or D)
    const upperAns = correctAns.toUpperCase();
    if (!VALID_ANSWERS.has(upperAns)) {
      errors.push(`Row ${rowNum}: "Correct Answer" must be exactly A, B, C, or D. Found "${correctAns}".`);
    }

    // 7. Explanation
    if (!explanation) {
      errors.push(`Row ${rowNum}: "Explanation" is empty.`);
    }

    // 8-11. All 4 Elimination fields
    if (!elimA) errors.push(`Row ${rowNum}: "Elimination A" is empty.`);
    if (!elimB) errors.push(`Row ${rowNum}: "Elimination B" is empty.`);
    if (!elimC) errors.push(`Row ${rowNum}: "Elimination C" is empty.`);
    if (!elimD) errors.push(`Row ${rowNum}: "Elimination D" is empty.`);

    // 12. Category
    if (!category) {
      errors.push(`Row ${rowNum}: "Category" is empty.`);
    }

    // 13. Tags
    if (!tags) {
      errors.push(`Row ${rowNum}: "Tags" field is empty.`);
    }
  });

  const isValid = errors.length === 0;
  if (isValid) {
    logger.info('VALIDATION_SUCCESS', `CSV validation passed: ${dataRows.length} records verified.`);
  } else {
    logger.warn('VALIDATION_FAILURE', `CSV validation failed with ${errors.length} errors.`, { errors: errors.slice(0, 5) });
  }

  return {
    isValid,
    errors,
    warnings,
    rowCount: dataRows.length,
    headers: headerRow
  };
}

/**
 * Formats an array of 10 structured question objects into a standardized 13-column RFC-4180 CSV string.
 */
function serializeQuestionsToCSV(records) {
  const rows = records.map(r => ({
    'Question': r.Question || r.question || r.prompt || '',
    'Option A': r['Option A'] || r.optionA || r.option_a || '',
    'Option B': r['Option B'] || r.optionB || r.option_b || '',
    'Option C': r['Option C'] || r.optionC || r.option_c || '',
    'Option D': r['Option D'] || r.optionD || r.option_d || '',
    'Correct Answer': (r['Correct Answer'] || r.correctAnswer || r.answer || '').toUpperCase().trim(),
    'Explanation': r.Explanation || r.explanation || '',
    'Elimination A': r['Elimination A'] || r.eliminationA || r.whyA || '',
    'Elimination B': r['Elimination B'] || r.eliminationB || r.whyB || '',
    'Elimination C': r['Elimination C'] || r.eliminationC || r.whyC || '',
    'Elimination D': r['Elimination D'] || r.eliminationD || r.whyD || '',
    'Category': r.Category || r.category || '',
    'Tags': Array.isArray(r.Tags || r.tags) ? (r.Tags || r.tags).join(', ') : (r.Tags || r.tags || '')
  }));

  return Papa.unparse({
    fields: EXPECTED_HEADERS,
    data: rows
  }, {
    quotes: true,
    newline: '\r\n'
  });
}

module.exports = {
  EXPECTED_HEADERS,
  REQUIRED_BATCH_SIZE,
  VALID_ANSWERS,
  validateCSV,
  serializeQuestionsToCSV
};
