import "server-only";

import { unleashedMockData } from "@/server/data/integrations";
import type { UnleashedData } from "@/types/integrations";

export interface UnleashedProvider {
  getDashboardData(): Promise<UnleashedData>;
}

class MockUnleashedProvider implements UnleashedProvider {
  async getDashboardData(): Promise<UnleashedData> {
    return unleashedMockData;
  }
}

export class UnleashedService {
  constructor(private readonly provider: UnleashedProvider) {}

  async getDashboardData() {
    return this.provider.getDashboardData();
  }
}

export const unleashedService = new UnleashedService(new MockUnleashedProvider());
