export type TrendDirection = "up" | "down" | "flat";

export interface ChangeMetric {
  value: number;
  direction: TrendDirection;
  label?: string;
}

export interface KpiMetric {
  id: string;
  label: string;
  value: string;
  change?: ChangeMetric;
  helperText?: string;
}

export interface KpiGroup {
  id: string;
  label: string;
  metrics: KpiMetric[];
}

export interface LinePoint {
  label: string;
  value: number;
}

export interface PieSlice {
  label: string;
  value: number;
}

export interface TableColumn<T> {
  key: keyof T;
  label: string;
}
