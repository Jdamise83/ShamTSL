const [report] = await client.runReport({
  property: `properties/${propertyId}`,
  dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
  metrics: [{ name: "activeUsers" }]
});

console.log("GA4 FULL RESPONSE:", JSON.stringify(report, null, 2));