import { describe, expect, it } from "vitest";

import { parseCommand } from "@/lib/intent";

describe("hybrid command parser", () => {
  it("opens the quotation task for 'ออกใบเสนอราคา' and prefills the customer", () => {
    expect(parseCommand("ออกใบเสนอราคาให้ บริษัท สยามเทค")).toEqual({
      kind: "task",
      type: "quotation",
      prefill: { customerName: "บริษัท สยามเทค" },
    });
  });

  it("opens the customer task for 'ลงข้อมูลลูกค้า'", () => {
    expect(parseCommand("ลงข้อมูลลูกค้า").kind).toBe("task");
    expect(parseCommand("ลงข้อมูลลูกค้า")).toMatchObject({ type: "customer" });
  });

  it("opens the document task for 'คีย์เอกสาร' and detects the document type", () => {
    expect(parseCommand("คีย์เอกสาร ใบแจ้งหนี้")).toMatchObject({
      kind: "task",
      type: "document",
      prefill: { docType: "invoice" },
    });
  });

  it("sends questions to the AI even when they mention a task", () => {
    expect(parseCommand("ใบเสนอราคาคืออะไร").kind).toBe("question");
    expect(parseCommand("VAT 7% คิดจากยอดไหน?").kind).toBe("question");
  });

  it("sends free text without a command to the AI", () => {
    expect(parseCommand("สวัสดีครับ").kind).toBe("question");
  });
});
