import { describe, expect, it } from "vitest";

import { promptPayPayload } from "@/lib/payment";
import { TRIAL_DAYS, trialDaysLeft } from "@/lib/trial";

const DAY = 86_400_000;

describe("free trial", () => {
  it("lasts 15 days", () => {
    expect(TRIAL_DAYS).toBe(15);
    expect(trialDaysLeft(0, 0)).toBe(15);
  });

  it("shows 1 day left on the last day", () => {
    expect(trialDaysLeft(0, 14.5 * DAY)).toBe(1);
  });

  it("is over once 15 days have passed", () => {
    expect(trialDaysLeft(0, 15 * DAY)).toBe(0);
    expect(trialDaysLeft(0, 40 * DAY)).toBe(0);
  });
});

describe("PromptPay QR", () => {
  it("matches the standard code for a phone number without amount", () => {
    expect(promptPayPayload("081-234-5678")).toBe(
      "00020101021129370016A000000677010111011300668123456785802TH530376463045D82",
    );
  });

  it("matches the standard code for a phone number with 299 baht", () => {
    expect(promptPayPayload("0812345678", 299)).toBe(
      "00020101021229370016A000000677010111011300668123456785802TH53037645406299.0063049190",
    );
  });

  it("matches the standard code for a 13-digit ID", () => {
    expect(promptPayPayload("1234567890123", 1.5)).toBe(
      "00020101021229370016A000000677010111021312345678901235802TH530376454041.506304734D",
    );
  });
});
