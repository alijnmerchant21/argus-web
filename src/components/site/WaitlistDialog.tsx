import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { joinWaitlist } from "@/lib/waitlist";

type WaitlistDialogProps = {
  /** When set, the dialog is controlled by the parent (no trigger rendered). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Trigger element; omit when using controlled `open` + external buttons. */
  children?: React.ReactNode;
};

export function WaitlistDialog({ open: controlledOpen, onOpenChange, children }: WaitlistDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || loading) return;
    setLoading(true);
    setError(null);
    try {
      await joinWaitlist({ data: { email } });
      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setEmail("");
      }, 2000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children != null ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-tight">Join the Argus waitlist</DialogTitle>
          <DialogDescription>Be first to define the line AI cannot cross.</DialogDescription>
        </DialogHeader>
        {submitted ? (
          <div className="py-8 text-center">
            <p className="text-base font-medium">You&apos;re on the list.</p>
            <p className="mt-1 text-sm text-muted-foreground">We&apos;ll be in touch soon.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <Input
              type="email"
              required
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl"
              disabled={loading}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-full bg-foreground text-background hover:bg-foreground/90"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>Reserve my spot <ArrowRight className="h-4 w-4" /></>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
