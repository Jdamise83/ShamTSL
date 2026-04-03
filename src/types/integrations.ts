import type { KpiGroup, LinePoint, PieSlice } from "@/types/dashboard";

export interface PerformanceModuleData {
  kpiGroups: KpiGroup[];
  charts: {
    trend: LinePoint[];
    split?: PieSlice[];
  };
  tables: {
    key: string;
    title: string;
    rows: Record<string, string | number>[];
  }[];
}

export type GoogleAdsData = PerformanceModuleData;
export type SeoData = PerformanceModuleData;
export type Ga4Data = PerformanceModuleData;
export type UnleashedData = PerformanceModuleData;
export type ShopifyData = PerformanceModuleData;
