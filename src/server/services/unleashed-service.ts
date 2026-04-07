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
  SalesPersonName?: string;
  SalespersonName?: string;
  SalesPerson?: {
    Name?: string;
  };
  Salesperson?: {
    Name?: string;
  };
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

type SalesPersonTotals = {
  salesPerson: string;
  revenue: number;
  totalProfit: number;
};

const UNLEASHED_CACHE_TTL_MS = 5 * 60 * 1000;
const UNLEASHED_REQUEST_TIMEOUT_MS = 12000;
const UNLEASHED_FETCH_CONCURRENCY = 6;

let unleashedCachedData: { data: UnleashedData; expiresAt: number } | null = null;
let unleashedInFlightData: Promise<UnleashedData> | null = null;

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
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, UNLEASHED_REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "api-auth-id": config.apiId,
          "api-auth-signature": signature,
          "client-type": config.clientType
        },
        cache: "no-store",
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Unleashed ${response.status}: ${body || response.statusText}`);
    }

    return (await response.json()) as T;
  }

  private async runWithConcurrency<T>(
    tasks: Array<() => Promise<T>>,
    concurrency = UNLEASHED_FETCH_CONCURRENCY
  ) {
    if (!tasks.length) {
      return [] as T[];
    }

    const results = new Array<T>(tasks.length);
    let currentIndex = 0;

    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
      while (true) {
        const taskIndex = currentIndex;
        currentIndex += 1;

        if (taskIndex >= tasks.length) {
          break;
        }

        results[taskIndex] = await tasks[taskIndex]();
      }
    });

    await Promise.all(workers);
    return results;
  }

  private async fetchInvoices(
    config: UnleashedConfig,
    startDate: string,
    endDate: string
  ) {
    const firstPage = await this.request<UnleashedListResponse<UnleashedInvoice>>(
      config,
      "/Invoices/1",
      {
        startDate,
        endDate,
        invoiceStatus: "Completed",
        pageSize: this.pageSize
      }
    );

    const allItems = [...(firstPage.Items ?? [])];
    const totalPagesRaw = this.toNumber(firstPage.Pagination?.NumberOfPages);
    const totalPages = Math.min(this.maxPages, Math.max(1, totalPagesRaw || 1));

    if (totalPages <= 1) {
      return allItems;
    }

    const tasks: Array<() => Promise<UnleashedListResponse<UnleashedInvoice>>> = [];
    for (let page = 2; page <= totalPages; page += 1) {
      tasks.push(() =>
        this.request<UnleashedListResponse<UnleashedInvoice>>(config, `/Invoices/${page}`, {
          startDate,
          endDate,
          invoiceStatus: "Completed",
          pageSize: this.pageSize
        })
      );
    }

    const pages = await this.runWithConcurrency(tasks);
    for (const page of pages) {
      allItems.push(...(page.Items ?? []));
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

    const firstPage = await this.request<UnleashedListResponse<UnleashedProduct>>(
      config,
      "/Products/1",
      {
        pageSize: this.pageSize
      }
    );

    for (const product of firstPage.Items ?? []) {
      if (!product.Guid) {
        continue;
      }
      if (wantedProductGuids.has(product.Guid)) {
        costByProductGuid.set(product.Guid, this.toNumber(product.AverageLandPrice));
      }
    }

    const totalPagesRaw = this.toNumber(firstPage.Pagination?.NumberOfPages);
    const totalPages = Math.min(this.maxPages, Math.max(1, totalPagesRaw || 1));

    if (costByProductGuid.size >= wantedProductGuids.size || totalPages <= 1) {
      return costByProductGuid;
    }

    const tasks: Array<() => Promise<UnleashedListResponse<UnleashedProduct>>> = [];
    for (let page = 2; page <= totalPages; page += 1) {
      tasks.push(() =>
        this.request<UnleashedListResponse<UnleashedProduct>>(config, `/Products/${page}`, {
          pageSize: this.pageSize
        })
      );
    }

    const pages = await this.runWithConcurrency(tasks);
    for (const page of pages) {
      for (const product of page.Items ?? []) {
        if (!product.Guid) {
          continue;
        }
        if (wantedProductGuids.has(product.Guid)) {
          costByProductGuid.set(product.Guid, this.toNumber(product.AverageLandPrice));
        }
      }

      if (costByProductGuid.size >= wantedProductGuids.size) {
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

  private getSalesPersonName(invoice: UnleashedInvoice) {
    const candidates = [
      invoice.SalesPersonName,
      invoice.SalespersonName,
      invoice.SalesPerson?.Name,
      invoice.Salesperson?.Name
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }

    return "Unassigned";
  }

  private calculateSalesBySalesPerson(
    invoices: UnleashedInvoice[],
    costByProductGuid: Map<string, number>
  ): SalesPersonTotals[] {
    const totalsBySalesPerson = new Map<string, { revenue: number; totalProfit: number }>();

    for (const invoice of invoices) {
      const salesPerson = this.getSalesPersonName(invoice);
      const current = totalsBySalesPerson.get(salesPerson) ?? { revenue: 0, totalProfit: 0 };
      const invoiceRevenue = this.getInvoiceRevenue(invoice);

      let invoiceProfit = 0;
      for (const line of invoice.InvoiceLines ?? []) {
        const lineTotal = this.toNumber(line.LineTotal);
        const quantity = this.toNumber(line.InvoiceQuantity);
        const productGuid = line.Product?.Guid ?? "";
        const unitCost = costByProductGuid.get(productGuid) ?? 0;
        invoiceProfit += lineTotal - unitCost * quantity;
      }

      current.revenue += invoiceRevenue;
      current.totalProfit += invoiceProfit;
      totalsBySalesPerson.set(salesPerson, current);
    }

    return [...totalsBySalesPerson.entries()]
      .map(([salesPerson, totals]) => ({
        salesPerson,
        revenue: totals.revenue,
        totalProfit: totals.totalProfit
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  private buildData(periods: PeriodTotals[], salesBySalesPerson: SalesPersonTotals[]): UnleashedData {
    const periodById = new Map(periods.map((period) => [period.id, period]));
    const month = periodById.get("month");
    const monthRevenue = month?.revenue ?? 0;
    const monthProfit = month?.totalProfit ?? 0;
    const profitShare = monthRevenue > 0 ? Math.round((monthProfit / monthRevenue) * 100) : 0;

    const snapshotMetrics = periods.flatMap((period) => [
      {
        id: `revenue_${period.id}`,
        label: `${period.label} Revenue`,
        value: this.formatCurrency(period.revenue),
        change: undefined
      },
      {
        id: `profit_${period.id}`,
        label: `${period.label} Total Profit`,
        value: this.formatCurrency(period.totalProfit),
        change: undefined
      }
    ]);

    return {
      kpiGroups: [
        {
          id: "snapshot-overview",
          label: "Snapshot Overview",
          metrics: snapshotMetrics
        }
      ],
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
        },
        {
          key: "sales-by-sales-person",
          title: "Sales by Sales Person",
          rows: salesBySalesPerson.length
            ? salesBySalesPerson.map((row) => {
                const margin = row.revenue > 0 ? (row.totalProfit / row.revenue) * 100 : 0;
                return {
                  "Sales Person": row.salesPerson,
                  Revenue: this.formatCurrency(row.revenue),
                  "Total Profit": this.formatCurrency(row.totalProfit),
                  "Profit Margin": `${margin.toFixed(2)}%`
                };
              })
            : [
                {
                  "Sales Person": "No data",
                  Revenue: "-",
                  "Total Profit": "-",
                  "Profit Margin": "-"
                }
              ]
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
      kpiGroups: [
        {
          id: "snapshot-overview",
          label: "Snapshot Overview",
          metrics: periods.flatMap((period) => [
            {
              id: `revenue_${period.id}`,
              label: `${period.label} Revenue`,
              value: "-",
              change: undefined
            },
            {
              id: `profit_${period.id}`,
              label: `${period.label} Total Profit`,
              value: "-",
              change: undefined
            }
          ])
        }
      ],
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
        },
        {
          key: "sales-by-sales-person",
          title: "Sales by Sales Person",
          rows: [
            {
              "Sales Person": "No data",
              Revenue: "-",
              "Total Profit": "-",
              "Profit Margin": "-"
            }
          ]
        }
      ]
    };
  }

  private async fetchDashboardDataFresh(): Promise<UnleashedData> {
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

      const monthRange = ranges.find((range) => range.id === "month");
      const monthInvoices = allInvoices.filter((invoice) => {
        const invoiceDate = this.parseUnleashedDate(invoice.InvoiceDate);
        if (!invoiceDate || !monthRange) {
          return false;
        }

        return invoiceDate >= monthRange.startDate && invoiceDate <= monthRange.endDate;
      });
      const salesBySalesPerson = this.calculateSalesBySalesPerson(monthInvoices, productCosts);

      const data = this.buildData(totals, salesBySalesPerson);
      unleashedCachedData = {
        data,
        expiresAt: Date.now() + UNLEASHED_CACHE_TTL_MS
      };
      return data;
    } catch (error) {
      console.error("[Unleashed] Runtime error. Falling back to empty values.", {
        hasApiId: Boolean(process.env.UNLEASHED_API_ID),
        hasApiKey: Boolean(process.env.UNLEASHED_API_KEY),
        error: error instanceof Error ? error.message : String(error)
      });
      if (unleashedCachedData) {
        return unleashedCachedData.data;
      }
      return this.fallback();
    }
  }

  async getDashboardData(): Promise<UnleashedData> {
    if (unleashedCachedData && Date.now() < unleashedCachedData.expiresAt) {
      return unleashedCachedData.data;
    }

    if (!unleashedInFlightData) {
      unleashedInFlightData = this.fetchDashboardDataFresh();
    }

    try {
      return await unleashedInFlightData;
    } finally {
      unleashedInFlightData = null;
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
