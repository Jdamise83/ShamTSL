import "server-only";

import { createHmac } from "crypto";

import type { UnleashedData } from "@/types/integrations";

type UnleashedConfig = {
  apiId: string;
  apiKey: string;
  baseUrl: string;
  clientType: string;
};

type UnleashedPagination = {
  NumberOfPages?: number;
};

type UnleashedListResponse<T> = {
  Items?: T[];
  Pagination?: UnleashedPagination;
};

type UnleashedInvoiceLine = {
  LineTotal?: number;
  InvoiceQuantity?: number;
  Product?: {
    Guid?: string;
  };
};

type UnleashedInvoice = {
  Guid?: string;
  InvoiceDate?: string;
  SubTotal?: number;
  InvoiceLines?: UnleashedInvoiceLine[];
};

type UnleashedProduct = {
  Guid?: string;
  AverageLandPrice?: number;
};

type PeriodRange = {
  id: "day" | "week" | "month" | "ytd";
  label: "Day" | "Week to date" | "Month to date" | "YTD";
  startDate: string;
  endDate: string;
};

type PeriodTotals = {
  id: PeriodRange["id"];
  label: PeriodRange["label"];
  revenue: number;
  totalProfit: number;
};

export interface UnleashedProvider {
  getDashboardData(): Promise<UnleashedData>;
}

class RealUnleashedProvider implements UnleashedProvider {
  private readonly pageSize = 200;
  private readonly maxPages = 100;

  private readEnv(name: string, required = true) {
    const value = process.env[name]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
    if (!value && required) {
      throw new Error(`Missing ${name}`);
    }
    return value;
  }

  private getConfig(): UnleashedConfig {
    return {
      apiId: this.readEnv("UNLEASHED_API_ID"),
      apiKey: this.readEnv("UNLEASHED_API_KEY"),
      baseUrl: this.readEnv("UNLEASHED_BASE_URL", false) || "https://api.unleashedsoftware.com",
      clientType: this.readEnv("UNLEASHED_CLIENT_TYPE", false) || "thesnuslife-dashboard"
    };
  }

  private toIsoDate(date: Date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private startOfUtcDay(date = new Date()) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private startOfWeekMonday(date: Date) {
    const start = this.startOfUtcDay(date);
    const day = start.getUTCDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    start.setUTCDate(start.getUTCDate() - diffToMonday);
    return start;
  }

  private startOfMonth(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  private startOfYear(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  }

  private buildRanges(): PeriodRange[] {
    const today = this.startOfUtcDay();
    const endDate = this.toIsoDate(today);

    return [
      {
        id: "day",
        label: "Day",
        startDate: endDate,
        endDate
      },
      {
        id: "week",
        label: "Week to date",
        startDate: this.toIsoDate(this.startOfWeekMonday(today)),
        endDate
      },
      {
        id: "month",
        label: "Month to date",
        startDate: this.toIsoDate(this.startOfMonth(today)),
        endDate
      },
      {
        id: "ytd",
        label: "YTD",
        startDate: this.toIsoDate(this.startOfYear(today)),
        endDate
      }
    ];
  }

  private formatCurrency(value: number) {
    return `£${value.toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  private toNumber(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  private parseUnleashedDate(rawDate?: string) {
    if (!rawDate) {
      return null;
    }

    const serializedMatch = rawDate.match(/\/Date\((\d+)(?:[+-]\d+)?\)\//);
    if (serializedMatch?.[1]) {
      const timestamp = Number(serializedMatch[1]);
      if (Number.isFinite(timestamp)) {
        return this.toIsoDate(new Date(timestamp));
      }
    }

    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return this.toIsoDate(parsed);
  }

  private signQuery(queryString: string, apiKey: string) {
    return createHmac("sha256", apiKey).update(queryString).digest("base64");
  }

  private async request<T>(
    config: UnleashedConfig,
    path: string,
    query: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }
      params.set(key, String(value));
    }

    const queryString = params.toString();
    const signature = this.signQuery(queryString, config.apiKey);
    const url = `${config.baseUrl}${path}${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-auth-id": config.apiId,
        "api-auth-signature": signature,
        "client-type": config.clientType
      },
      cache: "no-store"
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Unleashed ${response.status}: ${body || response.statusText}`);
    }

    return (await response.json()) as T;
  }

  private async fetchInvoices(
    config: UnleashedConfig,
    startDate: string,
    endDate: string
  ) {
    const allItems: UnleashedInvoice[] = [];

    for (let page = 1; page <= this.maxPages; page += 1) {
      const response = await this.request<UnleashedListResponse<UnleashedInvoice>>(
        config,
        `/Invoices/${page}`,
        {
          startDate,
          endDate,
          invoiceStatus: "Completed",
          pageSize: this.pageSize
        }
      );

      const items = response.Items ?? [];
      allItems.push(...items);

      const numberOfPages = this.toNumber(response.Pagination?.NumberOfPages);
      if ((numberOfPages > 0 && page >= numberOfPages) || items.length < this.pageSize) {
        break;
      }
    }

    return allItems;
  }

  private async fetchProductCosts(
    config: UnleashedConfig,
    productGuids: string[]
  ) {
    const costByProductGuid = new Map<string, number>();
    if (!productGuids.length) {
      return costByProductGuid;
    }

    const wantedProductGuids = new Set(productGuids);

    for (let page = 1; page <= this.maxPages; page += 1) {
      const response = await this.request<UnleashedListResponse<UnleashedProduct>>(
        config,
        `/Products/${page}`,
        {
          pageSize: this.pageSize
        }
      );

      for (const product of response.Items ?? []) {
        if (!product.Guid) {
          continue;
        }
        if (wantedProductGuids.has(product.Guid)) {
          costByProductGuid.set(product.Guid, this.toNumber(product.AverageLandPrice));
        }
      }

      const numberOfPages = this.toNumber(response.Pagination?.NumberOfPages);
      const items = response.Items ?? [];

      if (
        costByProductGuid.size >= wantedProductGuids.size ||
        (numberOfPages > 0 && page >= numberOfPages) ||
        items.length < this.pageSize
      ) {
        break;
      }
    }

    return costByProductGuid;
  }

  private getInvoiceRevenue(invoice: UnleashedInvoice) {
    const subTotal = this.toNumber(invoice.SubTotal);
    if (subTotal > 0) {
      return subTotal;
    }

    return (invoice.InvoiceLines ?? []).reduce((sum, line) => sum + this.toNumber(line.LineTotal), 0);
  }

  private calculateTotals(
    invoices: UnleashedInvoice[],
    costByProductGuid: Map<string, number>
  ) {
    let revenue = 0;
    let totalProfit = 0;

    for (const invoice of invoices) {
      revenue += this.getInvoiceRevenue(invoice);

      for (const line of invoice.InvoiceLines ?? []) {
        const lineTotal = this.toNumber(line.LineTotal);
        const quantity = this.toNumber(line.InvoiceQuantity);
        const productGuid = line.Product?.Guid ?? "";
        const unitCost = costByProductGuid.get(productGuid) ?? 0;

        totalProfit += lineTotal - unitCost * quantity;
      }
    }

    return { revenue, totalProfit };
  }

  private buildData(periods: PeriodTotals[]): UnleashedData {
    const periodById = new Map(periods.map((period) => [period.id, period]));
    const month = periodById.get("month");
    const monthRevenue = month?.revenue ?? 0;
    const monthProfit = month?.totalProfit ?? 0;
    const profitShare = monthRevenue > 0 ? Math.round((monthProfit / monthRevenue) * 100) : 0;

    return {
      kpiGroups: periods.map((period) => ({
        id: period.id,
        label: period.label,
        metrics: [
          {
            id: `revenue_${period.id}`,
            label: "Revenue",
            value: this.formatCurrency(period.revenue),
            change: undefined
          },
          {
            id: `profit_${period.id}`,
            label: "Total Profit",
            value: this.formatCurrency(period.totalProfit),
            change: undefined
          }
        ]
      })),
      charts: {
        trend: periods.map((period) => ({
          label:
            period.id === "week"
              ? "WTD"
              : period.id === "month"
                ? "MTD"
                : period.id === "ytd"
                  ? "YTD"
                  : "Day",
          value: Math.round(period.revenue)
        })),
        split: [
          { label: "Profit Margin", value: Math.max(0, Math.min(100, profitShare)) },
          { label: "COGS Share", value: Math.max(0, 100 - Math.max(0, Math.min(100, profitShare))) }
        ]
      },
      tables: [
        {
          key: "financial-performance",
          title: "Financial Performance",
          rows: periods.map((period) => {
            const margin = period.revenue > 0 ? (period.totalProfit / period.revenue) * 100 : 0;

            return {
              Period: period.label,
              Revenue: this.formatCurrency(period.revenue),
              "Total Profit": this.formatCurrency(period.totalProfit),
              "Profit Margin": `${margin.toFixed(2)}%`
            };
          })
        }
      ]
    };
  }

  private fallback(): UnleashedData {
    const periods = [
      { id: "day", label: "Day" },
      { id: "week", label: "Week to date" },
      { id: "month", label: "Month to date" },
      { id: "ytd", label: "YTD" }
    ] as const;

    return {
      kpiGroups: periods.map((period) => ({
        id: period.id,
        label: period.label,
        metrics: [
          { id: `revenue_${period.id}`, label: "Revenue", value: "-", change: undefined },
          { id: `profit_${period.id}`, label: "Total Profit", value: "-", change: undefined }
        ]
      })),
      charts: {
        trend: [
          { label: "Day", value: 0 },
          { label: "WTD", value: 0 },
          { label: "MTD", value: 0 },
          { label: "YTD", value: 0 }
        ],
        split: [
          { label: "Profit Margin", value: 0 },
          { label: "COGS Share", value: 0 }
        ]
      },
      tables: [
        {
          key: "financial-performance",
          title: "Financial Performance",
          rows: periods.map((period) => ({
            Period: period.label,
            Revenue: "-",
            "Total Profit": "-",
            "Profit Margin": "-"
          }))
        }
      ]
    };
  }

  async getDashboardData(): Promise<UnleashedData> {
    try {
      const config = this.getConfig();
      const ranges = this.buildRanges();
      const earliestStartDate = ranges[ranges.length - 1]?.startDate ?? this.toIsoDate(this.startOfUtcDay());
      const endDate = ranges[0]?.endDate ?? this.toIsoDate(this.startOfUtcDay());

      const allInvoices = await this.fetchInvoices(config, earliestStartDate, endDate);
      const productGuids = Array.from(
        new Set(
          allInvoices.flatMap((invoice) =>
            (invoice.InvoiceLines ?? [])
              .map((line) => line.Product?.Guid ?? "")
              .filter(Boolean)
          )
        )
      );
      const productCosts = await this.fetchProductCosts(config, productGuids);

      const totals = ranges.map((range) => {
        const rangeInvoices = allInvoices.filter((invoice) => {
          const invoiceDate = this.parseUnleashedDate(invoice.InvoiceDate);
          if (!invoiceDate) {
            return false;
          }

          return invoiceDate >= range.startDate && invoiceDate <= range.endDate;
        });

        const summary = this.calculateTotals(rangeInvoices, productCosts);
        return {
          id: range.id,
          label: range.label,
          revenue: summary.revenue,
          totalProfit: summary.totalProfit
        } satisfies PeriodTotals;
      });

      return this.buildData(totals);
    } catch (error) {
      console.error("[Unleashed] Runtime error. Falling back to empty values.", {
        hasApiId: Boolean(process.env.UNLEASHED_API_ID),
        hasApiKey: Boolean(process.env.UNLEASHED_API_KEY),
        error: error instanceof Error ? error.message : String(error)
      });
      return this.fallback();
    }
  }
}

export class UnleashedService {
  constructor(private readonly provider: UnleashedProvider) {}

  async getDashboardData() {
    return this.provider.getDashboardData();
  }
}

function resolveProvider(): UnleashedProvider {
  const hasUnleashedApiConfig = Boolean(
    process.env.UNLEASHED_API_ID?.trim() && process.env.UNLEASHED_API_KEY?.trim()
  );

  if (!hasUnleashedApiConfig) {
    console.warn("[Unleashed] Missing API credentials. Returning fallback values.");
  }

  return new RealUnleashedProvider();
}

export const unleashedService = new UnleashedService(resolveProvider());
