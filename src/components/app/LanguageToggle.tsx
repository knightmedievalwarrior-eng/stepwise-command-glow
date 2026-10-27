import { setLang, useLang, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const OPTIONS: { id: Lang; short: string; name: string }[] = [
  { id: "th", short: "TH", name: "ไทย" },
  { id: "en", short: "EN", name: "English" },
];

/** Header TH / EN switch. The choice persists per browser (localStorage). */
export function LanguageToggle() {
  const lang = useLang();

  return (
    <div
      role="group"
      aria-label="เลือกภาษา / Choose language"
      className="flex items-center rounded-full border border-border bg-card p-0.5"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={lang === option.id}
          aria-label={option.name}
          onClick={() => setLang(option.id)}
          className={cn(
            "rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide transition-colors",
            lang === option.id
              ? "bg-signal text-signal-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.short}
        </button>
      ))}
    </div>
  );
}
