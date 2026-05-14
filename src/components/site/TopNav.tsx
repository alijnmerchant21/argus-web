import { Link, useRouter } from "@tanstack/react-router";
import { logoutFn, type SessionUser } from "@/lib/auth";

type TopNavProps = {
  session: SessionUser | null;
};

export function TopNav({ session }: TopNavProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await logoutFn();
    await router.invalidate();
    await router.navigate({ to: "/login" });
  };

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
        </div>

        {session ? (
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex h-10 shrink-0 items-center rounded-full border border-border bg-background px-4 text-sm font-semibold shadow-sm transition-colors hover:bg-secondary sm:h-11 sm:px-5"
          >
            Sign out
          </button>
        ) : (
          <Link
            to="/login"
            className="inline-flex h-10 shrink-0 items-center rounded-full border border-border bg-background px-4 text-sm font-semibold shadow-sm transition-colors hover:bg-secondary sm:h-11 sm:px-5"
          >
            Login
          </Link>
        )}
      </nav>
    </header>
  );
}
