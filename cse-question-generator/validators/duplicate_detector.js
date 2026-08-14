const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../scripts/logger');

const EXCLUSIONS_DIR = path.resolve(__dirname, '../state/exclusions');

if (!fs.existsSync(EXCLUSIONS_DIR)) {
  fs.mkdirSync(EXCLUSIONS_DIR, { recursive: true });
}

function normalizeScopeKey(category, component, subtopic, microSubtopic) {
  const parts = [
    category || 'GEN',
    component || 'COMP',
    subtopic || 'SUB',
    microSubtopic || 'MICRO'
  ];
  return parts
    .map(p => p.toString().trim().replace(/[^a-zA-Z0-9_-]/g, '_'))
    .join('-');
}

function normalizeText(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function computeHash(text) {
  const normalized = normalizeText(text);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function getExclusionFilePath(scopeKey) {
  const filename = `${scopeKey}.json`;
  return path.join(EXCLUSIONS_DIR, filename);
}

function loadScopeExclusions(scopeKey) {
  const filePath = getExclusionFilePath(scopeKey);
  if (!fs.existsSync(filePath)) {
    return {
      scope_key: scopeKey,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      total_recorded_questions: 0,
      hashes: [],
      records: []
    };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    logger.error('EXCLUSION_LOAD_ERROR', `Failed to load exclusion file for ${scopeKey}: ${err.message}`);
    return {
      scope_key: scopeKey,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      total_recorded_questions: 0,
      hashes: [],
      records: []
    };
  }
}

function saveScopeExclusions(scopeKey, exclusionData) {
  const filePath = getExclusionFilePath(scopeKey);
  exclusionData.updated_at = new Date().toISOString();
  exclusionData.total_recorded_questions = exclusionData.hashes.length;
  
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(exclusionData, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function checkDuplicateInScope(questionText, scopeKey) {
  const exclusions = loadScopeExclusions(scopeKey);
  const hash = computeHash(questionText);
  const normalized = normalizeText(questionText);

  if (exclusions.hashes.includes(hash)) {
    return {
      isDuplicate: true,
      reason: 'EXACT_HASH_MATCH',
      hash,
      scopeKey
    };
  }

  // Also check normalized text match
  const textMatch = exclusions.records.find(r => r.normalized === normalized);
  if (textMatch) {
    return {
      isDuplicate: true,
      reason: 'NORMALIZED_TEXT_MATCH',
      hash,
      scopeKey,
      matchedId: textMatch.id
    };
  }

  return {
    isDuplicate: false,
    hash,
    normalized,
    scopeKey
  };
}

function registerQuestionsToScope(questions, scopeKey) {
  const exclusions = loadScopeExclusions(scopeKey);
  let addedCount = 0;

  for (const q of questions) {
    const prompt = q.Question || q.prompt || q.question;
    const hash = computeHash(prompt);
    const normalized = normalizeText(prompt);

    if (!exclusions.hashes.includes(hash)) {
      exclusions.hashes.push(hash);
      exclusions.records.push({
        id: q.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        hash,
        normalized: normalized.slice(0, 150),
        added_at: new Date().toISOString()
      });
      addedCount++;
    }
  }

  saveScopeExclusions(scopeKey, exclusions);
  return { addedCount, total: exclusions.hashes.length };
}

module.exports = {
  normalizeScopeKey,
  normalizeText,
  computeHash,
  loadScopeExclusions,
  saveScopeExclusions,
  checkDuplicateInScope,
  registerQuestionsToScope,
  EXCLUSIONS_DIR
};
