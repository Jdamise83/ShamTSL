import "server-only";

import { googleAdsMockData } from "@/server/data/integrations";
import type { GoogleAdsData } from "@/types/integrations";

export interface GoogleAdsProvider {
  getDashboardData(): Promise<GoogleAdsData>;
}

class MockGoogleAdsProvider implements GoogleAdsProvider {
  async getDashboardData(): Promise<GoogleAdsData> {
    return googleAdsMockData;
  }
}

export class GoogleAdsService {
  constructor(private readonly provider: GoogleAdsProvider) {}

  async getDashboardData() {
    return this.provider.getDashboardData();
  }
}

export const googleAdsService = new GoogleAdsService(new MockGoogleAdsProvider());
