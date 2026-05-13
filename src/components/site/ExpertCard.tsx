type Props = {
  label: string;
  symbol: string;
  pastel: string;    // Tailwind bg class
  className?: string;
  delay?: number;
  size?: "sm" | "md" | "lg" | "xl";
};

const emojiSize: Record<NonNullable<Props["size"]>, string> = {
  sm: "text-2xl",
  md: "text-3xl",
  lg: "text-4xl",
  xl: "text-5xl",
};

const labelSize: Record<NonNullable<Props["size"]>, string> = {
  sm: "text-xs sm:text-sm",
  md: "text-sm sm:text-base",
  lg: "text-base sm:text-lg",
  xl: "text-xl sm:text-2xl",
};

export function ExpertCard({ label, symbol, pastel, className = "", delay = 0, size = "md" }: Props) {
  return (
    <div
      className={`expert-card-bento animate-pop-in group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-black/[0.06] px-4 py-4 shadow-sm sm:px-5 sm:py-5 ${pastel} ${className}`}
      style={{ animationDelay: `${delay}ms` }}
      tabIndex={0}
    >
      {/* emoji — spins + bounces on hover */}
      <span
        className={`inline-block select-none leading-none transition-transform duration-300 motion-safe:group-hover:scale-125 motion-safe:group-hover:-rotate-6 motion-safe:group-active:scale-95 ${emojiSize[size]}`}
        aria-hidden
      >
        {symbol}
      </span>

      {/* label — clamped so it never overflows */}
      <span
        className={`mt-3 block overflow-hidden font-semibold leading-tight tracking-tight text-slate-900 ${labelSize[size]}`}
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {label}
      </span>

      {/* animated accent underline */}
      <span className="mt-2 block h-0.5 w-5 rounded-full bg-black/15 transition-all duration-300 motion-safe:group-hover:w-10 motion-safe:group-hover:bg-black/30" />
    </div>
  );
}
