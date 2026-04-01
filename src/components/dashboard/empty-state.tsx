import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <Card className="border-border/80 bg-card">
      <CardContent className="py-12 text-center text-sm text-muted-foreground">{message}</CardContent>
    </Card>
  );
}
