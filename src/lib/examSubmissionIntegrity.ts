// Relative Path: src/lib/examSubmissionIntegrity.ts
import { createHash } from "crypto";

export interface CanonicalAnswerEntry {
  questionId: string;
  selectedIndex: number; // -1 | 0 | 1 | 2 | 3
}

export interface CanonicalSubmissionStructure {
  attemptId: string;
  answers: CanonicalAnswerEntry[];
}

export interface VerifiedAttemptInput {
  attemptId: string;
  questionIds: string[];
  itemCount: number;
}

export interface ValidateSubmissionManifestInput {
  verifiedAttempt: VerifiedAttemptInput;
  answers: any;
}

export type SubmissionManifestValidationResult =
  | {
      valid: true;
      canonicalAnswers: CanonicalAnswerEntry[];
      submissionHash: string;
    }
  | {
      valid: false;
      error: string;
      code: "INVALID_ATTEMPT_MANIFEST" | "INVALID_ANSWER_PAYLOAD";
    };

/**
 * Computes a deterministic canonical SHA-256 fingerprint for an exam submission.
 *
 * Excludes non-authoritative client fields (totalItems, selectedOption, score,
 * timestamps, client hashes, presentation metadata).
 *
 * Returns a 64-character lowercase hexadecimal SHA-256 digest.
 */
export function computeSubmissionHash(
  attemptId: string,
  canonicalAnswers: CanonicalAnswerEntry[]
): string {
  const canonicalStructure: CanonicalSubmissionStructure = {
    attemptId,
    answers: canonicalAnswers,
  };
  return createHash("sha256")
    .update(JSON.stringify(canonicalStructure), "utf8")
    .digest("hex")
    .toLowerCase();
}

/**
 * Validates submitted exam answers against the cryptographically verified attempt manifest:
 * 1. Verified attempt structure and consistency (itemCount === questionIds.length).
 * 2. Answers array validation (is an array, length exactly matches itemCount).
 * 3. Exact ordered question matching: answers[i].questionId === verifiedAttempt.questionIds[i].
 * 4. selectedIndex validation: integer in [-1, 0, 1, 2, 3].
 *    -1 = skipped
 *     0 = A
 *     1 = B
 *     2 = C
 *     3 = D
 * 5. SelectedOption is strictly ignored as non-authoritative.
 * 6. Generates canonical answers and computes the authoritative submission hash.
 *
 * Pure function: no database, no network, no cookies, no environment secrets.
 */
export function validateAndCanonicalizeSubmission(
  input: ValidateSubmissionManifestInput
): SubmissionManifestValidationResult {
  const { verifiedAttempt, answers } = input;

  if (
    !verifiedAttempt ||
    typeof verifiedAttempt !== "object" ||
    typeof verifiedAttempt.attemptId !== "string" ||
    !verifiedAttempt.attemptId.trim() ||
    !Array.isArray(verifiedAttempt.questionIds) ||
    typeof verifiedAttempt.itemCount !== "number" ||
    !Number.isInteger(verifiedAttempt.itemCount) ||
    verifiedAttempt.itemCount !== verifiedAttempt.questionIds.length
  ) {
    return {
      valid: false,
      error: "Invalid verified attempt descriptor",
      code: "INVALID_ATTEMPT_MANIFEST",
    };
  }

  if (!Array.isArray(answers)) {
    return {
      valid: false,
      error: "Answers payload must be an array",
      code: "INVALID_ANSWER_PAYLOAD",
    };
  }

  if (answers.length !== verifiedAttempt.itemCount) {
    return {
      valid: false,
      error: `Answer count (${answers.length}) does not match issued attempt manifest (${verifiedAttempt.itemCount})`,
      code: "INVALID_ATTEMPT_MANIFEST",
    };
  }

  const canonicalAnswers: CanonicalAnswerEntry[] = new Array(answers.length);

  for (let i = 0; i < answers.length; i++) {
    const item = answers[i];

    if (!item || typeof item !== "object") {
      return {
        valid: false,
        error: `Invalid answer entry at index ${i}`,
        code: "INVALID_ANSWER_PAYLOAD",
      };
    }

    const expectedQid = verifiedAttempt.questionIds[i];

    if (item.questionId !== expectedQid) {
      return {
        valid: false,
        error: `Answer at index ${i} does not match issued question manifest sequence`,
        code: "INVALID_ATTEMPT_MANIFEST",
      };
    }

    const selectedIndex = item.selectedIndex;

    if (
      typeof selectedIndex !== "number" ||
      !Number.isInteger(selectedIndex) ||
      (selectedIndex !== -1 &&
        selectedIndex !== 0 &&
        selectedIndex !== 1 &&
        selectedIndex !== 2 &&
        selectedIndex !== 3)
    ) {
      return {
        valid: false,
        error: `Invalid selectedIndex at index ${i}: must be an integer in -1..3`,
        code: "INVALID_ANSWER_PAYLOAD",
      };
    }

    canonicalAnswers[i] = {
      questionId: expectedQid,
      selectedIndex,
    };
  }

  const submissionHash = computeSubmissionHash(
    verifiedAttempt.attemptId,
    canonicalAnswers
  );

  return {
    valid: true,
    canonicalAnswers,
    submissionHash,
  };
}
