-- ==============================================================================
-- GOVSTUDYX: QUESTION BANKTYPE BACKFILL SCRIPT (NON-AUTOMATIC)
-- ==============================================================================
-- SAFETY NOTICE:
-- This script must be run MANUALLY during Stage 3 of rolling deployment.
-- It is idempotent: both UPDATE statements strictly filter on "bankType" IS NULL
-- to ensure that explicit bank ownership set by new application writers is never overwritten.
-- DO NOT execute automatically in CI/CD or during initial application boot.
-- ==============================================================================

-- STEP 1: Assign ELIMINATION to all legacy rows matching historical elimination classification
UPDATE "Question"
SET "bankType" = 'ELIMINATION'::"QuestionBankType"
WHERE "bankType" IS NULL
  AND (
    LOWER(category) = 'elimination drill'
    OR LOWER(subtopic) LIKE '%elimination drill%'
  );

-- STEP 2: Assign ORDINARY to all remaining legacy rows with NULL bankType
UPDATE "Question"
SET "bankType" = 'ORDINARY'::"QuestionBankType"
WHERE "bankType" IS NULL;

-- ==============================================================================
-- READ-ONLY VERIFICATION SQL
-- ==============================================================================

-- 1. Total Question rows vs bank counts
SELECT
  COUNT(*) AS total_questions,
  COUNT(CASE WHEN "bankType" = 'ORDINARY' THEN 1 END) AS ordinary_count,
  COUNT(CASE WHEN "bankType" = 'ELIMINATION' THEN 1 END) AS elimination_count,
  COUNT(CASE WHEN "bankType" IS NULL THEN 1 END) AS null_banktype_count
FROM "Question";

-- 2. Verify zero NULL bankType rows (MUST BE 0 after backfill)
SELECT COUNT(*) AS unclassified_questions
FROM "Question"
WHERE "bankType" IS NULL;

-- 3. Verify legacy-null elimination candidates (MUST BE 0 after backfill)
SELECT COUNT(*) AS lingering_legacy_elimination
FROM "Question"
WHERE "bankType" IS NULL
  AND (
    LOWER(category) = 'elimination drill'
    OR LOWER(subtopic) LIKE '%elimination drill%'
  );

-- 4. Audit discrepancies: explicit bankType vs legacy string classifier
SELECT
  "bankType",
  COUNT(*) AS count,
  CASE
    WHEN "bankType" = 'ORDINARY' AND (LOWER(category) = 'elimination drill' OR LOWER(subtopic) LIKE '%elimination drill%')
      THEN 'ORDINARY_WITH_ELIMINATION_STRINGS'
    WHEN "bankType" = 'ELIMINATION' AND NOT (LOWER(category) = 'elimination drill' OR LOWER(subtopic) LIKE '%elimination drill%')
      THEN 'ELIMINATION_WITHOUT_ELIMINATION_STRINGS'
    ELSE 'ALIGNED'
  END AS classification_status
FROM "Question"
GROUP BY "bankType", classification_status
ORDER BY "bankType", classification_status;
