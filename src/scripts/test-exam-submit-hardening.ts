// Relative Path: src/scripts/test-exam-submit-hardening.ts
import assert from "assert";
import fs from "fs";
import path from "path";
import {
  validateAndCanonicalizeSubmission,
  computeSubmissionHash,
} from "../lib/examSubmissionIntegrity";
import { applyUserMistakeBatch } from "../lib/userMistakeBatch";

console.log("============================================================");
console.log("RUNNING ENTITLEMENT-1E3B SUBMISSION INTEGRITY TEST SUITE");
console.log("============================================================");

function generateQuestionIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `question_${i + 1}`);
}

async function runTests() {
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

  // Test 10: selectedIndex 0 accepted
  {
    const qIds = ["q0"];
    const verifiedAttempt = { attemptId: "attempt-idx-0", questionIds: qIds, itemCount: 1 };
    const answers = [{ questionId: "q0", selectedIndex: 0 }];
    const res = validateAndCanonicalizeSubmission({ verifiedAttempt, answers });
    assert.strictEqual(res.valid, true, "Test 10 failed: selectedIndex 0 must be accepted");
    if (res.valid) {
      assert.strictEqual(res.canonicalAnswers[0].selectedIndex, 0);
    }
    console.log("✔ Test 10 passed: selectedIndex 0 accepted");
  }

  // Test 11: selectedIndex 1 accepted
  {
    const qIds = ["q1"];
    const verifiedAttempt = { attemptId: "attempt-idx-1", questionIds: qIds, itemCount: 1 };
    const answers = [{ questionId: "q1", selectedIndex: 1 }];
    const res = validateAndCanonicalizeSubmission({ verifiedAttempt, answers });
    assert.strictEqual(res.valid, true, "Test 11 failed: selectedIndex 1 must be accepted");
    if (res.valid) {
      assert.strictEqual(res.canonicalAnswers[0].selectedIndex, 1);
    }
    console.log("✔ Test 11 passed: selectedIndex 1 accepted");
  }

  // Test 12: selectedIndex 2 accepted
  {
    const qIds = ["q2"];
    const verifiedAttempt = { attemptId: "attempt-idx-2", questionIds: qIds, itemCount: 1 };
    const answers = [{ questionId: "q2", selectedIndex: 2 }];
    const res = validateAndCanonicalizeSubmission({ verifiedAttempt, answers });
    assert.strictEqual(res.valid, true, "Test 12 failed: selectedIndex 2 must be accepted");
    if (res.valid) {
      assert.strictEqual(res.canonicalAnswers[0].selectedIndex, 2);
    }
    console.log("✔ Test 12 passed: selectedIndex 2 accepted");
  }

  // Test 13: selectedIndex 3 accepted
  {
    const qIds = ["q3"];
    const verifiedAttempt = { attemptId: "attempt-idx-3", questionIds: qIds, itemCount: 1 };
    const answers = [{ questionId: "q3", selectedIndex: 3 }];
    const res = validateAndCanonicalizeSubmission({ verifiedAttempt, answers });
    assert.strictEqual(res.valid, true, "Test 13 failed: selectedIndex 3 must be accepted");
    if (res.valid) {
      assert.strictEqual(res.canonicalAnswers[0].selectedIndex, 3);
    }
    console.log("✔ Test 13 passed: selectedIndex 3 accepted");
  }

  // Test 14: selectedIndex 4 rejected
  {
    const qIds = ["q1"];
    const verifiedAttempt = { attemptId: "attempt-four", questionIds: qIds, itemCount: 1 };
    const answers = [{ questionId: "q1", selectedIndex: 4 }];
    const res = validateAndCanonicalizeSubmission({ verifiedAttempt, answers });
    assert.strictEqual(res.valid, false, "Test 14 failed: selectedIndex 4 must be rejected");
    if (!res.valid) {
      assert.strictEqual(res.code, "INVALID_ANSWER_PAYLOAD");
    }
    console.log("✔ Test 14 passed: selectedIndex 4 rejected");
  }

  // Test 15: selectedIndex -2 rejected
  {
    const qIds = ["q1"];
    const verifiedAttempt = { attemptId: "attempt-minus2", questionIds: qIds, itemCount: 1 };
    const answers = [{ questionId: "q1", selectedIndex: -2 }];
    const res = validateAndCanonicalizeSubmission({ verifiedAttempt, answers });
    assert.strictEqual(res.valid, false, "Test 15 failed: selectedIndex -2 must be rejected");
    if (!res.valid) {
      assert.strictEqual(res.code, "INVALID_ANSWER_PAYLOAD");
    }
    console.log("✔ Test 15 passed: selectedIndex -2 rejected");
  }

  // Test 16: Fractional selectedIndex rejected
  {
    const qIds = ["q1"];
    const verifiedAttempt = { attemptId: "attempt-fraction", questionIds: qIds, itemCount: 1 };
    const answers = [{ questionId: "q1", selectedIndex: 1.5 }];
    const res = validateAndCanonicalizeSubmission({ verifiedAttempt, answers });
    assert.strictEqual(res.valid, false, "Test 16 failed: fractional selectedIndex must be rejected");
    if (!res.valid) {
      assert.strictEqual(res.code, "INVALID_ANSWER_PAYLOAD");
    }
    console.log("✔ Test 16 passed: fractional index rejected");
  }

  // Test 17: String selectedIndex rejected
  {
    const qIds = ["q1"];
    const verifiedAttempt = { attemptId: "attempt-string", questionIds: qIds, itemCount: 1 };
    const answers = [{ questionId: "q1", selectedIndex: "0" as any }];
    const res = validateAndCanonicalizeSubmission({ verifiedAttempt, answers });
    assert.strictEqual(res.valid, false, "Test 17 failed: string selectedIndex must be rejected");
    if (!res.valid) {
      assert.strictEqual(res.code, "INVALID_ANSWER_PAYLOAD");
    }
    console.log("✔ Test 17 passed: string index rejected");
  }

  // Test 18: selectedOption ignored by canonical hash
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
    console.log("✔ Test 18 passed: selectedOption ignored by canonical hash");
  }

  // Test 19: Identical canonical payload produces same hash
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
    console.log("✔ Test 19 passed: identical canonical payload produces same hash");
  }

  // Test 20: Changed selectedIndex changes hash
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
    console.log("✔ Test 20 passed: changed selectedIndex changes hash");
  }

  // Test 21: Client totalItems excluded from hash
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
    console.log("✔ Test 21 passed: client totalItems excluded");
  }

  // Test 22: Changed attemptId changes hash
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
    console.log("✔ Test 22 passed: changed attemptId changes hash");
  }

  // --- MockMistakeTx helper for batch UserMistake testing ---
  class MockMistakeTx {
    public store = new Map<
      string,
      {
        userId: string;
        questionId: string;
        userAnswer?: number | null;
        incorrectCount: number;
        isMastered: boolean;
        lastAttemptAt: Date;
      }
    >();

    public createManyCalls: any[] = [];
    public updateManyCalls: any[] = [];

    public userMistake = {
      createMany: async (args: { data: any[]; skipDuplicates?: boolean }) => {
        this.createManyCalls.push(args);
        for (const row of args.data) {
          const key = `${row.userId}:${row.questionId}`;
          if (args.skipDuplicates && this.store.has(key)) {
            continue; // simulate PostgreSQL ON CONFLICT DO NOTHING
          }
          this.store.set(key, { ...row });
        }
        return { count: args.data.length };
      },
      updateMany: async (args: {
        where: { userId: string; questionId: { in: string[] } };
        data: any;
      }) => {
        this.updateManyCalls.push(args);
        let count = 0;
        for (const qId of args.where.questionId.in) {
          const key = `${args.where.userId}:${qId}`;
          const existing = this.store.get(key);
          if (existing) {
            count++;
            if (args.data.incorrectCount?.increment) {
              existing.incorrectCount += args.data.incorrectCount.increment;
            }
            if (args.data.userAnswer !== undefined) {
              existing.userAnswer = args.data.userAnswer;
            }
            if (args.data.isMastered !== undefined) {
              existing.isMastered = args.data.isMastered;
            }
            if (args.data.lastAttemptAt !== undefined) {
              existing.lastAttemptAt = args.data.lastAttemptAt;
            }
          }
        }
        return { count };
      },
    };
  }

  // Test 23: applyUserMistakeBatch with zero items makes zero DB calls
  {
    const mockTx = new MockMistakeTx();
    await applyUserMistakeBatch(mockTx as any, "user-1", []);
    assert.strictEqual(mockTx.createManyCalls.length, 0);
    assert.strictEqual(mockTx.updateManyCalls.length, 0);
    console.log("✔ Test 23 passed: applyUserMistakeBatch empty items makes 0 DB writes");
  }

  // Test 24: applyUserMistakeBatch new-row case (incorrectCount starts 0 in createMany, becomes 1 in updateMany)
  {
    const mockTx = new MockMistakeTx();
    const now = new Date();
    await applyUserMistakeBatch(mockTx as any, "user-1", [{ id: "q1", selectedIndex: 2 }], now);

    assert.strictEqual(mockTx.createManyCalls.length, 1);
    assert.strictEqual(mockTx.createManyCalls[0].skipDuplicates, true);
    assert.strictEqual(mockTx.createManyCalls[0].data[0].incorrectCount, 0, "createMany data must initialize with incorrectCount: 0");
    assert.strictEqual(mockTx.updateManyCalls.length, 1);

    const record = mockTx.store.get("user-1:q1");
    assert.ok(record, "UserMistake row must exist");
    assert.strictEqual(record.incorrectCount, 1, "New row incorrectCount must be exactly 1 after increment");
    assert.strictEqual(record.userAnswer, 2);
    assert.strictEqual(record.isMastered, false);
    assert.strictEqual(record.lastAttemptAt.getTime(), now.getTime());
    console.log("✔ Test 24 passed: applyUserMistakeBatch new-row semantics preserved (incorrectCount=1)");
  }

  // Test 25: applyUserMistakeBatch existing-row case (pre-existing incorrectCount=3, isMastered=true -> becomes 4, isMastered=false)
  {
    const mockTx = new MockMistakeTx();
    mockTx.store.set("user-1:q2", {
      userId: "user-1",
      questionId: "q2",
      userAnswer: 0,
      incorrectCount: 3,
      isMastered: true,
      lastAttemptAt: new Date(Date.now() - 500000),
    });

    const now = new Date();
    await applyUserMistakeBatch(mockTx as any, "user-1", [{ id: "q2", selectedIndex: 3 }], now);

    assert.strictEqual(mockTx.createManyCalls.length, 1);
    assert.strictEqual(mockTx.updateManyCalls.length, 1);

    const record = mockTx.store.get("user-1:q2");
    assert.ok(record);
    assert.strictEqual(record.incorrectCount, 4, "Existing row incorrectCount must increment from 3 to 4");
    assert.strictEqual(record.userAnswer, 3, "userAnswer must update to new selectedIndex 3");
    assert.strictEqual(record.isMastered, false, "isMastered must be reset to false");
    assert.strictEqual(record.lastAttemptAt.getTime(), now.getTime());
    console.log("✔ Test 25 passed: applyUserMistakeBatch existing-row semantics preserved (3 -> 4, unmastered)");
  }

  // Test 26: applyUserMistakeBatch groups by selectedIndex
  {
    const mockTx = new MockMistakeTx();
    const items = [
      { id: "q1", selectedIndex: 1 },
      { id: "q2", selectedIndex: 2 },
      { id: "q3", selectedIndex: 1 },
      { id: "q4", selectedIndex: 3 },
      { id: "q5", selectedIndex: 2 },
    ];
    await applyUserMistakeBatch(mockTx as any, "user-1", items);

    assert.strictEqual(mockTx.createManyCalls.length, 1, "Exactly 1 createMany call");
    assert.strictEqual(mockTx.createManyCalls[0].data.length, 5);
    // Exactly 3 updateMany calls for distinct selectedIndex values (1, 2, 3)
    assert.strictEqual(mockTx.updateManyCalls.length, 3, "Exactly 3 updateMany calls for 3 groups");

    assert.strictEqual(mockTx.store.size, 5);
    for (let i = 1; i <= 5; i++) {
      const rec = mockTx.store.get(`user-1:q${i}`);
      assert.strictEqual(rec?.incorrectCount, 1);
    }
    console.log("✔ Test 26 passed: applyUserMistakeBatch grouping by selectedIndex");
  }

  // Test 27: applyUserMistakeBatch multiple attempts for same user/question preserves all increments
  {
    const mockTx = new MockMistakeTx();
    // Attempt 1
    await applyUserMistakeBatch(mockTx as any, "user-1", [{ id: "q1", selectedIndex: 1 }]);
    assert.strictEqual(mockTx.store.get("user-1:q1")?.incorrectCount, 1);

    // Attempt 2 (different attempt for same user and question)
    await applyUserMistakeBatch(mockTx as any, "user-1", [{ id: "q1", selectedIndex: 2 }]);
    assert.strictEqual(mockTx.store.get("user-1:q1")?.incorrectCount, 2, "Both attempts must be counted (incorrectCount=2)");
    assert.strictEqual(mockTx.store.get("user-1:q1")?.userAnswer, 2);
    console.log("✔ Test 27 passed: multiple attempts for same user/question preserves all increments (1 -> 2)");
  }

  // Test 28: Malformed or blank question ID throws Error and performs 0 writes
  {
    const mockTx = new MockMistakeTx();
    await assert.rejects(
      async () => {
        await applyUserMistakeBatch(mockTx as any, "user-1", [{ id: "", selectedIndex: 0 }]);
      },
      /Invalid questionId/,
      "Blank questionId must reject"
    );
    await assert.rejects(
      async () => {
        await applyUserMistakeBatch(mockTx as any, "user-1", [{ id: "   ", selectedIndex: 0 }]);
      },
      /Invalid questionId/,
      "Whitespace-only questionId must reject"
    );
    await assert.rejects(
      async () => {
        await applyUserMistakeBatch(mockTx as any, "user-1", [{ selectedIndex: 0 } as any]);
      },
      /Invalid questionId/,
      "Missing questionId must reject"
    );
    assert.strictEqual(mockTx.createManyCalls.length, 0, "No DB writes on malformed questionId");
    assert.strictEqual(mockTx.updateManyCalls.length, 0, "No DB writes on malformed questionId");
    console.log("✔ Test 28 passed: malformed/blank question ID fails closed with 0 writes");
  }

  // Test 29: Invalid selectedIndex throws Error and performs 0 writes
  {
    const mockTx = new MockMistakeTx();
    for (const invalidIdx of [4, -2, 1.5, "0" as any, NaN, null as any]) {
      await assert.rejects(
        async () => {
          await applyUserMistakeBatch(mockTx as any, "user-1", [{ id: "q1", selectedIndex: invalidIdx }]);
        },
        /Invalid selectedIndex/,
        `selectedIndex ${invalidIdx} must reject`
      );
    }
    assert.strictEqual(mockTx.createManyCalls.length, 0, "No DB writes on invalid selectedIndex");
    assert.strictEqual(mockTx.updateManyCalls.length, 0, "No DB writes on invalid selectedIndex");
    console.log("✔ Test 29 passed: invalid selectedIndex fails closed with 0 writes");
  }

  // Test 30: Duplicate question IDs fail closed before any write
  {
    const mockTx = new MockMistakeTx();
    await assert.rejects(
      async () => {
        await applyUserMistakeBatch(mockTx as any, "user-1", [
          { id: "q1", selectedIndex: 0 },
          { id: "q1", selectedIndex: 1 },
        ]);
      },
      /Duplicate questionId detected/,
      "Duplicate questionId must reject"
    );
    // Across id and questionId fields
    await assert.rejects(
      async () => {
        await applyUserMistakeBatch(mockTx as any, "user-1", [
          { id: "q2", selectedIndex: 0 },
          { questionId: "q2", selectedIndex: 2 },
        ]);
      },
      /Duplicate questionId detected/,
      "Duplicate questionId across id/questionId must reject"
    );
    assert.strictEqual(mockTx.createManyCalls.length, 0, "Validation must occur before createMany");
    assert.strictEqual(mockTx.updateManyCalls.length, 0, "Validation must occur before updateMany");
    console.log("✔ Test 30 passed: duplicate question ID fails closed before any DB write");
  }

  // Test 31: Invalid userId throws Error and performs 0 writes
  {
    const mockTx = new MockMistakeTx();
    for (const badUser of ["", "   ", null as any, undefined as any]) {
      await assert.rejects(
        async () => {
          await applyUserMistakeBatch(mockTx as any, badUser, [{ id: "q1", selectedIndex: 0 }]);
        },
        /Invalid userId/,
        "Invalid userId must reject"
      );
    }
    assert.strictEqual(mockTx.createManyCalls.length, 0);
    console.log("✔ Test 31 passed: invalid userId fails closed with 0 writes");
  }

  // Test 32: Exact question ID preserved without trimming mutation
  {
    const mockTx = new MockMistakeTx();
    const untrimmedId = "  q_with_spaces  ";
    await applyUserMistakeBatch(mockTx as any, "user-1", [{ id: untrimmedId, selectedIndex: 1 }]);
    assert.strictEqual(mockTx.createManyCalls.length, 1);
    assert.strictEqual(
      mockTx.createManyCalls[0].data[0].questionId,
      untrimmedId,
      "createMany must preserve original exact question ID"
    );
    assert.strictEqual(
      mockTx.updateManyCalls[0].where.questionId.in[0],
      untrimmedId,
      "updateMany must preserve original exact question ID"
    );
    console.log("✔ Test 32 passed: exact question ID preserved without trimming mutation");
  }

  // Test 33: Non-object item in array throws Error
  {
    const mockTx = new MockMistakeTx();
    await assert.rejects(
      async () => {
        await applyUserMistakeBatch(mockTx as any, "user-1", [null as any]);
      },
      /Invalid mistake item/,
      "Non-object item must reject"
    );
    assert.strictEqual(mockTx.createManyCalls.length, 0);
    console.log("✔ Test 33 passed: non-object item fails closed with 0 writes");
  }

  console.log("============================================================");
  console.log("ALL 33 SUBMISSION INTEGRITY UNIT TESTS PASSED");
  console.log("============================================================");
}

function runStaticRegressionGuards() {
  console.log("============================================================");
  console.log("RUNNING NON-DB STATIC REGRESSION GUARDS");
  console.log("============================================================");

  const submitRoutePath = path.resolve(__dirname, "../app/api/exam/submit/route.ts");
  const streakEnginePath = path.resolve(__dirname, "../lib/streakEngine.ts");
  const offlineStoragePath = path.resolve(__dirname, "../lib/offline-storage.ts");
  const mockExamTakePath = path.resolve(__dirname, "../app/mock-exam/take/page.tsx");

  const submitRouteCode = fs.readFileSync(submitRoutePath, "utf-8");
  const streakEngineCode = fs.readFileSync(streakEnginePath, "utf-8");
  const offlineStorageCode = fs.readFileSync(offlineStoragePath, "utf-8");
  const mockExamTakeCode = fs.readFileSync(mockExamTakePath, "utf-8");
  const userMistakeBatchPath = path.resolve(__dirname, "../lib/userMistakeBatch.ts");
  const userMistakeBatchCode = fs.readFileSync(userMistakeBatchPath, "utf-8");

  // Guard 1: submit route calls verifyExamAttemptToken
  assert(
    submitRouteCode.includes("verifyExamAttemptToken(attemptToken)"),
    "Guard 1 failed: submit route must call verifyExamAttemptToken"
  );
  console.log("✔ Guard 1 passed: submit route calls verifyExamAttemptToken");

  // Guard 2: submit route calls validateAndCanonicalizeSubmission
  assert(
    submitRouteCode.includes("validateAndCanonicalizeSubmission({"),
    "Guard 2 failed: submit route must call validateAndCanonicalizeSubmission"
  );
  console.log("✔ Guard 2 passed: submit route calls validateAndCanonicalizeSubmission");

  // Guard 3: authoritative item count uses verifiedAttempt.itemCount
  assert(
    submitRouteCode.includes("verifiedAttempt.itemCount"),
    "Guard 3 failed: authoritative item count must use verifiedAttempt.itemCount"
  );
  console.log("✔ Guard 3 passed: authoritative item count uses verifiedAttempt.itemCount");

  // Guard 4: ExamResult persists verifiedAttempt.examType
  assert(
    submitRouteCode.includes("examType: verifiedAttempt.examType"),
    "Guard 4 failed: ExamResult must persist verifiedAttempt.examType"
  );
  console.log("✔ Guard 4 passed: ExamResult persists verifiedAttempt.examType");

  // Guard 5: ExamResult persists verifiedAttempt.attemptId
  assert(
    submitRouteCode.includes("attemptId: verifiedAttempt.attemptId"),
    "Guard 5 failed: ExamResult must persist verifiedAttempt.attemptId"
  );
  console.log("✔ Guard 5 passed: ExamResult persists verifiedAttempt.attemptId");

  // Guard 6: ExamResult persists currentSubmissionHash
  assert(
    submitRouteCode.includes("submissionHash: currentSubmissionHash"),
    "Guard 6 failed: ExamResult must persist currentSubmissionHash"
  );
  console.log("✔ Guard 6 passed: ExamResult persists currentSubmissionHash");

  // Guard 7: core route uses prisma.$transaction
  assert(
    submitRouteCode.includes("prisma.$transaction(async (tx)"),
    "Guard 7 failed: core route must use prisma.$transaction"
  );
  console.log("✔ Guard 7 passed: core route uses prisma.$transaction");

  // Guard 8: transaction uses tx.examResult.create
  assert(
    submitRouteCode.includes("tx.examResult.create({"),
    "Guard 8 failed: transaction must use tx.examResult.create"
  );
  console.log("✔ Guard 8 passed: transaction uses tx.examResult.create");

  // Guard 9: transaction uses applyUserMistakeBatch
  assert(
    submitRouteCode.includes("applyUserMistakeBatch(tx, userId, incorrectItems)"),
    "Guard 9 failed: transaction must use applyUserMistakeBatch(tx, userId, incorrectItems)"
  );
  console.log("✔ Guard 9 passed: transaction uses applyUserMistakeBatch(tx, userId, incorrectItems)");

  // Guard 10: transaction calls recordUserActivityStreak(userId, tx)
  assert(
    submitRouteCode.includes("recordUserActivityStreak(userId, tx)"),
    "Guard 10 failed: transaction must call recordUserActivityStreak(userId, tx)"
  );
  console.log("✔ Guard 10 passed: transaction calls recordUserActivityStreak(userId, tx)");

  // Guard 11: transaction uses tx.examDraft.deleteMany
  assert(
    submitRouteCode.includes("tx.examDraft.deleteMany({"),
    "Guard 11 failed: transaction must use tx.examDraft.deleteMany"
  );
  console.log("✔ Guard 11 passed: transaction uses tx.examDraft.deleteMany");

  // Guard 12: identical replay does not invoke recordUserActivityStreak
  const earlyReplayMatch = submitRouteCode.match(/if\s*\(\s*existingResult\.submissionHash\s*===\s*currentSubmissionHash\s*\)\s*\{([\s\S]*?)\}/);
  assert(earlyReplayMatch && !earlyReplayMatch[1].includes("recordUserActivityStreak"),
    "Guard 12 failed: early identical replay must not invoke recordUserActivityStreak"
  );
  const p2002ReplayMatch = submitRouteCode.match(/if\s*\(\s*concurrentResult\.submissionHash\s*===\s*currentSubmissionHash\s*\)\s*\{([\s\S]*?)\}/);
  assert(p2002ReplayMatch && !p2002ReplayMatch[1].includes("recordUserActivityStreak"),
    "Guard 12 failed: P2002 identical replay must not invoke recordUserActivityStreak"
  );
  console.log("✔ Guard 12 passed: identical replay does not invoke recordUserActivityStreak");

  // Guard 13: HTTP 409 fingerprint mismatch handling exists
  assert(
    submitRouteCode.includes("SUBMISSION_FINGERPRINT_MISMATCH") && submitRouteCode.includes("{ status: 409 }"),
    "Guard 13 failed: HTTP 409 fingerprint mismatch handling must exist"
  );
  console.log("✔ Guard 13 passed: HTTP 409 fingerprint mismatch handling exists");

  // Guard 14: HTTP 422 unavailable-question handling exists
  assert(
    submitRouteCode.includes("ATTEMPT_QUESTION_UNAVAILABLE") && submitRouteCode.includes("{ status: 422 }"),
    "Guard 14 failed: HTTP 422 unavailable-question handling must exist"
  );
  console.log("✔ Guard 14 passed: HTTP 422 unavailable-question handling exists");

  // Guard 15: submit route does NOT contain: const passed = score >= 80
  assert(
    !submitRouteCode.includes("const passed = score >= 80") && !submitRouteCode.includes("passed,"),
    "Guard 15 failed: submit route must not calculate or persist passed"
  );
  console.log("✔ Guard 15 passed: submit route does NOT contain const passed = score >= 80");

  // Guard 16: streakEngine contains transactional rethrow behavior
  assert(
    streakEngineCode.includes("if (tx !== prisma)") && streakEngineCode.includes("throw error;"),
    "Guard 16 failed: streakEngine must rethrow error when tx !== prisma"
  );
  console.log("✔ Guard 16 passed: streakEngine contains transactional rethrow behavior");

  // Guard 17: offline-storage still drops token-less submissions
  assert(
    offlineStorageCode.includes("Dropping legacy submission") && offlineStorageCode.includes("missing attemptToken"),
    "Guard 17 failed: offline-storage must drop legacy token-less submissions"
  );
  console.log("✔ Guard 17 passed: offline-storage still drops token-less submissions");

  // Guard 18: offline-storage retains retryable failures
  assert(
    offlineStorageCode.includes("isTerminal") && offlineStorageCode.includes("remaining.push(submission)"),
    "Guard 18 failed: offline-storage must retain retryable failures"
  );
  console.log("✔ Guard 18 passed: offline-storage retains retryable failures");

  // Guard 19: legacy active-session token guard remains present
  assert(
    mockExamTakeCode.includes("Discarded legacy token-less saved exam session") &&
    mockExamTakeCode.includes("typeof parsed.attemptToken === \"string\" && parsed.attemptToken.trim()"),
    "Guard 19 failed: legacy active-session token guard must remain present"
  );
  console.log("✔ Guard 19 passed: legacy active-session token guard remains present");

  // Guard 20: userMistakeBatch implements createMany(skipDuplicates:true) with incorrectCount:0 and grouped updateMany increment:1
  assert(
    userMistakeBatchCode.includes("tx.userMistake.createMany({") &&
    userMistakeBatchCode.includes("skipDuplicates: true") &&
    userMistakeBatchCode.includes("incorrectCount: 0") &&
    userMistakeBatchCode.includes("tx.userMistake.updateMany({") &&
    userMistakeBatchCode.includes("incorrectCount: { increment: 1 }"),
    "Guard 20 failed: userMistakeBatch must implement two-step createMany(skipDuplicates:true) and grouped updateMany with increment:1"
  );
  console.log("✔ Guard 20 passed: userMistakeBatch implements two-step createMany and grouped updateMany");

  // Guard 21: userMistakeBatch validates duplicate question IDs fail closed
  assert(
    userMistakeBatchCode.includes("seenQuestionIds.has(qId)") &&
    userMistakeBatchCode.includes("Duplicate questionId detected"),
    "Guard 21 failed: userMistakeBatch must fail closed on duplicate question IDs"
  );
  console.log("✔ Guard 21 passed: userMistakeBatch detects duplicate question IDs via Set and throws");

  // Guard 22: userMistakeBatch enforces selectedIndex range -1..3 and integer check
  assert(
    userMistakeBatchCode.includes("item.selectedIndex < -1") &&
    userMistakeBatchCode.includes("item.selectedIndex > 3") &&
    userMistakeBatchCode.includes("Number.isInteger"),
    "Guard 22 failed: userMistakeBatch must enforce selectedIndex range [-1, 3] and integer check"
  );
  console.log("✔ Guard 22 passed: userMistakeBatch enforces selectedIndex integer and [-1, 3] range");

  // Guard 23: userMistakeBatch validates non-empty userId
  assert(
    userMistakeBatchCode.includes("typeof userId !== \"string\" || userId.trim().length === 0"),
    "Guard 23 failed: userMistakeBatch must validate non-empty userId"
  );
  console.log("✔ Guard 23 passed: userMistakeBatch validates non-empty userId");

  // Guard 24: userMistakeBatch does NOT contain unproven 5000ms claim
  assert(
    !userMistakeBatchCode.includes("5000ms"),
    "Guard 24 failed: userMistakeBatch must not contain unproven 5000ms performance claim"
  );
  console.log("✔ Guard 24 passed: unproven 5000ms claim removed from userMistakeBatch doc");

  // Guard 25: neither submit route nor userMistakeBatch contains timeout or maxWait overrides
  assert(
    !userMistakeBatchCode.includes("timeout:") &&
    !userMistakeBatchCode.includes("maxWait:") &&
    !submitRouteCode.includes("timeout:") &&
    !submitRouteCode.includes("maxWait:"),
    "Guard 25 failed: no timeout or maxWait overrides allowed"
  );
  console.log("✔ Guard 25 passed: no transaction timeout or maxWait overrides exist");

  console.log("============================================================");
  console.log("ALL 25 NON-DB STATIC REGRESSION GUARDS PASSED");
  console.log("============================================================");
}

async function main() {
  await runTests();
  runStaticRegressionGuards();
  console.log("DB INTEGRATION TESTS DEFERRED — ISOLATED TEST DATABASE REQUIRED");
}

main().catch((err) => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
