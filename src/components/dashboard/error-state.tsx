import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ErrorStateProps {
  title: string;
  message: string;
}

export function ErrorState({ title, message }: ErrorStateProps) {
  return (
    <Card className="border-danger/30 bg-card">
      <CardHeader>
        <CardTitle className="text-danger">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
