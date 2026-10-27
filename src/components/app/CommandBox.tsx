import { useChat } from "@ai-sdk/react";
import { useNavigate } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
import { ArrowUpRight, CornerDownLeft, RotateCcw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import logo from "@/assets/logo-mark.png";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { parseCommand } from "@/lib/intent";
import { createTask } from "@/lib/session-store";
import { TASKS } from "@/lib/tasks/definitions";

const SUGGESTIONS = [
  { text: "ออกใบเสนอราคาให้ บริษัท สยามเทค", kind: "คำสั่ง" },
  { text: "ลงข้อมูลลูกค้าใหม่", kind: "คำสั่ง" },
  { text: "คีย์เอกสาร ใบแจ้งหนี้", kind: "คำสั่ง" },
  { text: "VAT 7% คิดจากยอดไหน?", kind: "คำถาม" },
];

function readableError(error: Error | undefined): string | null {
  if (!error) return null;
  try {
    const parsed = JSON.parse(error.message) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    /* plain message */
  }
  return error.message || "ไม่สามารถตอบคำถามได้ กรุณาลองใหม่";
}

export function CommandBox() {
  const navigate = useNavigate();
  const [transport] = useState(() => new DefaultChatTransport({ api: "/api/chat" }));
  const { messages, sendMessage, status, stop, error, setMessages, clearError } = useChat({
    transport,
    onError: (e) => toast.error(readableError(e) ?? "เกิดข้อผิดพลาด"),
  });
  const busy = status === "submitted" || status === "streaming";

  const run = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const intent = parseCommand(text);
    if (intent.kind === "task") {
      const task = createTask(intent.type, intent.prefill);
      toast.success(`เปิดงาน "${TASKS[intent.type].title}" แล้ว`, {
        description: "ข้อมูลจะถูกบันทึกอัตโนมัติในเบราว์เซอร์นี้",
      });
      void navigate({ to: "/wizard/$taskId", params: { taskId: task.id } });
      return;
    }
    if (busy) return;
    if (error) clearError();
    void sendMessage({ text });
  };

  const handleSubmit = (message: PromptInputMessage) => run(message.text);
  const last = messages.at(-1);
  const waiting = status === "submitted" && last?.role === "user";
  const errorText = readableError(error);

  return (
    <div className="space-y-3">
      <div className="surface overflow-hidden">
        {messages.length > 0 && (
          <div className="border-b border-border">
            <div className="flex items-center justify-between px-4 pt-3">
              <span className="eyebrow">บทสนทนา (ไม่ถูกบันทึก)</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (busy) void stop();
                  setMessages([]);
                }}
              >
                <RotateCcw /> ล้างแชท
              </Button>
            </div>
            <Conversation className="max-h-[420px]">
              <ConversationContent className="gap-5 px-4 py-4">
                {messages.map((m) => (
                  <Message key={m.id} from={m.role}>
                    {m.role === "assistant" ? (
                      <div className="flex gap-3">
                        <img src={logo} alt="" width={24} height={24} className="mt-0.5 size-6 shrink-0 rounded-md" />
                        <MessageContent className="text-[0.95rem] leading-relaxed">
                          {m.parts.map((p, i) =>
                            p.type === "text" ? (
                              <MessageResponse key={i} isAnimating={status === "streaming" && m.id === last?.id}>
                                {p.text}
                              </MessageResponse>
                            ) : null,
                          )}
                          {status === "streaming" &&
                            m.id === last?.id &&
                            !m.parts.some((p) => p.type === "text" && p.text) && (
                              <Shimmer className="text-sm">กำลังคิด…</Shimmer>
                            )}
                        </MessageContent>
                      </div>
                    ) : (
                      <MessageContent className="group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                        {m.parts.map((p, i) => (p.type === "text" ? <span key={i}>{p.text}</span> : null))}
                      </MessageContent>
                    )}
                  </Message>
                ))}
                {waiting && (
                  <div className="flex items-center gap-3">
                    <img src={logo} alt="" width={24} height={24} className="size-6 rounded-md" />
                    <Shimmer className="text-sm">กำลังคิด…</Shimmer>
                  </div>
                )}
                {errorText && status === "error" && (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorText}</p>
                )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
          </div>
        )}

        <PromptInput onSubmit={handleSubmit} className="rounded-none border-0 shadow-none">
          <PromptInputTextarea
            placeholder='พิมพ์คำสั่ง เช่น "ออกใบเสนอราคา" หรือถามคำถาม…'
            className="min-h-14 px-4 text-[0.95rem]"
          />
          <PromptInputFooter className="justify-between px-3 pb-3">
            <span className="flex items-center gap-1.5 pl-1 text-xs text-muted-foreground">
              <CornerDownLeft className="size-3.5" /> Enter เพื่อส่ง<span className="hidden sm:inline"> · คำสั่งเปิดงานทันที · คำถามตอบด้วย AI</span>
            </span>
            <PromptInputSubmit
              status={status}
              onStop={() => void stop()}
              className="bg-signal text-signal-foreground hover:bg-signal/90"
            />
          </PromptInputFooter>
        </PromptInput>
      </div>

      <p className="flex items-start gap-1.5 px-1 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
        ระบบไม่มีการเก็บบันทึกข้อมูลส่วนตัว ประวัติการสั่งงานจะถูกบันทึกไว้ในเบราว์เซอร์ของคุณเท่านั้น
      </p>



      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.text}
            type="button"
            onClick={() => run(s.text)}
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:border-signal/50 hover:bg-signal-soft"
          >
            <span className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">{s.kind}</span>
            {s.text}
            <ArrowUpRight className="size-3 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
    </div>
  );
}
