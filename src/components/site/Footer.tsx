export function Footer() {
  return (
    <footer className="mx-auto mt-24 mb-10 w-[min(1200px,calc(100%-2rem))] border-t border-border pt-8">
      <div className="flex flex-col items-start justify-between gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center">
        <p>© {new Date().getFullYear()} Argus</p>
        <p>Define the line AI cannot cross.</p>
      </div>
    </footer>
  );
}
