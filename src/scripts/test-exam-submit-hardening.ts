// Relative Path: src/scripts/test-exam-submit-hardening.ts
import assert from "assert";
import {
  validateAndCanonicalizeSubmission,
  computeSubmissionHash,
} from "../lib/examSubmissionIntegrity";

console.log("============================================================");
console.log("RUNNING ENTITLEMENT-1E3B SUBMISSION INTEGRITY TEST SUITE");
console.log("============================================================");

function generateQuestionIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `question_${i + 1}`);
}

function runTests() {
  // Test 1: Valid ordered 1-item payload
  {
    const qIds = generateQuestionIds(1);
    const verifiedAttempt = { attemptId: "attempt-1", questionIds: qIds, itemCount: 1 };
    const answers = [{ questionId: "question_1", selectedIndex: 0 }];
    const res = validateAndCanonicalizeSubmission({ verifiedAttempt, answers });
    assert.strictEqual(res.valid, true, "Test 1 failed: valid 1-item payload must pass");
    if (res.valid) {
      assert.strictEqual(res.canonicalAnswers.length, 1);
      assert.strictEqual(typeof res.submissionHash, "string");
      assert.strictEqual(res.submissionHash.length, 64);
    }
    console.log("✔ Test 1 passed: valid ordered 1-item payload");
  }

  // Test 2: Valid ordered 20-item payload
  {
    const qIds = generateQuestionIds(20);
    const verifiedAttempt = { attemptId: "attempt-20", questionIds: qIds, itemCount: 20 };
    const answers = qIds.map((qid, idx) => ({ questionId: qid, selectedIndex: idx % 4 }));
    const res = validateAndCanonicalizeSubmission({ verifiedAttempt, answers });
    assert.strictEqual(res.valid, true, "Test 2 failed: valid 20-item payload must pass");
    if (res.valid) {
      assert.strictEqual(res.canonicalAnswers.length, 20);
    }
    console.log("✔ Test 2 passed: valid ordered 20-item payload");
  }

  // Test 3: Valid ordered 170-item payload
  {
    const qIds = generateQuestionIds(170);
    const verifiedAttempt = { attemptId: "attempt-170", questionIds: qIds, itemCount: 170 };
    const answers = qIds.map((qid, idx) => ({ questionId: qid, selectedIndex: (idx % 5) - 1 }));
    const res = validateAndCanonicalizeSubmission({ verifiedAttempt, answers });
    assert.strictEqual(res.valid, true, "Test 3 failed: valid 170-item payload must pass");
    if (res.valid) {
      assert.strictEqual(res.canonicalAnswers.length, 170);
    }
    console.log("✔ Test 3 passed: valid ordered 170-item payload");
  }

  // Test 4: Answer count too short rejected
  {
    const qIds = generateQuestionIds(5);
    const verifiedAttempt = { attemptId: "attempt-short", questionIds: qIds, itemCount: 5 };
    const answers = qIds.slice(0, 4).map((qid) => ({ questionId: qid, selectedIndex: 0 }));
    const res = validateAndCanonicalizeSubmission({ verifiedAttempt, answers });
    assert.strictEqual(res.valid, false, "Test 4 failed: too short answers must be rejected");
    if (!res.valid) {
      assert.strictEqual(res.code, "INVALID_ATTEMPT_MANIFEST");
    }
    console.log("✔ Test 4 passed: answer count too short rejected");
  }

  // Test 5: Answer count too long rejected
  {
    const qIds = generateQuestionIds(3);
    const verifiedAttempt = { attemptId: "attempt-long", questionIds: qIds, itemCount: 3 };
    const answers = [...qIds, "extra_q"].map((qid) => ({ questionId: qid, selectedIndex: 0 }));
    const res = validateAndCanonicalizeSubmission({ verifiedAttempt, answers });
    assert.strictEqual(res.valid, false, "Test 5 failed: too long answers must be rejected");
    if (!res.valid) {
      assert.strictEqual(res.code, "INVALID_ATTEMPT_MANIFEST");
    }
    console.log("✔ Test 5 passed: answer count too long rejected");
  }

  // Test 6: Reordered qIds rejected
  {
    const qIds = ["q1", "q2", "q3"];
    const verifiedAttempt = { attemptId: "attempt-reordered", questionIds: qIds, itemCount: 3 };
    const answers = [
      { questionId: "q2", selectedIndex: 0 },
      { questionId: "q1", selectedIndex: 1 },
      { questionId: "q3", selectedIndex: 2 },
    ];
    const res = validateAndCanonicalizeSubmission({ verifiedAttempt, answers });
    assert.strictEqual(res.valid, false, "Test 6 failed: reordered answers must be rejected");
    if (!res.valid) {
      assert.strictEqual(res.code, "INVALID_ATTEMPT_MANIFEST");
    }
    console.log("✔ Test 6 passed: reordered qIds rejected");
  }

  // Test 7: Alien qId rejected
  {
    const qIds = ["q1", "q2"];
    const verifiedAttempt = { attemptId: "attempt-alien", questionIds: qIds, itemCount: 2 };
    const answers = [
      { questionId: "q1", selectedIndex: 0 },
      { questionId: "alien_q999", selectedIndex: 1 },
    ];
    const res = validateAndCanonicalizeSubmission({ verifiedAttempt, answers });
    assert.strictEqual(res.valid, false, "Test 7 failed: alien question ID must be rejected");
    if (!res.valid) {
      assert.strictEqual(res.code, "INVALID_ATTEMPT_MANIFEST");
    }
    console.log("✔ Test 7 passed: alien qId rejected");
  }

  // Test 8: Duplicate / substituted qId rejected
  {
    const qIds = ["q1", "q2"];
    const verifiedAttempt = { attemptId: "attempt-duplicate", questionIds: qIds, itemCount: 2 };
    const answers = [
      { questionId: "q1", selectedIndex: 0 },
      { questionId: "q1", selectedIndex: 1 },
    ];
    const res = validateAndCanonicalizeSubmission({ verifiedAttempt, answers });
    assert.strictEqual(res.valid, false, "Test 8 failed: duplicate/substituted question ID must be rejected");
    if (!res.valid) {
      assert.strictEqual(res.code, "INVALID_ATTEMPT_MANIFEST");
    }
    console.log("✔ Test 8 passed: duplicate/substituted qId rejected");
  }

  // Test 9: selectedIndex -1 accepted (skipped)
  {
    const qIds = ["q1"];
    const verifiedAttempt = { attemptId: "attempt-skipped", questionIds: qIds, itemCount: 1 };
    const answers = [{ questionId: "q1", selectedIndex: -1 }];
    const res = validateAndCanonicalizeSubmission({ verifiedAttempt, answers });
    assert.strictEqual(res.valid, true, "Test 9 failed: selectedIndex -1 must be accepted");
    if (res.valid) {
      assert.strictEqual(res.canonicalAnswers[0].selectedIndex, -1);
    }
    console.log("✔ Test 9 passed: selectedIndex -1 accepted");
  }

  // Test 10: selectedIndex 0..3 accepted
  {
    const qIds = ["q0", "q1", "q2", "q3"];
    const verifiedAttempt = { attemptId: "attempt-indices", questionIds: qIds, itemCount: 4 };
    const answers = [
      { questionId: "q0", selectedIndex: 0 },
      { questionId: "q1", selectedIndex: 1 },
      { questionId: "q2", selectedIndex: 2 },
      { questionId: "q3", selectedIndex: 3 },
    ];
    const res = validateAndCanonicalizeSubmission({ verifiedAttempt, answers });
    assert.strictEqual(res.valid, true, "Test 10 failed: selectedIndex 0..3 must all be accepted");
    console.log("✔ Test 10 passed: selectedIndex 0..3 accepted");
  }

  // Test 11: selectedIndex 4 rejected
  {
    const qIds = ["q1"];
    const verifiedAttempt = { attemptId: "attempt-four", questionIds: qIds, itemCount: 1 };
    const answers = [{ questionId: "q1", selectedIndex: 4 }];
    const res = validateAndCanonicalizeSubmission({ verifiedAttempt, answers });
    assert.strictEqual(res.valid, false, "Test 11 failed: selectedIndex 4 must be rejected");
    if (!res.valid) {
      assert.strictEqual(res.code, "INVALID_ANSWER_PAYLOAD");
    }
    console.log("✔ Test 11 passed: selectedIndex 4 rejected");
  }

  // Test 12: selectedIndex -2 rejected
  {
    const qIds = ["q1"];
    const verifiedAttempt = { attemptId: "attempt-minus2", questionIds: qIds, itemCount: 1 };
    const answers = [{ questionId: "q1", selectedIndex: -2 }];
    const res = validateAndCanonicalizeSubmission({ verifiedAttempt, answers });
    assert.strictEqual(res.valid, false, "Test 12 failed: selectedIndex -2 must be rejected");
    if (!res.valid) {
      assert.strictEqual(res.code, "INVALID_ANSWER_PAYLOAD");
    }
    console.log("✔ Test 12 passed: selectedIndex -2 rejected");
  }

  // Test 13: Fractional selectedIndex rejected
  {
    const qIds = ["q1"];
    const verifiedAttempt = { attemptId: "attempt-fraction", questionIds: qIds, itemCount: 1 };
    const answers = [{ questionId: "q1", selectedIndex: 1.5 }];
    const res = validateAndCanonicalizeSubmission({ verifiedAttempt, answers });
    assert.strictEqual(res.valid, false, "Test 13 failed: fractional selectedIndex must be rejected");
    if (!res.valid) {
      assert.strictEqual(res.code, "INVALID_ANSWER_PAYLOAD");
    }
    console.log("✔ Test 13 passed: fractional selectedIndex rejected");
  }

  // Test 14: String selectedIndex rejected
  {
    const qIds = ["q1"];
    const verifiedAttempt = { attemptId: "attempt-string", questionIds: qIds, itemCount: 1 };
    const answers = [{ questionId: "q1", selectedIndex: "0" as any }];
    const res = validateAndCanonicalizeSubmission({ verifiedAttempt, answers });
    assert.strictEqual(res.valid, false, "Test 14 failed: string selectedIndex must be rejected");
    if (!res.valid) {
      assert.strictEqual(res.code, "INVALID_ANSWER_PAYLOAD");
    }
    console.log("✔ Test 14 passed: string selectedIndex rejected");
  }

  // Test 15: selectedOption does not influence canonical hash
  {
    const qIds = ["q1"];
    const verifiedAttempt = { attemptId: "attempt-opt", questionIds: qIds, itemCount: 1 };
    const answersA = [{ questionId: "q1", selectedIndex: 0, selectedOption: "A" }];
    const answersB = [{ questionId: "q1", selectedIndex: 0, selectedOption: "TAMPERED_OPTION" }];
    const answersC = [{ questionId: "q1", selectedIndex: 0 }];

    const resA = validateAndCanonicalizeSubmission({ verifiedAttempt, answers: answersA });
    const resB = validateAndCanonicalizeSubmission({ verifiedAttempt, answers: answersB });
    const resC = validateAndCanonicalizeSubmission({ verifiedAttempt, answers: answersC });

    assert.strictEqual(resA.valid, true);
    assert.strictEqual(resB.valid, true);
    assert.strictEqual(resC.valid, true);

    if (resA.valid && resB.valid && resC.valid) {
      assert.strictEqual(resA.submissionHash, resB.submissionHash, "Hash must ignore selectedOption");
      assert.strictEqual(resA.submissionHash, resC.submissionHash, "Hash must match answers without selectedOption");
    }
    console.log("✔ Test 15 passed: selectedOption does not influence canonical hash");
  }

  // Test 16: Identical canonical answers produce identical SHA-256 hash
  {
    const qIds = ["q1", "q2"];
    const verifiedAttempt = { attemptId: "attempt-idem", questionIds: qIds, itemCount: 2 };
    const answersA = [
      { questionId: "q1", selectedIndex: 1 },
      { questionId: "q2", selectedIndex: 2 },
    ];
    const answersB = [
      { questionId: "q1", selectedIndex: 1 },
      { questionId: "q2", selectedIndex: 2 },
    ];

    const resA = validateAndCanonicalizeSubmission({ verifiedAttempt, answers: answersA });
    const resB = validateAndCanonicalizeSubmission({ verifiedAttempt, answers: answersB });

    assert.strictEqual(resA.valid, true);
    assert.strictEqual(resB.valid, true);
    if (resA.valid && resB.valid) {
      assert.strictEqual(resA.submissionHash, resB.submissionHash, "Identical payloads must have identical hashes");
    }
    console.log("✔ Test 16 passed: identical canonical answers produce identical SHA-256 hash");
  }

  // Test 17: Altered selectedIndex produces different hash
  {
    const qIds = ["q1", "q2"];
    const verifiedAttempt = { attemptId: "attempt-alt", questionIds: qIds, itemCount: 2 };
    const answersOriginal = [
      { questionId: "q1", selectedIndex: 1 },
      { questionId: "q2", selectedIndex: 2 },
    ];
    const answersAltered = [
      { questionId: "q1", selectedIndex: 0 },
      { questionId: "q2", selectedIndex: 2 },
    ];

    const resOrig = validateAndCanonicalizeSubmission({ verifiedAttempt, answers: answersOriginal });
    const resAlt = validateAndCanonicalizeSubmission({ verifiedAttempt, answers: answersAltered });

    assert.strictEqual(resOrig.valid, true);
    assert.strictEqual(resAlt.valid, true);
    if (resOrig.valid && resAlt.valid) {
      assert.notStrictEqual(resOrig.submissionHash, resAlt.submissionHash, "Altered answer must produce different hash");
    }
    console.log("✔ Test 17 passed: altered selectedIndex produces different hash");
  }

  // Test 18: Client totalItems is excluded from hash
  {
    const qIds = ["q1"];
    const verifiedAttempt = { attemptId: "attempt-ti", questionIds: qIds, itemCount: 1 };
    const answersA = [{ questionId: "q1", selectedIndex: 0, totalItems: 999 }];
    const answersB = [{ questionId: "q1", selectedIndex: 0, totalItems: 1 }];

    const resA = validateAndCanonicalizeSubmission({ verifiedAttempt, answers: answersA });
    const resB = validateAndCanonicalizeSubmission({ verifiedAttempt, answers: answersB });

    assert.strictEqual(resA.valid, true);
    assert.strictEqual(resB.valid, true);
    if (resA.valid && resB.valid) {
      assert.strictEqual(resA.submissionHash, resB.submissionHash, "totalItems must not alter hash");
    }
    console.log("✔ Test 18 passed: client totalItems is excluded from hash");
  }

  // Test 19: attemptId change produces different hash
  {
    const qIds = ["q1"];
    const verifiedAttempt1 = { attemptId: "attempt-A", questionIds: qIds, itemCount: 1 };
    const verifiedAttempt2 = { attemptId: "attempt-B", questionIds: qIds, itemCount: 1 };
    const answers = [{ questionId: "q1", selectedIndex: 0 }];

    const res1 = validateAndCanonicalizeSubmission({ verifiedAttempt: verifiedAttempt1, answers });
    const res2 = validateAndCanonicalizeSubmission({ verifiedAttempt: verifiedAttempt2, answers });

    assert.strictEqual(res1.valid, true);
    assert.strictEqual(res2.valid, true);
    if (res1.valid && res2.valid) {
      assert.notStrictEqual(res1.submissionHash, res2.submissionHash, "Different attemptId must produce different hash");
    }
    console.log("✔ Test 19 passed: attemptId change produces different hash");
  }

  console.log("============================================================");
  console.log("ALL 19 SUBMISSION INTEGRITY UNIT TESTS PASSED");
  console.log("============================================================");
  console.log("DB INTEGRATION TESTS DEFERRED — ISOLATED TEST DATABASE REQUIRED");
}

runTests();

