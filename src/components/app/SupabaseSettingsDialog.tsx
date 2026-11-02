/**
 * "Supabase & Database Configuration" modal.
 * Replaces the old n8n webhook settings dialog: credentials stay in this
 * browser only, and any data push goes straight from the browser to the
 * user's own project.
 */
import { Check, Database, Loader2, PlugZap, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import {
  projectRef,
  saveSupabaseConfig,
  useSupabaseConfig,
  validateSupabaseConfig,
  type SupabaseConfig,
} from "@/lib/supabase-config";
import { pingSupabase } from "@/lib/supabase-rest";
import { cn } from "@/lib/utils";

type TestState = { kind: "idle" } | { kind: "testing" } | { kind: "ok"; text: string } | { kind: "fail"; text: string };

export function SupabaseSettingsDialog({ trigger }: { trigger?: ReactNode }) {
  const saved = useSupabaseConfig();
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SupabaseConfig>(saved);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<TestState>({ kind: "idle" });

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setForm(saved);
      setError(null);
      setTest({ kind: "idle" });
    }
  };

  const set = (patch: Partial<SupabaseConfig>) => {
    setForm((f) => ({ ...f, ...patch }));
    setError(null);
    setTest({ kind: "idle" });
  };

  const save = () => {
    const err = validateSupabaseConfig(form, lang);
    if (err) return setError(err);
    saveSupabaseConfig(form);
    toast.success(t("บันทึกการตั้งค่า Supabase แล้ว", "Supabase settings saved"), {
      description: t(
        `ข้อมูลที่ส่งจะไปที่ ${projectRef(form.url)} โดยตรงจากเบราว์เซอร์`,
        `Data will go straight from this browser to ${projectRef(form.url)}`,
      ),
    });
    setOpen(false);
  };

  const clear = () => {
    saveSupabaseConfig({ url: "", apiKey: "", table: "" });
    setForm({ url: "", apiKey: "", table: "" });
    toast(t("ล้างการตั้งค่าแล้ว", "Settings cleared"), {
      description: t("ข้อมูลทั้งหมดยังอยู่ในเบราว์เซอร์เหมือนเดิม", "All data stays local in this browser as before"),
    });
  };

  const runTest = async () => {
    const err = validateSupabaseConfig(form, lang);
    if (err) return setError(err);
    setTest({ kind: "testing" });
    const result = await pingSupabase({ ...form, url: form.url.trim(), apiKey: form.apiKey.trim() }, form.table.trim() || "records");
    if (result.ok) setTest({ kind: "ok", text: `${t("เชื่อมต่อสำเร็จ", "Connected")} · ${result.message}` });
    else setTest({ kind: "fail", text: result.message });
  };

  const connected = Boolean(saved.url && saved.apiKey);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" aria-label={t("ตั้งค่า Supabase", "Supabase settings")}>
            <span className={cn("size-1.5 rounded-full", connected ? "bg-success" : "bg-muted-foreground/40")} />
            <Database />
            <span className="hidden md:inline">{connected ? "Supabase" : t("เชื่อม Supabase", "Connect Supabase")}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="size-5" /> {t("ตั้งค่า Supabase และฐานข้อมูล", "Supabase & database configuration")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "เชื่อมกับโปรเจกต์ Supabase ของคุณเอง (ไม่บังคับ) เพื่อส่งข้อมูลที่ประมวลผลแล้วเข้าตารางโดยตรงจากเบราว์เซอร์",
              "Optionally connect your own Supabase project to push processed data into a table straight from the browser",
            )}
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
            connected ? "bg-success-soft text-success" : "bg-secondary text-muted-foreground",
          )}
        >
          <span className={cn("size-1.5 rounded-full", connected ? "bg-success" : "bg-muted-foreground/50")} />
          {connected
            ? `${t("ใช้งานอยู่", "Active")} · ${projectRef(saved.url)}`
            : t("ยังไม่ได้เชื่อม · ข้อมูลทั้งหมดประมวลผลและเก็บในเบราว์เซอร์เท่านั้น", "Not connected · all data is processed and kept in this browser only")}
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sb-url">Project URL</Label>
            <Input
              id="sb-url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://abcd1234.supabase.co"
              value={form.url}
              onChange={(e) => set({ url: e.target.value })}
              aria-invalid={Boolean(error)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {t("จาก Supabase → Project Settings → Data API", "From Supabase → Project Settings → Data API")}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sb-key">
              {t("API Key (Publishable / anon)", "API key (publishable / anon)")}
            </Label>
            <Input
              id="sb-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sb_publishable_… หรือ eyJ…"
              value={form.apiKey}
              onChange={(e) => set({ apiKey: e.target.value })}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {t(
                "ใช้คีย์สาธารณะเท่านั้น — ห้ามใช้ service_role key ในเบราว์เซอร์",
                "Use a public key only — never paste a service_role key into a browser",
              )}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sb-table">
              {t("ชื่อตารางปลายทาง (ไม่บังคับ)", "Destination table (optional)")}
            </Label>
            <Input
              id="sb-table"
              autoComplete="off"
              spellCheck={false}
              placeholder="records"
              value={form.table}
              onChange={(e) => set({ table: e.target.value })}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {t(
                "ตารางต้องมีคอลัมน์ตรงกับหัวคอลัมน์ไฟล์ · ตั้งนโยบาย RLS ให้ insert ได้ก่อน",
                "The table's columns should match your file's headers · set an RLS insert policy first",
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void runTest()} disabled={test.kind === "testing"}>
              {test.kind === "testing" ? <Loader2 className="animate-spin" /> : <PlugZap />} {t("ทดสอบการเชื่อมต่อ", "Test connection")}
            </Button>
            {test.kind === "ok" && (
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-success">
                <Check className="size-3.5 shrink-0" />
                <span className="truncate">{test.text}</span>
              </span>
            )}
          </div>
          {test.kind === "fail" && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {test.text}
            </p>
          )}

          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
            {t(
              "ข้อมูลไฟล์ถูกประมวลผลในเบราว์เซอร์ก่อนเสมอ เมื่อกดส่งเข้า Supabase ข้อมูลจะวิ่งตรงจากเบราว์เซอร์ไปยังโปรเจกต์ของคุณ ไม่ผ่านเซิร์ฟเวอร์ของแอป และการตั้งค่านี้เก็บไว้ในเบราว์เซอร์นี้เท่านั้น",
              "Files are always processed in this browser first. When you push to Supabase, data goes directly from the browser to your project — never through this app's server. These settings stay in this browser only.",
            )}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {connected ? (
            <Button type="button" variant="ghost" onClick={clear}>
              {t("ล้างการตั้งค่า", "Clear settings")}
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" variant="signal" onClick={save}>
            {t("บันทึก", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
