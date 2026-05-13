import { Link } from "@tanstack/react-router";

export function TopNav() {
  return (
    <header className="w-full">
      <nav className="mx-auto flex w-[min(1200px,calc(100%-2rem))] items-center justify-between gap-4 py-5 sm:py-6">
        <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-6">
          <Link
            to="/"
            className="flex shrink-0 items-center rounded-xl bg-black p-2 pr-3 ring-1 ring-black/10 transition-transform hover:scale-[1.02] active:scale-[0.99]"
          >
            <img
              src="/argus-logo.png"
              alt="Argus"
              className="h-8 w-auto object-contain sm:h-9"
              width={140}
              height={42}
            />
          </Link>
          <Link
            to="/how-it-works"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            How it works
          </Link>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex h-10 shrink-0 items-center rounded-full border border-border bg-background px-4 text-sm font-semibold shadow-sm transition-colors hover:bg-secondary sm:h-11 sm:px-5"
        >
          Login
        </Link>
      </nav>
    </header>
  );
}
