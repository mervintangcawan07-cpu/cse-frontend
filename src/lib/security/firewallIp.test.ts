import assert from "node:assert/strict";
import { test } from "node:test";
import { getClientIp } from "../ratelimit";

function withVercelEnvironment(fn: () => void) {
  const previousVercel = process.env.VERCEL;
  const previousEnvironment = process.env.VERCEL_ENV;
  try {
    process.env.VERCEL = "1";
    delete process.env.VERCEL_ENV;
    fn();
  } finally {
    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
    if (previousEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousEnvironment;
  }
}

test("Vercel client IP ignores spoofable alternative headers", () => {
  withVercelEnvironment(() => {
    const request = new Request("https://govstudyx.com/api/auth/login", {
      headers: {
        "cf-connecting-ip": "198.51.100.2",
        "x-real-ip": "198.51.100.3",
        "x-forwarded-for": "203.0.113.10",
      },
    });
    assert.equal(getClientIp(request), "203.0.113.10");
  });
});

test("Vercel client IP validates IPv4 and IPv6 syntax", () => {
  withVercelEnvironment(() => {
    const url = "https://govstudyx.com/api/auth/login";
    assert.equal(getClientIp(new Request(url, {
      headers: { "x-forwarded-for": "2001:db8::1" },
    })), "2001:db8::1");
    assert.equal(getClientIp(new Request(url, {
      headers: { "x-forwarded-for": "not-an-ip" },
    })), "unknown");
    assert.equal(getClientIp(new Request(url)), "unknown");
  });
});

test("non-Vercel runtime ignores unauthenticated forwarding headers", () => {
  const previousVercel = process.env.VERCEL;
  const previousEnvironment = process.env.VERCEL_ENV;
  try {
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    assert.equal(getClientIp(new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.77" },
    })), "127.0.0.1");
  } finally {
    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
    if (previousEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousEnvironment;
  }
});
