import { beforeEach, describe, expect, it } from "vitest";

import {
  HISTORY_KEY,
  SESSION_KEY,
  __resetForTests,
  createTask,
  finishTask,
  getState,
  updateTask,
} from "@/lib/session-store";
import { calcQuotation } from "@/lib/tasks/definitions";

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  __resetForTests();
});

describe("privacy-first storage", () => {
  it("keeps working data in sessionStorage only (destroyed when the tab closes)", () => {
    const t = createTask("customer", { name: "สมชาย ใจดี" });
    expect(window.sessionStorage.getItem(SESSION_KEY)).toContain("สมชาย ใจดี");
    expect(window.localStorage.getItem(HISTORY_KEY) ?? "").not.toContain("สมชาย");
    expect(getState().tasks[0]?.id).toBe(t.id);
  });

  it("destroys the task data when the mission finishes but keeps a history entry", () => {
    const t = createTask("customer", { name: "สมชาย ใจดี", phone: "0812345678" });
    updateTask(t.id, { status: "ready" });
    const entry = finishTask(t.id, "success", Date.now() - 3000, 4);

    expect(getState().tasks).toHaveLength(0);
    expect(window.sessionStorage.getItem(SESSION_KEY)).not.toContain("สมชาย");
    expect(getState().history).toHaveLength(1);
    expect(entry?.ref).toMatch(/^CU-\d{8}-\d{4}$/);
  });

  it("stores no personal details in the usage history", () => {
    const t = createTask("quotation", {
      customerName: "บริษัท ลับมาก จำกัด",
      email: "secret@example.com",
      items: [{ name: "บริการ", qty: 2, price: 500 }],
    });
    finishTask(t.id, "success", Date.now(), 5);
    const stored = window.localStorage.getItem(HISTORY_KEY) ?? "";
    expect(stored).not.toContain("ลับมาก");
    expect(stored).not.toContain("secret@example.com");
  });
});

describe("quotation totals", () => {
  it("applies the discount before adding 7% VAT", () => {
    const t = calcQuotation([{ name: "a", qty: 2, price: 500 }], 10, true);
    expect(t).toEqual({ subtotal: 1000, discount: 100, afterDiscount: 900, vat: 63, total: 963 });
  });

  it("adds no VAT when VAT is switched off", () => {
    expect(calcQuotation([{ name: "a", qty: 1, price: 1000 }], 0, false).total).toBe(1000);
  });
});
