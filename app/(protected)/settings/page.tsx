import { Bell, Palette, ShieldCheck } from "lucide-react";

import { SectionHeader } from "@/components/dashboard/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <SectionHeader
        title="Settings"
        description="Control dashboard preferences and integration readiness for future API connections."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base uppercase tracking-[0.08em]">
              <Palette className="h-4 w-4 text-primary" />
              Dashboard Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Choose default date ranges and KPI display order in `dashboard_preferences` table.</p>
            <Badge variant="muted">Default Theme: The Snus Life Light</Badge>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base uppercase tracking-[0.08em]">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Access Control
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>All private routes are protected by Supabase auth middleware and server session checks.</p>
            <Badge variant="success">Auth Enabled</Badge>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base uppercase tracking-[0.08em]">
              <Bell className="h-4 w-4 text-primary" />
              Alerts & Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Wire this area to Slack, email, or Ops alerts once live providers are connected.</p>
            <Badge variant="outline">Coming Next</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
