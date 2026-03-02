// Tool: find_events
// Search treatments and notes by text, type, or date

import { z } from "zod";
import { NightscoutClient } from "../client.js";
import { NightscoutConfig } from "../config.js";
import { getStrings } from "../i18n/index.js";

export const schema = z.object({
  query: z.string().optional().describe("Text to search in notes (case-insensitive)"),
  eventType: z.string().optional().describe("Filter by event type: 'Note', 'Meal Bolus', 'Site Change', 'Sensor Start', 'Exercise', etc."),
  hours: z.number().min(1).max(720).optional().describe("Hours to look back (default 168 = 7 days)"),
  dateFrom: z.string().optional().describe("Start date (ISO 8601)"),
  dateTo: z.string().optional().describe("End date (ISO 8601)"),
});

export const definition = {
  name: "find_events",
  description:
    "Search treatment entries by text in notes or by event type. Use to answer: 'when did I last change my sensor?', 'show all coffee entries', 'find exercise logs this week'. Searches up to 30 days of history.",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: { type: "string", description: "Text to search in notes (case-insensitive)" },
      eventType: { type: "string", description: "Filter by event type" },
      hours: { type: "number", description: "Hours to look back (default 168)" },
      dateFrom: { type: "string", description: "Start date (ISO 8601)" },
      dateTo: { type: "string", description: "End date (ISO 8601)" },
    },
  },
};

export async function execute(
  client: NightscoutClient,
  config: NightscoutConfig,
  params: z.infer<typeof schema>
) {
  const s = getStrings(config.locale);
  const hours = params.hours || 168;
  const dateTo = params.dateTo || new Date().toISOString();
  const dateFrom = params.dateFrom || new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const treatments = await client.getTreatments(500, dateFrom, dateTo, params.eventType);

  if (!treatments || treatments.length === 0) {
    return { results: [], count: 0, message: s.noTreatments };
  }

  let filtered = treatments;

  if (params.query) {
    const q = params.query.toLowerCase();
    filtered = treatments.filter((t) =>
      (t.notes && t.notes.toLowerCase().includes(q)) ||
      (t.eventType && t.eventType.toLowerCase().includes(q))
    );
  }

  return {
    results: filtered.map((t) => ({
      type: t.eventType,
      time: t.created_at,
      insulin: t.insulin || null,
      carbs: t.carbs || null,
      notes: t.notes || null,
      duration: t.duration || null,
    })),
    count: filtered.length,
    searchQuery: params.query || null,
    eventTypeFilter: params.eventType || null,
    period: { from: dateFrom, to: dateTo },
  };
}
