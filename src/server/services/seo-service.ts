import "server-only";

import { seoMockData } from "@/server/data/integrations";
import type { SeoData } from "@/types/integrations";

export interface SeoProvider {
  getDashboardData(): Promise<SeoData>;
}

class MockSeoProvider implements SeoProvider {
  async getDashboardData(): Promise<SeoData> {
    return seoMockData;
  }
}

export class SeoService {
  constructor(private readonly provider: SeoProvider) {}

  async getDashboardData() {
    return this.provider.getDashboardData();
  }
}

export const seoService = new SeoService(new MockSeoProvider());
