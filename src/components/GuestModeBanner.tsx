import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SignupBenefits from "@/components/SignupBenefits";

export default function GuestModeBanner({ subject }: { subject: "portfolio" | "watchlists" }) {
  return (
    <div className="mb-4 border border-border rounded-sm bg-secondary/40 px-3 py-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Guest mode — your {subject} {subject === "portfolio" ? "is" : "are"} saved on this device.</p>
        <Button asChild variant="outline" size="sm" className="text-xs">
          <Link to="/auth">Sign in / Create account</Link>
        </Button>
      </div>
      <SignupBenefits compact />
    </div>
  );
}