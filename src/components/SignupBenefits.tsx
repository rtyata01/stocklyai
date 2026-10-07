import { Bell, Cloud, Mail, ShieldCheck } from "lucide-react";

const benefits = [
  { label: "Save your portfolio forever", icon: ShieldCheck },
  { label: "Sync across devices", icon: Cloud },
  { label: "Monday email debrief", icon: Mail, upcoming: true },
  { label: "Price alerts", icon: Bell, upcoming: true },
];

export default function SignupBenefits({ compact = false }: { compact?: boolean }) {
  return (
    <ul className={compact ? "flex flex-wrap gap-x-5 gap-y-2" : "grid gap-2.5"} aria-label="Account benefits">
      {benefits.map(({ label, icon: Icon, upcoming }) => (
        <li key={label} className="flex items-center gap-2 text-xs text-foreground">
          <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>{label}</span>
          {upcoming && <span className="text-[10px] text-muted-foreground">Coming soon</span>}
        </li>
      ))}
    </ul>
  );
}