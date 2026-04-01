import { Badge } from "@/components/ui/badge";

interface RangeLabelProps {
  label: string;
}

export function RangeLabel({ label }: RangeLabelProps) {
  return (
    <Badge variant="default" className="w-fit bg-primary/12 text-primary">
      {label}
    </Badge>
  );
}
