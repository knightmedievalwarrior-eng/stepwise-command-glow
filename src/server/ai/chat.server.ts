import { convertToModelMessages, type UIMessage } from "ai";
import { z } from "zod";

import { createResponsesCall } from "./responses.ts";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

const INSTRUCTIONS = `คุณคือ "ผู้ช่วย Command Center" ของแอป Guided Task Runner สำหรับงานออฟฟิศที่ทำซ้ำๆ
ตอบเป็นภาษาไทย กระชับ เป็นกันเอง ใช้ bullet เมื่อเหมาะสม (ไม่เกิน ~120 คำ เว้นแต่ผู้ใช้ขอรายละเอียด)

แอปมีงาน 3 แบบที่ผู้ใช้สั่งได้ทันทีโดยพิมพ์คำสั่งในช่องเดียวกันนี้:
- "ออกใบเสนอราคา" (ตัวอย่าง: ออกใบเสนอราคาให้ บริษัท สยามเทค) — คำนวณส่วนลดและ VAT 7% อัตโนมัติ
- "ลงข้อมูลลูกค้า" (ตัวอย่าง: ลงข้อมูลลูกค้า คุณสมชาย)
- "คีย์เอกสาร" (ตัวอย่าง: คีย์เอกสาร ใบแจ้งหนี้)
แต่ละงานเป็น Wizard ทีละขั้น บันทึกอัตโนมัติ มีหน้าตรวจทานก่อนส่ง แล้วบอทหลังบ้านจะทำงานพร้อมแสดงสถานะแบบเรียลไทม์

นโยบายความเป็นส่วนตัว: ข้อมูลงานและข้อมูลลูกค้าเก็บไว้ในเบราว์เซอร์ของผู้ใช้เท่านั้น ถูกลบเมื่อปิดแท็บหรือเมื่องานเสร็จ
ประวัติการใช้งานเก็บเพียงสรุปที่ไม่ระบุตัวบุคคล

ถ้าผู้ใช้ต้องการเริ่มงาน ให้บอกคำสั่งที่ควรพิมพ์ (ใส่ในเครื่องหมายคำพูด) แทนการแกล้งทำว่าทำงานให้แล้ว
อย่าขอข้อมูลส่วนบุคคลของลูกค้าในแชท ให้แนะนำให้กรอกใน Wizard แทน`;

const bodySchema = z.object({
  messages: z
    .array(
      z
        .object({
          id: z.string().max(200),
          role: z.enum(["user", "assistant"]),
          parts: z.array(z.unknown()).max(50),
        })
        .passthrough(),
    )
    .min(1)
    .max(40),
});

function statusOf(error: unknown): number | undefined {
  if (error && typeof error === "object" && "statusCode" in error) {
    const s = (error as { statusCode?: unknown }).statusCode;
    return typeof s === "number" ? s : undefined;
  }
  return undefined;
}

function safeErrorMessage(error: unknown): string {
  const status = statusOf(error);
  if (status === 429) return "มีการใช้งาน AI ถี่เกินไป กรุณารอสักครู่แล้วลองใหม่";
  if (status === 402) return "เครดิต AI ของเวิร์กสเปซหมดแล้ว กรุณาเติมเครดิตเพื่อใช้งานต่อ";
  if (status === 403) return "ไม่สามารถใช้งาน AI ได้ในขณะนี้ (ถูกจำกัดสิทธิ์โดยผู้ดูแลเวิร์กสเปซ)";
  if (status === 401) return "การตั้งค่า AI ไม่ถูกต้อง";
  if (status && status >= 500) return "บริการ AI ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง";
  return "ไม่สามารถตอบคำถามได้ กรุณาลองใหม่";
}

export async function handleChat(request: Request): Promise<Response> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    return Response.json({ error: "AI ยังไม่ได้ตั้งค่า" }, { status: 500 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const uiMessages = parsed.messages as unknown as UIMessage[];
  try {
    const modelMessages = await convertToModelMessages(uiMessages);
    const call = createResponsesCall(
      request,
      { baseURL: GATEWAY_URL, apiKey, model: MODEL },
      modelMessages,
      INSTRUCTIONS,
    );
    return await call.response({
      originalMessages: uiMessages,
      onError: (error) => {
        console.error("chat stream error", error);
        return safeErrorMessage(error);
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    console.error("chat error", error);
    return Response.json({ error: safeErrorMessage(error) }, { status: statusOf(error) ?? 500 });
  }
}
