import type { CalendarEvent } from "@/types/calendar";

export const seededCalendarEvents: CalendarEvent[] = [
  {
    id: "evt_1",
    title: "Weekly Performance Sync",
    description: "Review core channels and pacing against plan.",
    imageUrl: null,
    customColor: null,
    ownerEmail: null,
    location: "HQ Boardroom",
    meetingLink: "https://meet.google.com/mock-sync",
    internalNotes: "Bring prior-week anomalies and action log.",
    status: "confirmed",
    eventType: "meeting",
    allDay: false,
    calendarScope: "main",
    personalOwner: null,
    brandCampaignType: null,
    notifyBoth: false,
    startsAt: "2026-04-02T09:00:00.000Z",
    endsAt: "2026-04-02T10:00:00.000Z",
    createdBy: "admin",
    createdAt: "2026-03-28T09:00:00.000Z",
    updatedAt: "2026-03-28T09:00:00.000Z",
    attendees: [
      {
        id: "att_1",
        eventId: "evt_1",
        email: "ops@thesnuslife.com",
        displayName: "Ops Team",
        createdAt: "2026-03-28T09:00:00.000Z"
      },
      {
        id: "att_2",
        eventId: "evt_1",
        email: "marketing@thesnuslife.com",
        displayName: "Marketing Team",
        createdAt: "2026-03-28T09:00:00.000Z"
      }
    ]
  },
  {
    id: "evt_2",
    title: "Agency Creative Review",
    description: "Approve new ad concepts and rollout windows.",
    imageUrl: null,
    customColor: null,
    ownerEmail: null,
    location: "Zoom",
    meetingLink: "https://zoom.us/mock-creative",
    internalNotes: null,
    status: "planned",
    eventType: "meeting",
    allDay: false,
    calendarScope: "main",
    personalOwner: null,
    brandCampaignType: null,
    notifyBoth: false,
    startsAt: "2026-04-03T13:00:00.000Z",
    endsAt: "2026-04-03T14:00:00.000Z",
    createdBy: "admin",
    createdAt: "2026-03-29T09:00:00.000Z",
    updatedAt: "2026-03-29T09:00:00.000Z",
    attendees: [
      {
        id: "att_3",
        eventId: "evt_2",
        email: "ceo@thesnuslife.com",
        displayName: "CEO",
        createdAt: "2026-03-29T09:00:00.000Z"
      }
    ]
  },
  {
    id: "evt_3",
    title: "Unleashed Margin Workshop",
    description: "Validate margin movement by channel.",
    imageUrl: null,
    customColor: null,
    ownerEmail: null,
    location: "War Room",
    meetingLink: null,
    internalNotes: "Focus on wholesale margin erosion.",
    status: "planned",
    eventType: "meeting",
    allDay: false,
    calendarScope: "main",
    personalOwner: null,
    brandCampaignType: null,
    notifyBoth: false,
    startsAt: "2026-04-06T11:30:00.000Z",
    endsAt: "2026-04-06T12:30:00.000Z",
    createdBy: "admin",
    createdAt: "2026-03-27T09:00:00.000Z",
    updatedAt: "2026-03-27T09:00:00.000Z",
    attendees: []
  }
];

const SYSTEM_OWNER = "system-tradeshow";
const SYSTEM_TIMESTAMP = "2026-01-01T00:00:00.000Z";

function toExclusiveEndDate(inclusiveEndDate: string) {
  const end = new Date(`${inclusiveEndDate}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return end.toISOString();
}

function makeTradeShowEvent(
  id: string,
  title: string,
  location: string,
  startsOn: string,
  endsOnInclusive: string,
  description?: string
): CalendarEvent {
  return {
    id,
    title,
    description: description ?? null,
    imageUrl: null,
    customColor: null,
    ownerEmail: null,
    location,
    meetingLink: null,
    internalNotes: null,
    status: "planned",
    eventType: "event",
    allDay: true,
    calendarScope: "main",
    personalOwner: null,
    brandCampaignType: null,
    notifyBoth: false,
    startsAt: `${startsOn}T00:00:00.000Z`,
    endsAt: toExclusiveEndDate(endsOnInclusive),
    createdBy: SYSTEM_OWNER,
    createdAt: SYSTEM_TIMESTAMP,
    updatedAt: SYSTEM_TIMESTAMP,
    attendees: []
  };
}

export const provisionalTradeShowEvents: CalendarEvent[] = [
  makeTradeShowEvent(
    "trade_2026_champs_austin",
    "CHAMPS Trade Show",
    "Austin, TX",
    "2026-01-19",
    "2026-01-21"
  ),
  makeTradeShowEvent(
    "trade_2026_champs_chicago",
    "CHAMPS Trade Show",
    "Chicago, IL",
    "2026-01-23",
    "2026-01-25"
  ),
  makeTradeShowEvent(
    "trade_2026_convenience_distribution_marketplace",
    "Convenience Distribution Marketplace",
    "Arlington, TX",
    "2026-02-16",
    "2026-02-18",
    "National Conference and Tradeshow"
  ),
  makeTradeShowEvent(
    "trade_2026_exvapo_napoli",
    "EXVAPO Napoli Vape Expo",
    "Naples, Italy",
    "2026-02-28",
    "2026-03-01"
  ),
  makeTradeShowEvent(
    "trade_2026_alt_pro_expo",
    "Alt Pro Expo",
    "Miami, FL",
    "2026-03-12",
    "2026-03-14",
    "Counterculture & Vape"
  ),
  makeTradeShowEvent(
    "trade_2026_asd_market_week",
    "ASD Market Week",
    "Las Vegas, NV",
    "2026-03-17",
    "2026-03-19",
    "International Wholesale Trade Show"
  ),
  makeTradeShowEvent(
    "trade_2026_vapexpo_paris",
    "Vapexpo Paris",
    "Paris, France",
    "2026-03-22",
    "2026-03-23"
  ),
  makeTradeShowEvent(
    "trade_2026_tpe",
    "Total Product Expo (TPE)",
    "Las Vegas, NV",
    "2026-03-31",
    "2026-04-02"
  ),
  makeTradeShowEvent(
    "trade_2026_evo_nxt",
    "EVO NXT",
    "Prague, Czech Republic",
    "2026-04-17",
    "2026-04-18"
  ),
  makeTradeShowEvent(
    "trade_2026_meet_the_buyer_global",
    "Meet the Buyer Global (World Vape Show)",
    "London, UK",
    "2026-04-23",
    "2026-04-23"
  ),
  makeTradeShowEvent(
    "trade_2026_champs_las_vegas",
    "CHAMPS Trade Show",
    "Las Vegas, NV",
    "2026-05-06",
    "2026-05-09"
  ),
  makeTradeShowEvent(
    "trade_2026_vaper_expo_uk",
    "Vaper Expo UK",
    "Birmingham, UK",
    "2026-05-08",
    "2026-05-10"
  ),
  makeTradeShowEvent(
    "trade_2026_shishamesse_frankfurt",
    "ShishaMesse Frankfurt",
    "Frankfurt, Germany",
    "2026-05-08",
    "2026-05-10"
  ),
  makeTradeShowEvent(
    "trade_2026_gfn_warsaw",
    "Global Forum on Nicotine (GFN)",
    "Warsaw, Poland",
    "2026-06-03",
    "2026-06-05"
  ),
  makeTradeShowEvent(
    "trade_2026_next_generation_nicotine_delivery_usa",
    "Next Generation Nicotine Delivery USA",
    "Miami, USA",
    "2026-06-03",
    "2026-06-04"
  ),
  makeTradeShowEvent(
    "trade_2026_world_vape_show_dubai",
    "World Vape Show Dubai",
    "Dubai, UAE",
    "2026-06-09",
    "2026-06-11"
  ),
  makeTradeShowEvent(
    "trade_2026_novel_nicotine_expo_dubai",
    "Novel Nicotine Expo Dubai",
    "Dubai, UAE",
    "2026-06-10",
    "2026-06-12"
  ),
  makeTradeShowEvent(
    "trade_2026_vapexpo_madrid",
    "Vapexpo Madrid",
    "Madrid, Spain",
    "2026-06-20",
    "2026-06-21"
  ),
  makeTradeShowEvent(
    "trade_2026_world_vape_show_south_america",
    "World Vape Show South America",
    "Santiago, Chile",
    "2026-09-04",
    "2026-09-05"
  ),
  makeTradeShowEvent(
    "trade_2026_intertabac",
    "InterTabac",
    "Dortmund, Germany",
    "2026-09-15",
    "2026-09-17"
  ),
  makeTradeShowEvent(
    "trade_2026_nacs",
    "National Association of Convenience Stores (NACS)",
    "Las Vegas, NV",
    "2026-10-06",
    "2026-10-09"
  ),
  makeTradeShowEvent(
    "trade_2026_champs_dallas",
    "CHAMPS Trade Show",
    "Dallas, TX",
    "2026-10-07",
    "2026-10-09"
  ),
  makeTradeShowEvent(
    "trade_2026_nle_connect_and_expo",
    "NLE Connect and Expo",
    "Athens Area, Greece",
    "2026-10-17",
    "2026-10-18"
  ),
  makeTradeShowEvent(
    "trade_2026_world_vape_show_south_africa",
    "World Vape Show South Africa",
    "Johannesburg Area, South Africa",
    "2026-11-01",
    "2026-11-01"
  ),
  makeTradeShowEvent(
    "trade_2026_champs_fort_lauderdale",
    "CHAMPS Trade Show",
    "Fort Lauderdale, FL",
    "2026-11-17",
    "2026-11-19"
  )
];
