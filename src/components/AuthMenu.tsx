import { Link } from "react-router-dom";
import { LogIn, LogOut, UserPlus, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const AuthMenu = () => {
  const { user, isAuthed, signOut, loading } = useAuth();

  if (loading) return null;

  if (!isAuthed) {
    return (
      <div className="flex items-center gap-1.5">
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs">
          <Link to="/auth"><LogIn className="h-3.5 w-3.5" /> Sign In</Link>
        </Button>
        <Button asChild size="sm" className="h-8 gap-1 text-xs">
          <Link to="/auth"><UserPlus className="h-3.5 w-3.5" /> Sign Up</Link>
        </Button>
      </div>
    );
  }

  const label = user?.email ?? "Account";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs max-w-[180px]">
          <UserIcon className="h-3.5 w-3.5" />
          <span className="truncate">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuLabel className="text-xs truncate">{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => { await signOut(); toast.success("Signed out"); }}
          className="text-xs cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5 mr-2" /> Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AuthMenu;
