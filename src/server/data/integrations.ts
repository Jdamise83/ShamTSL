import type { Ga4Data, GoogleAdsData, SeoData, UnleashedData } from "@/types/integrations";

export const googleAdsMockData: GoogleAdsData = {
  kpiGroups: [
    {
      id: "today",
      label: "Today Real Time",
      metrics: [
        { id: "spend", label: "Spend", value: "£3,420", change: { value: 8.2, direction: "up" } },
        {
          id: "conversions",
          label: "Conversions",
          value: "128",
          change: { value: 5.1, direction: "up" }
        },
        {
          id: "conv_value",
          label: "Conv. Value",
          value: "£18,940",
          change: { value: 10.4, direction: "up" }
        },
        { id: "roas", label: "ROAS", value: "5.54", change: { value: 1.9, direction: "up" } }
      ]
    },
    {
      id: "yesterday",
      label: "Yesterday",
      metrics: [
        {
          id: "spend_y",
          label: "Spend",
          value: "£4,180",
          change: { value: 2.3, direction: "down" }
        },
        {
          id: "conversions_y",
          label: "Conversions",
          value: "142",
          change: { value: 3.4, direction: "up" }
        },
        {
          id: "conv_value_y",
          label: "Conv. Value",
          value: "£21,380",
          change: { value: 7.2, direction: "up" }
        },
        { id: "roas_y", label: "ROAS", value: "5.11", change: { value: 4.7, direction: "up" } }
      ]
    },
    {
      id: "last7",
      label: "Last 7 Days",
      metrics: [
        {
          id: "spend_7",
          label: "Spend",
          value: "£25,760",
          change: { value: 4.1, direction: "up" }
        },
        {
          id: "conversions_7",
          label: "Conversions",
          value: "914",
          change: { value: 6.3, direction: "up" }
        },
        {
          id: "conv_value_7",
          label: "Conv. Value",
          value: "£132,900",
          change: { value: 8.5, direction: "up" }
        },
        { id: "roas_7", label: "ROAS", value: "5.16", change: { value: 3.2, direction: "up" } }
      ]
    },
    {
      id: "mtd",
      label: "Month To Date",
      metrics: [
        {
          id: "spend_mtd",
          label: "Spend",
          value: "£94,110",
          change: { value: 5.7, direction: "up" }
        },
        {
          id: "conversions_mtd",
          label: "Conversions",
          value: "3,720",
          change: { value: 4.9, direction: "up" }
        },
        {
          id: "conv_value_mtd",
          label: "Conv. Value",
          value: "£514,800",
          change: { value: 7.8, direction: "up" }
        },
        { id: "roas_mtd", label: "ROAS", value: "5.47", change: { value: 2.6, direction: "up" } }
      ]
    },
    {
      id: "ytd",
      label: "Year To Date",
      metrics: [
        {
          id: "spend_ytd",
          label: "Spend",
          value: "£1,140,000",
          change: { value: 9.1, direction: "up" }
        },
        {
          id: "conversions_ytd",
          label: "Conversions",
          value: "41,220",
          change: { value: 8.4, direction: "up" }
        },
        {
          id: "conv_value_ytd",
          label: "Conv. Value",
          value: "£6,480,000",
          change: { value: 12.2, direction: "up" }
        },
        { id: "roas_ytd", label: "ROAS", value: "5.68", change: { value: 4.3, direction: "up" } }
      ]
    }
  ],
  charts: {
    trend: [
      { label: "Mon", value: 4.8 },
      { label: "Tue", value: 5.1 },
      { label: "Wed", value: 5.0 },
      { label: "Thu", value: 5.4 },
      { label: "Fri", value: 5.2 },
      { label: "Sat", value: 5.7 },
      { label: "Sun", value: 5.3 }
    ],
    split: [
      { label: "Branded", value: 41 },
      { label: "Non-Branded", value: 59 }
    ]
  },
  tables: [
    {
      key: "campaign-performance",
      title: "Campaign Performance",
      rows: [
        {
          campaign: "Core Search UK",
          spend: "£18,900",
          conversions: 744,
          ctr: "6.4%",
          cpc: "£1.82",
          roas: "6.1"
        },
        {
          campaign: "Shopping Hero",
          spend: "£12,260",
          conversions: 512,
          ctr: "4.3%",
          cpc: "£1.37",
          roas: "5.0"
        },
        {
          campaign: "Remarketing Always On",
          spend: "£5,810",
          conversions: 211,
          ctr: "8.1%",
          cpc: "£0.94",
          roas: "7.4"
        }
      ]
    },
    {
      key: "ad-group-performance",
      title: "Ad Group Performance",
      rows: [
        {
          adGroup: "Nicotine Pouches",
          conversions: 358,
          ctr: "7.2%",
          cpc: "£1.44",
          costPerConversion: "£18.90"
        },
        {
          adGroup: "Slim Pouches",
          conversions: 291,
          ctr: "6.7%",
          cpc: "£1.29",
          costPerConversion: "£16.42"
        },
        {
          adGroup: "Starter Bundle",
          conversions: 122,
          ctr: "5.1%",
          cpc: "£1.76",
          costPerConversion: "£22.10"
        }
      ]
    },
    {
      key: "search-terms",
      title: "Search Terms",
      rows: [
        { term: "snus life pouches", clicks: 1290, ctr: "9.3%", spend: "£1,540" },
        { term: "nicotine pouch subscription", clicks: 790, ctr: "6.9%", spend: "£1,920" },
        { term: "best snus uk", clicks: 540, ctr: "5.4%", spend: "£1,410" }
      ]
    },
    {
      key: "top-campaigns-spend",
      title: "Top Campaigns By Spend",
      rows: [
        { campaign: "Core Search UK", spend: "£18,900" },
        { campaign: "Shopping Hero", spend: "£12,260" },
        { campaign: "Prospecting Video", spend: "£8,620" }
      ]
    },
    {
      key: "top-campaigns-conv-value",
      title: "Top Campaigns By Conversion Value",
      rows: [
        { campaign: "Core Search UK", convValue: "£116,600" },
        { campaign: "Shopping Hero", convValue: "£61,200" },
        { campaign: "Remarketing Always On", convValue: "£43,300" }
      ]
    },
    {
      key: "top-campaigns-roas",
      title: "Top Campaigns By ROAS",
      rows: [
        { campaign: "Remarketing Always On", roas: "7.4" },
        { campaign: "Core Search UK", roas: "6.1" },
        { campaign: "Shopping Hero", roas: "5.0" }
      ]
    }
  ]
};

export const seoMockData: SeoData = {
  kpiGroups: [
    {
      id: "seo_last7",
      label: "Last 7 Days",
      metrics: [
        {
          id: "organic_clicks",
          label: "Organic Clicks",
          value: "34,820",
          change: { value: 6.1, direction: "up" }
        },
        {
          id: "impressions",
          label: "Impressions",
          value: "1.42M",
          change: { value: 8.4, direction: "up" }
        },
        { id: "avg_ctr", label: "Avg CTR", value: "2.45%", change: { value: 0.6, direction: "down" } },
        {
          id: "avg_position",
          label: "Avg Position",
          value: "11.3",
          change: { value: 4.2, direction: "up", label: "improved" }
        }
      ]
    },
    {
      id: "seo_ytd",
      label: "Year To Date",
      metrics: [
        {
          id: "organic_clicks_ytd",
          label: "Organic Clicks",
          value: "1.04M",
          change: { value: 12.9, direction: "up" }
        },
        {
          id: "impressions_ytd",
          label: "Impressions",
          value: "38.2M",
          change: { value: 15.7, direction: "up" }
        },
        { id: "avg_ctr_ytd", label: "Avg CTR", value: "2.73%", change: { value: 2.1, direction: "up" } },
        {
          id: "avg_position_ytd",
          label: "Avg Position",
          value: "9.4",
          change: { value: 7.3, direction: "up", label: "improved" }
        }
      ]
    }
  ],
  charts: {
    trend: [
      { label: "Mon", value: 4200 },
      { label: "Tue", value: 4510 },
      { label: "Wed", value: 4630 },
      { label: "Thu", value: 4790 },
      { label: "Fri", value: 4980 },
      { label: "Sat", value: 5220 },
      { label: "Sun", value: 5490 }
    ],
    split: [
      { label: "Branded", value: 38 },
      { label: "Unbranded", value: 62 }
    ]
  },
  tables: [
    {
      key: "seo-profitability",
      title: "SEO Profitability",
      rows: [
        { period: "Day", revenue: "£11,800", contributionMargin: "41%" },
        { period: "Week", revenue: "£79,600", contributionMargin: "43%" },
        { period: "Month", revenue: "£324,000", contributionMargin: "45%" },
        { period: "YTD", revenue: "£2.51M", contributionMargin: "44%" }
      ]
    },
    {
      key: "top-queries",
      title: "Top Queries",
      rows: [
        { query: "nicotine pouch uk", clicks: 3910, position: "4.2", ctr: "4.4%" },
        { query: "snus life", clicks: 3310, position: "1.4", ctr: "25.1%" },
        { query: "best nicotine pouches", clicks: 1960, position: "6.1", ctr: "3.7%" }
      ]
    },
    {
      key: "top-landing-pages",
      title: "Top Landing Pages",
      rows: [
        { page: "/collections/all", clicks: 7130, cvr: "3.7%" },
        { page: "/products/starter-bundle", clicks: 4350, cvr: "5.6%" },
        { page: "/blogs/news/snusing-guide", clicks: 3180, cvr: "1.9%" }
      ]
    },
    {
      key: "winners-losers",
      title: "Winners And Losers",
      rows: [
        { page: "/products/mint-slim", movement: "+12", note: "Winner" },
        { page: "/products/freeze-strong", movement: "+9", note: "Winner" },
        { page: "/collections/new", movement: "-7", note: "Loser" }
      ]
    },
    {
      key: "position-movements",
      title: "Position Movements",
      rows: [
        { keyword: "nicotine pouch alternatives", previous: "9.1", current: "6.8" },
        { keyword: "what is snus", previous: "5.2", current: "4.9" },
        { keyword: "tobacco free pouch", previous: "8.6", current: "10.3" }
      ]
    },
    {
      key: "opportunity-pages",
      title: "Opportunity Pages",
      rows: [
        { page: "/collections/strong", impressions: 81200, ctr: "1.1%" },
        { page: "/products/ice", impressions: 56100, ctr: "1.6%" },
        { page: "/blogs/news/buying-guide", impressions: 44900, ctr: "0.9%" }
      ]
    }
  ]
};

export const ga4MockData: Ga4Data = {
  kpiGroups: [
    {
      id: "ga4_yesterday",
      label: "Yesterday",
      metrics: [
        { id: "sessions_y", label: "Sessions", value: "24,840", change: { value: 4.9, direction: "up" } },
        { id: "users_y", label: "Users", value: "19,340", change: { value: 3.1, direction: "up" } },
        { id: "revenue_y", label: "Revenue", value: "£61,240", change: { value: 2.7, direction: "down" } },
        { id: "purchases_y", label: "Purchases", value: "1,280", change: { value: 1.2, direction: "up" } }
      ]
    },
    {
      id: "ga4_last7",
      label: "Last 7 Days",
      metrics: [
        { id: "sessions_7", label: "Sessions", value: "171,210", change: { value: 6.2, direction: "up" } },
        { id: "users_7", label: "Users", value: "128,700", change: { value: 5.5, direction: "up" } },
        { id: "revenue_7", label: "Revenue", value: "£429,300", change: { value: 4.8, direction: "up" } },
        { id: "purchases_7", label: "Purchases", value: "8,560", change: { value: 2.4, direction: "up" } }
      ]
    },
    {
      id: "ga4_mtd",
      label: "Month To Date",
      metrics: [
        { id: "sessions_m", label: "Sessions", value: "612,000", change: { value: 8.4, direction: "up" } },
        { id: "users_m", label: "Users", value: "452,110", change: { value: 7.2, direction: "up" } },
        { id: "revenue_m", label: "Revenue", value: "£1.58M", change: { value: 9.7, direction: "up" } },
        { id: "purchases_m", label: "Purchases", value: "31,100", change: { value: 6.3, direction: "up" } }
      ]
    },
    {
      id: "ga4_ytd",
      label: "Year To Date",
      metrics: [
        { id: "sessions_ytd", label: "Sessions", value: "6.9M", change: { value: 10.2, direction: "up" } },
        { id: "users_ytd", label: "Users", value: "5.1M", change: { value: 9.8, direction: "up" } },
        { id: "revenue_ytd", label: "Revenue", value: "£17.4M", change: { value: 12.4, direction: "up" } },
        { id: "purchases_ytd", label: "Purchases", value: "362,400", change: { value: 8.1, direction: "up" } }
      ]
    }
  ],
  charts: {
    trend: [
      { label: "W1", value: 192000 },
      { label: "W2", value: 208000 },
      { label: "W3", value: 215000 },
      { label: "W4", value: 224000 }
    ],
    split: [
      { label: "Mobile", value: 66 },
      { label: "Desktop", value: 29 },
      { label: "Tablet", value: 5 }
    ]
  },
  tables: [
    {
      key: "channel-performance",
      title: "Channel Performance",
      rows: [
        { channel: "Paid Search", sessions: 222100, revenue: "£684,000", cvr: "4.7%" },
        { channel: "Organic Search", sessions: 198800, revenue: "£541,000", cvr: "4.2%" },
        { channel: "Direct", sessions: 130500, revenue: "£311,000", cvr: "3.4%" }
      ]
    },
    {
      key: "landing-pages",
      title: "Landing Pages",
      rows: [
        { page: "/", sessions: 156200, purchases: 5200 },
        { page: "/collections/all", sessions: 139400, purchases: 4710 },
        { page: "/products/starter-bundle", sessions: 112500, purchases: 5960 }
      ]
    },
    {
      key: "source-medium",
      title: "Source / Medium",
      rows: [
        { sourceMedium: "google / cpc", sessions: 228200, purchases: 9750 },
        { sourceMedium: "google / organic", sessions: 181100, purchases: 6990 },
        { sourceMedium: "(direct) / (none)", sessions: 130500, purchases: 4410 }
      ]
    },
    {
      key: "top-products",
      title: "Top Products",
      rows: [
        { product: "Starter Bundle", revenue: "£286,000", units: 16700 },
        { product: "Mint Slim", revenue: "£214,000", units: 13440 },
        { product: "Freeze Strong", revenue: "£199,000", units: 12010 }
      ]
    }
  ]
};

export const unleashedMockData: UnleashedData = {
  kpiGroups: [
    {
      id: "day",
      label: "Day",
      metrics: [
        {
          id: "revenue_day",
          label: "Revenue",
          value: "£12,940",
          change: { value: 4.1, direction: "up" }
        },
        {
          id: "profit_day",
          label: "Total Profit",
          value: "£5,460",
          change: { value: 3.6, direction: "up" }
        }
      ]
    },
    {
      id: "week",
      label: "Week to date",
      metrics: [
        {
          id: "revenue_week",
          label: "Revenue",
          value: "£91,800",
          change: { value: 6.4, direction: "up" }
        },
        {
          id: "profit_week",
          label: "Total Profit",
          value: "£39,300",
          change: { value: 5.7, direction: "up" }
        }
      ]
    },
    {
      id: "month",
      label: "Month to date",
      metrics: [
        {
          id: "revenue_month",
          label: "Revenue",
          value: "£396,500",
          change: { value: 8.1, direction: "up" }
        },
        {
          id: "profit_month",
          label: "Total Profit",
          value: "£171,200",
          change: { value: 7.3, direction: "up" }
        }
      ]
    }
  ],
  charts: {
    trend: [
      { label: "Day", value: 12940 },
      { label: "WTD", value: 91800 },
      { label: "MTD", value: 396500 }
    ],
    split: [
      { label: "Revenue", value: 70 },
      { label: "Total Profit", value: 30 }
    ]
  },
  tables: [
    {
      key: "financial-performance",
      title: "Financial Performance",
      rows: [
        { period: "Day", revenue: "£12,940", totalProfit: "£5,460", profitMargin: "42.2%" },
        { period: "Week to date", revenue: "£91,800", totalProfit: "£39,300", profitMargin: "42.8%" },
        { period: "Month to date", revenue: "£396,500", totalProfit: "£171,200", profitMargin: "43.2%" }
      ]
    },
    {
      key: "revenue-by-channel",
      title: "Revenue by Channel",
      rows: [
        { channel: "DTC", revenue: "£245,700", totalProfit: "£108,900" },
        { channel: "Wholesale", revenue: "£112,400", totalProfit: "£45,800" },
        { channel: "Marketplace", revenue: "£38,400", totalProfit: "£16,500" }
      ]
    }
  ]
};
