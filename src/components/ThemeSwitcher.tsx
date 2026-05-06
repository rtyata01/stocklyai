import { Moon, Sun, SunMedium } from "lucide-react";
import { useTheme, Theme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const options: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "medium", label: "Medium", icon: SunMedium },
  { value: "dark", label: "Dark", icon: Moon },
];

const ThemeSwitcher = () => {
  const { theme, setTheme } = useTheme();
  return (
    <div className="inline-flex items-center gap-0.5 border border-border rounded-sm p-0.5 bg-secondary/40">
      {options.map(({ value, label, icon: Icon }) => (
        <Tooltip key={value}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(value)}
              className={`h-6 w-6 p-0 ${theme === value ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground hover:text-foreground"}`}
              aria-label={`${label} theme`}
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">{label} theme</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
};

export default ThemeSwitcher;
