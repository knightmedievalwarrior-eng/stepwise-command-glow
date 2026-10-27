import { Link } from "@tanstack/react-router";
import { ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import logo from "@/assets/logo-mark.png";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { wipeAll } from "@/lib/session-store";

import { N8nSettingsDialog } from "./N8nSettingsDialog";
import { RunIndicator } from "./RunIndicator";
import { TrialBadge } from "./TrialBadge";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logo} alt="" width={28} height={28} className="size-7 rounded-md" />
          <span className="text-[0.95rem] font-semibold tracking-tight">
            Task Runner
            <span className="ml-1.5 hidden font-normal text-muted-foreground sm:inline">
              / Command Center
            </span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1.5">
          <RunIndicator />
          <TrialBadge />
          <N8nSettingsDialog />
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5 text-success" />
                <span className="hidden lg:inline">ข้อมูลอยู่ในเบราว์เซอร์นี้เท่านั้น</span>
                <span className="hidden sm:inline lg:hidden">ไม่เก็บบนเซิร์ฟเวอร์</span>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-64 text-xs leading-relaxed">
              ข้อมูลงานและข้อมูลลูกค้าไม่ถูกเก็บบนเซิร์ฟเวอร์ของแอปนี้ (เมื่อเชื่อม n8n จะส่งตรงไปที่ n8n ของคุณ) และถูกลบเมื่อปิดแท็บหรือเมื่องานเสร็จ
              ประวัติเก็บไว้เพียงสรุปที่ไม่ระบุตัวบุคคล
            </TooltipContent>
          </Tooltip>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="ล้างข้อมูลทั้งหมด">
                <Trash2 />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>ล้างข้อมูลทั้งหมด?</AlertDialogTitle>
                <AlertDialogDescription>
                  งานค้างทั้งหมดและประวัติการใช้งานในเบราว์เซอร์นี้จะถูกลบถาวร ไม่สามารถกู้คืนได้
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    wipeAll();
                    toast.success("ลบข้อมูลทั้งหมดแล้ว");
                  }}
                >
                  ลบทั้งหมด
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </header>
  );
}
