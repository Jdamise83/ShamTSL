import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StaffMember } from "@/types/holiday";

interface StaffProfilePanelProps {
  staff: StaffMember | null;
}

export function StaffProfilePanel({ staff }: StaffProfilePanelProps) {
  if (!staff) {
    return (
      <Card className="border-border/80 bg-card">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Select a team member to view individual leave profile.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/80 bg-card">
      <CardHeader>
        <CardTitle className="text-lg uppercase tracking-[0.08em]">Staff Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-base font-semibold text-foreground">{staff.fullName}</p>
          <p className="text-sm text-muted-foreground">{staff.email}</p>
          <p className="text-sm text-muted-foreground">{staff.roleTitle}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <Badge variant="muted">Credited: {staff.creditedHoliday}d</Badge>
          <Badge variant="muted">Removed: {staff.removedHoliday}d</Badge>
          <Badge variant="muted">Manual: {staff.manualAdjustments}d</Badge>
          <Badge variant="success">Approved: {staff.approvedRequests}</Badge>
          <Badge variant="danger">Rejected: {staff.rejectedRequests}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
