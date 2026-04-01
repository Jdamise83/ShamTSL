import { PerformanceModuleView } from "@/components/dashboard/performance-module-view";
import { seoService } from "@/server/services";

export default async function SeoPage() {
  const data = await seoService.getDashboardData();

  return (
    <PerformanceModuleView
      title="SEO"
      description="Search Console style performance with query and landing-page depth."
      data={data}
      splitTitle="Branded vs Unbranded"
    />
  );
}
