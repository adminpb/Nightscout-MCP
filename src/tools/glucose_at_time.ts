// Tool: glucose_at_time
// Get glucose value at or near a specific point in time

import { z } from "zod";
import { NightscoutClient } from "../client.js";
import { NightscoutConfig } from "../config.js";
import { getStrings } from "../i18n/index.js";

export const schema = z.object({
  time: z.string().describe("Target time (ISO 8601 or 'YYYY-MM-DD HH:mm'). E.g., '2026-02-23T03:00:00' or '2026-02-23 15:30'"),
  window: z.number().optional().describe("Search window in minutes around target time (default 15, max 60)"),
});

export const definition = {
  name: "glucose_at_time",
  description:
    "Get the glucose reading closest to a specific point in time. Returns the nearest reading within a configurable window, plus surrounding context (readings before and after). Use for: 'what was my glucose at 3 AM?', 'glucose when I woke up yesterday'.",
  inputSchema: {
    type: "object" as const,
    properties: {
      time: { type: "string", description: "Target time (ISO 8601 or 'YYYY-MM-DD HH:mm')" },
      window: { type: "number", description: "Search window in minutes (default 15)" },
    },
    required: ["time"],
  },
};

export async function execute(
  client: NightscoutClient,
  config: NightscoutConfig,
  params: z.infer<typeof schema>
) {
  const s = getStrings(config.locale);
  const targetTime = new Date(params.time).getTime();
  const windowMs = (params.window || 15) * 60 * 1000;

  if (isNaN(targetTime)) {
    return { error: "Invalid time format. Use ISO 8601 or 'YYYY-MM-DD HH:mm'." };
  }

  const dateFrom = new Date(targetTime - windowMs).toISOString();
  const dateTo = new Date(targetTime + windowMs).toISOString();

  const entries = await client.getEntries(50, dateFrom, dateTo);

  if (!entries || entries.length === 0) {
    return {
      error: s.noData,
      targetTime: new Date(targetTime).toISOString(),
      searchWindow: `±${params.window || 15} min`,
    };
  }

  // Find closest entry to target time
  const sorted = entries.sort(
    (a, b) => Math.abs(a.date - targetTime) - Math.abs(b.date - targetTime)
  );
  const closest = sorted[0];
  const offsetMin = Math.round((closest.date - targetTime) / 60000);

  // Get context: 3 readings before and after
  const allSorted = entries.sort((a, b) => b.date - a.date);
  const closestIdx = allSorted.findIndex((e) => e._id === closest._id);
  const contextBefore = allSorted.slice(closestIdx + 1, closestIdx + 4).reverse();
  const contextAfter = allSorted.slice(Math.max(0, closestIdx - 3), closestIdx);

  return {
    targetTime: new Date(targetTime).toISOString(),
    closest: {
      glucose: client.convertGlucose(closest.sgv),
      units: config.units,
      trend: client.getArrow(closest.direction),
      timestamp: closest.dateString,
      offset: offsetMin === 0 ? "exact" : `${offsetMin > 0 ? "+" : ""}${offsetMin} min`,
    },
    context: {
      before: contextBefore.map((e) => ({
        glucose: client.convertGlucose(e.sgv),
        trend: client.getArrow(e.direction),
        timestamp: e.dateString,
      })),
      after: contextAfter.map((e) => ({
        glucose: client.convertGlucose(e.sgv),
        trend: client.getArrow(e.direction),
        timestamp: e.dateString,
      })),
    },
  };
}
