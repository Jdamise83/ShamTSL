import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CalendarShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function CalendarShell({ title, subtitle, children }: CalendarShellProps) {
  return (
    <Card className="border-border/80 bg-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg uppercase tracking-[0.08em]">{title}</CardTitle>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
