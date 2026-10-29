import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createDistributedAccountLockout,
  isDistributedLoginLockoutEnabled,
  type LockoutStorage,
} from "./distributedAccountLockout";

function mockStore() {
  const counts = new Map<string, number>();
  const keys: string[] = [];
  let erased = 0;
  const storage: LockoutStorage = {
    async eval(script, inputKeys) {
      const key = inputKeys[0];
      keys.push(key);
      if (script.includes('"INCR"')) {
        const count = (counts.get(key) || 0) + 1;
        counts.set(key, count);
        return [count, 900000];
      }
      return [Number((counts.get(key) || 0) >= 5), 900000];
    },
    async del(key) {
      erased += 1;
      return counts.delete(key) ? 1 : 0;
    },
  };
  return { storage, keys, getErased: () => erased };
}

test("distributed login lockout defaults off", () => {
  const before = process.env.SECURITY_DISTRIBUTED_LOGIN_LOCKOUT;
  try {
    delete process.env.SECURITY_DISTRIBUTED_LOGIN_LOCKOUT;
    assert.equal(isDistributedLoginLockoutEnabled(), false);
    process.env.SECURITY_DISTRIBUTED_LOGIN_LOCKOUT = "1";
    assert.equal(isDistributedLoginLockoutEnabled(), true);
  } finally {
    if (before === undefined) delete process.env.SECURITY_DISTRIBUTED_LOGIN_LOCKOUT;
    else process.env.SECURITY_DISTRIBUTED_LOGIN_LOCKOUT = before;
  }
});

test("fifth failed password locks account, reset removes record, keys hide email", async () => {
  const fake = mockStore();
  const service = createDistributedAccountLockout(fake.storage, "test-secret", "test");
  assert.equal((await service.check("Student@Example.com")).isLocked, false);
  for (let i = 1; i <= 5; i++) {
    const result = await service.recordFailure("Student@Example.com");
    assert.equal(result.isLocked, i >= 5);
    assert.equal(result.attemptsLeft, Math.max(0, 5 - i));
  }
  assert.equal((await service.check("student@example.com")).isLocked, true);
  assert.ok(fake.keys.every(k => !k.includes("student@example.com")));
  assert.equal(new Set(fake.keys).size, 1);
  await service.reset("student@example.com");
  assert.equal(fake.getErased(), 1);
  assert.equal((await service.check("student@example.com")).isLocked, false);
});

test("different deployment environment has separate lockout keys", async () => {
  const fake = mockStore();
  await createDistributedAccountLockout(fake.storage, "secret", "preview").check("student@example.com");
  await createDistributedAccountLockout(fake.storage, "secret", "production").check("student@example.com");
  assert.notEqual(fake.keys[0], fake.keys[1]);
});

test("unavailable distributed storage rejects instead of silently falling back", async () => {
  const storage: LockoutStorage = {
    async eval() { throw new Error("simulated redis outage"); },
    async del() { throw new Error("simulated redis outage"); },
  };
  const lockout = createDistributedAccountLockout(storage, "secret", "test");
  await assert.rejects(lockout.check("student@example.com"), /redis outage/);
  await assert.rejects(lockout.recordFailure("student@example.com"), /redis outage/);
  await assert.rejects(lockout.reset("student@example.com"), /redis outage/);
});
