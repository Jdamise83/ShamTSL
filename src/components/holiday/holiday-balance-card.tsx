import { Card, CardContent } from "@/components/ui/card";
import type { StaffMember } from "@/types/holiday";

interface HolidayBalanceCardProps {
  staff: StaffMember;
}

export function HolidayBalanceCard({ staff }: HolidayBalanceCardProps) {
  return (
    <Card className="border-border/80 bg-card">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{staff.fullName}</p>
        <p className="mt-1 text-sm text-muted-foreground">{staff.roleTitle}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Annual</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{staff.annualAllowance}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Used</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{staff.usedHoliday}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Remaining</p>
            <p className="mt-1 text-xl font-semibold text-primary">{staff.remainingHoliday}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{staff.pendingRequests}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
