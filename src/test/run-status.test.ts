import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetN8nConfigForTests, saveN8nConfig } from "@/lib/n8n/config";
import { __resetRunsForTests, getRun, launchRun } from "@/lib/run-store";
import { __resetForTests, createTask, getState, updateTask } from "@/lib/session-store";

function ndjson(lines: unknown[]) {
  return new Response(lines.map((l) => JSON.stringify(l)).join("\n"), {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

async function settle(taskId: string) {
  for (let i = 0; i < 50; i++) {
    const r = getRun(taskId);
    if (!r || r.phase === "done" || r.phase === "error") return;
    await new Promise((res) => setTimeout(res, 5));
  }
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  __resetForTests();
  __resetN8nConfigForTests();
  __resetRunsForTests();
  saveN8nConfig({ url: "https://n8n.example.com/webhook/gtr", authHeader: "", authValue: "" });
});
afterEach(() => vi.unstubAllGlobals());

function readyCustomer() {
  const t = createTask("customer", { name: "สมชาย", phone: "0812345678" });
  updateTask(t.id, { status: "ready" });
  return getState().tasks.find((x) => x.id === t.id)!;
}

describe("n8n status on Pending and Bot Log", () => {
  it("marks the pending task as failed at the step n8n reports, and logs a failed history entry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ndjson([
          { step: 1, status: "success" },
          { step: 2, status: "running" },
          { step: 2, status: "error", message: "พบข้อมูลซ้ำ" },
        ]),
      ),
    );
    const t = readyCustomer();
    launchRun(t);
    await settle(t.id);

    const task = getState().tasks.find((x) => x.id === t.id);
    expect(task?.lastRun).toMatchObject({ status: "failed", failedStep: 1, message: "พบข้อมูลซ้ำ" });
    expect(getState().history[0]).toMatchObject({ status: "failed", failedStep: 1, mode: "n8n" });
  });

  it("removes the task from Pending and logs a success entry when n8n finishes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ndjson([{ status: "success" }])));
    const t = readyCustomer();
    launchRun(t);
    await settle(t.id);

    expect(getState().tasks).toHaveLength(0);
    expect(getState().history[0]).toMatchObject({ status: "success", steps: 4, mode: "n8n" });
  });

  it("shows the task as running while n8n is still working", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    const t = readyCustomer();
    launchRun(t);
    expect(getRun(t.id)?.phase).toBe("running");
    expect(getState().tasks[0]?.lastRun?.status).toBe("running");
  });
});
