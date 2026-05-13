import { useState } from "react";
import { ArrowRight } from "lucide-react";
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
  const [submitted, setSubmitted] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
    setTimeout(() => {
      setOpen(false);
      setSubmitted(false);
      setEmail("");
    }, 1500);
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
            />
            <DialogFooter>
              <Button type="submit" className="h-11 w-full rounded-full bg-foreground text-background hover:bg-foreground/90">
                Reserve my spot <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
