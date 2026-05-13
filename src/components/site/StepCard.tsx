import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "sky" | "rose" | "mint";

type Props = {
  number: string;
  title: string;
  description: string;
  Icon: LucideIcon;
  tone: Tone;
  delay?: number;
};

const toneSurface: Record<Tone, string> = {
  sky:  "bg-sky-50   border-sky-200/80",
  rose: "bg-rose-50  border-rose-200/80",
  mint: "bg-emerald-50 border-emerald-200/80",
};

const toneIcon: Record<Tone, string> = {
  sky:  "bg-sky-200/80   text-sky-900",
  rose: "bg-rose-200/80  text-rose-900",
  mint: "bg-emerald-200/80 text-emerald-900",
};

export function StepCard({ number, title, description, Icon, tone, delay = 0 }: Props) {
  return (
    <div
      className={cn(
        "hiw-step-card animate-fade-up group relative overflow-hidden rounded-2xl border p-8 shadow-sm",
        toneSurface[tone],
      )}
      style={{ animationDelay: `${delay}ms` }}
      tabIndex={0}
      role="article"
    >
      {/* sheen sweep overlay */}
      <div className="hiw-step-sheen pointer-events-none absolute inset-0 opacity-0" />

      <div className="relative flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{number}</span>
        <div
          className={cn(
            "grid h-10 w-10 place-items-center rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:shadow-md",
            toneIcon[tone],
          )}
        >
          <Icon className="h-5 w-5 transition-transform duration-300 group-hover:rotate-6" />
        </div>
      </div>

      <h3 className="relative mt-8 text-2xl font-bold tracking-tight">{title}</h3>
      <p className="relative mt-3 leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
