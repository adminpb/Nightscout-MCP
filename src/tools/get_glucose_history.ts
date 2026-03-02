// Tool: get_glucose_history
// Returns SGV entries for a given time period

import { z } from "zod";
import { NightscoutClient } from "../client.js";
import { NightscoutConfig } from "../config.js";
import { getStrings } from "../i18n/index.js";

export const schema = z.object({
  hours: z
    .number()
    .min(1)
    .max(168)
    .optional()
    .describe("Number of hours to look back (1-168, default 24)"),
  dateFrom: z
    .string()
    .optional()
    .describe("Start date (ISO 8601). Overrides hours if set."),
  dateTo: z
    .string()
    .optional()
    .describe("End date (ISO 8601). Defaults to now."),
  count: z
    .number()
    .min(1)
    .max(5000)
    .optional()
    .describe("Max number of entries to return (default: auto based on period)"),
});

export const definition = {
  name: "get_glucose_history",
  description:
    "Get glucose reading history for a specified time period. Returns SGV values with timestamps and trend directions. Use 'hours' for simple lookback or 'dateFrom'/'dateTo' for precise ranges.",
  inputSchema: {
    type: "object" as const,
    properties: {
      hours: {
        type: "number",
        description: "Number of hours to look back (1-168, default 24)",
      },
      dateFrom: {
        type: "string",
        description: "Start date (ISO 8601). Overrides hours if set.",
      },
      dateTo: {
        type: "string",
        description: "End date (ISO 8601). Defaults to now.",
      },
      count: {
        type: "number",
        description: "Max number of entries to return",
      },
    },
  },
};

export async function execute(
  client: NightscoutClient,
  config: NightscoutConfig,
  params: z.infer<typeof schema>
) {
  const s = getStrings(config.locale);
  const hours = params.hours || 24;
  const dateTo = params.dateTo || new Date().toISOString();
  const dateFrom =
    params.dateFrom ||
    new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const count = params.count || Math.ceil((hours * 60) / 5);

  const entries = await client.getEntries(count, dateFrom, dateTo);

  if (!entries || entries.length === 0) {
    return {
      entries: [],
      count: 0,
      period: { from: dateFrom, to: dateTo },
      message: s.noData,
    };
  }

  const formatted = entries.map((e) => ({
    glucose: client.convertGlucose(e.sgv),
    trend: client.getArrow(e.direction),
    timestamp: e.dateString,
    date: new Date(e.date).toLocaleString(),
  }));

  const values = entries.map((e) => client.convertGlucose(e.sgv));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg =
    Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;

  return {
    entries: formatted,
    count: entries.length,
    period: { from: dateFrom, to: dateTo },
    units: config.units,
    quickStats: { min, max, avg },
  };
}
