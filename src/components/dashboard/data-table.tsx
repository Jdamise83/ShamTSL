import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

interface DataTableProps {
  rows: Record<string, string | number>[];
  emptyMessage?: string;
}

export function DataTable({ rows, emptyMessage = "No records available." }: DataTableProps) {
  if (!rows.length) {
    return <p className="py-8 text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const headers = Object.keys(rows[0]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {headers.map((header) => (
            <TableHead key={header}>{header.replace(/([A-Z])/g, " $1")}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, rowIndex) => (
          <TableRow key={`${Object.values(row).join("-")}-${rowIndex}`}>
            {headers.map((header) => (
              <TableCell key={`${header}-${rowIndex}`} className="text-sm text-foreground">
                {row[header]}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
