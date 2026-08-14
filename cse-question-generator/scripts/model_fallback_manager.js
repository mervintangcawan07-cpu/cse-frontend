const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { loadProgress, saveProgress } = require('./atomic_batch_manager');
const { createStateBackup } = require('./backup_manager');

// In the current Antigravity environment, the active model is Gemini 3.6 Flash / Gemini Pro
const DEFAULT_MODEL_CONFIG = {
  active_model_index: 0,
  models: [
    {
      id: "gemini-3.6-flash",
      name: "Gemini 3.6 Flash",
      tier: "PRIMARY",
      rate_limit_rpm: 15,
      enabled: true
    }
  ]
};

function handleModelExhaustion(reason = 'Rate limit reached or quota exhausted') {
  logger.warn('MODEL_LIMIT', `Model capacity exhausted: ${reason}`);

  try {
    const progress = loadProgress();
    progress.generation_status = 'PAUSED';
    progress.current_batch_status = 'MODEL_LIMIT';
    progress.last_error = `Generation paused: ${reason}`;
    
    saveProgress(progress);
    createStateBackup('model_limit_pause');

    logger.info('PAUSE', 'Generator safely paused due to model limit. State and backups preserved.');
    return {
      status: 'PAUSED',
      reason,
      safeToResume: true
    };
  } catch (err) {
    logger.error('MODEL_FALLBACK_ERROR', `Failed during fallback pause: ${err.message}`);
    return {
      status: 'ERROR',
      error: err.message
    };
  }
}

function recordModelResume() {
  logger.info('RESUME', 'Resuming generator from paused state...');
  const progress = loadProgress();
  if (progress.generation_status === 'PAUSED') {
    progress.generation_status = 'IN_PROGRESS';
    progress.current_batch_status = 'READY';
    progress.last_error = null;
    saveProgress(progress);
  }
  return progress;
}

module.exports = {
  DEFAULT_MODEL_CONFIG,
  handleModelExhaustion,
  recordModelResume
};
