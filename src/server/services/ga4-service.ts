import "server-only";

import { ga4MockData } from "@/server/data/integrations";
import type { Ga4Data } from "@/types/integrations";

export interface Ga4Provider {
  getDashboardData(): Promise<Ga4Data>;
}

class MockGa4Provider implements Ga4Provider {
  async getDashboardData(): Promise<Ga4Data> {
    return ga4MockData;
  }
}

export class Ga4Service {
  constructor(private readonly provider: Ga4Provider) {}

  async getDashboardData() {
    return this.provider.getDashboardData();
  }
}

export const ga4Service = new Ga4Service(new MockGa4Provider());
