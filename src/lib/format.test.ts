import { test } from "node:test";
import assert from "node:assert/strict";
import { shortDate, fyOf, fyLabel, fyFraction, moneyShort, money, timeAgo, todayIn, addDays, pct } from "./format.ts";

test("financial year", () => {
  assert.equal(fyOf("2026-07-01"), 2027);
  assert.equal(fyOf("2026-06-30"), 2026);
  assert.equal(fyLabel(2027), "FY27");
  assert.equal(fyFraction(2027, "2026-07-01"), 0);
  assert.equal(fyFraction(2027, "2027-07-01"), 1);
  assert.ok(Math.abs(fyFraction(2027, "2027-01-01") - 184 / 365) < 1e-9);
});

test("money", () => {
  assert.equal(money(12345.4), "$12,345");
  assert.equal(moneyShort(950), "$950");
  assert.equal(moneyShort(12500), "$12.5k");
  assert.equal(moneyShort(250000), "$250k");
  assert.equal(moneyShort(1_200_000), "$1.2m");
  assert.equal(pct(1, 0), 0);
});

test("dates", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(shortDate("2026-09-24", 2026), "24 Sep");
  assert.equal(shortDate("2027-01-05", 2026), "5 Jan 2027");
  assert.equal(todayIn("Australia/Brisbane", new Date("2026-10-01T15:00:00Z")), "2026-10-02");
  const now = new Date("2026-10-02T00:00:00Z");
  assert.equal(timeAgo("2026-10-01T23:59:30Z", now), "just now");
  assert.equal(timeAgo("2026-10-01T00:00:00Z", now), "yesterday");
  assert.equal(timeAgo("2026-09-28T00:00:00Z", now), "4d ago");
  assert.equal(timeAgo(null, now), "never");
});
