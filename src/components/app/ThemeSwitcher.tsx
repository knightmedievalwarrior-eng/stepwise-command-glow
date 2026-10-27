import { Check, Crown, Lock, Palette } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { tt, useT } from "@/lib/i18n";
import { usePro } from "@/lib/plan";
import { THEMES, setTheme, useThemeChoice, type ThemeDef } from "@/lib/theme";
import { openUpgrade } from "@/lib/upgrade";
import { cn } from "@/lib/utils";

function Swatch({ def, dimmed }: { def: ThemeDef; dimmed?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 overflow-hidden rounded-md border border-border",
        dimmed && "opacity-55",
      )}
    >
      <span className="h-full w-2/5" style={{ backgroundColor: def.swatch[0] }} />
      <span className="h-full w-2/5" style={{ backgroundColor: def.swatch[1] }} />
      <span className="h-full w-1/5" style={{ backgroundColor: def.swatch[2] }} />
    </span>
  );
}

/**
 * Header theme picker. Light is free; every other theme needs the paid plan
 * and shows a padlock until then (payment wiring arrives later).
 */
export function ThemeSwitcher() {
  const { t, tr } = useT();
  const pro = usePro();
  const chosen = useThemeChoice();
  const [open, setOpen] = useState(false);

  const pick = (def: ThemeDef) => {
    if (setTheme(def.id)) return;
    openUpgrade();
    toast.info(tt("ธีมนี้รวมอยู่ในแพ็กเกจเสียเงิน", "This theme comes with the paid plan"), {
      description: tt(
        "สมัครแพ็กเกจเพื่อปลดล็อกธีมพื้นหลังพิเศษทั้งหมด",
        "Subscribe to unlock all special background themes",
      ),
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("เลือกธีมพื้นหลัง", "Choose background theme")}
        >
          <Palette />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <p className="eyebrow px-2 pb-1.5 pt-1">{t("ธีมพื้นหลัง", "Background theme")}</p>
        <div className="flex flex-col gap-0.5">
          {THEMES.map((def) => {
            const locked = def.paid && !pro;
            return (
              <button
                key={def.id}
                type="button"
                onClick={() => pick(def)}
                aria-pressed={chosen === def.id}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                  chosen === def.id && "bg-accent",
                )}
              >
                <Swatch def={def} dimmed={locked} />
                <span className="flex-1 font-medium">{tr(def.label)}</span>
                {chosen === def.id && <Check className="size-4 text-success" />}
                {locked && (
                  <Lock
                    className="size-3.5 text-muted-foreground"
                    aria-label={t("ล็อก — ต้องอัปเกรด", "Locked — upgrade required")}
                  />
                )}
                {def.paid && !locked && <Crown className="size-3.5 text-signal" />}
              </button>
            );
          })}
        </div>
        {!pro && (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              openUpgrade();
            }}
            className="mt-1.5 flex w-full items-start gap-2 rounded-lg bg-signal-soft px-2.5 py-2 text-left text-xs leading-relaxed text-muted-foreground transition-colors hover:text-foreground"
          >
            <Crown className="mt-0.5 size-3.5 shrink-0 text-signal" />
            <span>
              {t(
                "ธีมพิเศษรวมอยู่ในแพ็กเกจเสียเงิน — แตะเพื่อดูรายละเอียดการอัปเกรด",
                "Special themes come with the paid plan — tap to see upgrade details",
              )}
            </span>
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
