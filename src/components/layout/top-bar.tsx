import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

interface TopBarProps {
  userEmail: string;
  onSignOut: (formData: FormData) => Promise<void>;
}

export function TopBar({ userEmail, onSignOut }: TopBarProps) {
  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Internal Dashboard</p>
        <p className="mt-1 text-sm text-muted-foreground">Signed in as {userEmail}</p>
      </div>
      <form action={onSignOut}>
        <Button variant="outline" size="sm" className="gap-2">
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </form>
    </header>
  );
}
