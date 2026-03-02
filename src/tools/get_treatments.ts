// Tool: get_treatments
// Returns insulin, carbs, notes, and other treatment entries

import { z } from "zod";
import { NightscoutClient } from "../client.js";
import { NightscoutConfig } from "../config.js";
import { getStrings } from "../i18n/index.js";

export const schema = z.object({
  hours: z.number().min(1).max(168).optional().describe("Hours to look back (default 24)"),
  dateFrom: z.string().optional().describe("Start date (ISO 8601)"),
  dateTo: z.string().optional().describe("End date (ISO 8601)"),
  eventType: z.string().optional().describe("Filter by event type: Meal Bolus, Correction Bolus, Carb Correction, Note, Exercise, etc."),
  count: z.number().min(1).max(500).optional().describe("Max entries (default 50)"),
});

export const definition = {
  name: "get_treatments",
  description:
    "Get treatment records: insulin boluses, carb entries, notes, exercise logs, temp basals, and more. Use to understand insulin and carb history for analysis.",
  inputSchema: {
    type: "object" as const,
    properties: {
      hours: { type: "number", description: "Hours to look back (default 24)" },
      dateFrom: { type: "string", description: "Start date (ISO 8601)" },
      dateTo: { type: "string", description: "End date (ISO 8601)" },
      eventType: { type: "string", description: "Filter by event type (e.g., 'Meal Bolus', 'Correction Bolus', 'Note', 'Exercise')" },
      count: { type: "number", description: "Max entries (default 50)" },
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
  const count = params.count || 50;

  const treatments = await client.getTreatments(
    count,
    dateFrom,
    dateTo,
    params.eventType
  );

  if (!treatments || treatments.length === 0) {
    return {
      treatments: [],
      count: 0,
      period: { from: dateFrom, to: dateTo },
      message: s.noTreatments,
    };
  }

  const formatted = treatments.map((tr) => ({
    type: tr.eventType,
    time: tr.created_at,
    insulin: tr.insulin || null,
    carbs: tr.carbs || null,
    glucose: tr.glucose ? client.convertGlucose(tr.glucose) : null,
    notes: tr.notes || null,
    duration: tr.duration || null,
    enteredBy: tr.enteredBy || null,
  }));

  const totalInsulin = treatments
    .filter((tr) => tr.insulin)
    .reduce((sum, tr) => sum + (tr.insulin || 0), 0);
  const totalCarbs = treatments
    .filter((tr) => tr.carbs)
    .reduce((sum, tr) => sum + (tr.carbs || 0), 0);
  const bolusCount = treatments.filter(
    (tr) => tr.eventType?.includes("Bolus") || (tr.insulin && tr.insulin > 0)
  ).length;

  return {
    treatments: formatted,
    count: treatments.length,
    period: { from: dateFrom, to: dateTo },
    summary: {
      totalInsulin: `${Math.round(totalInsulin * 10) / 10} U`,
      totalCarbs: `${totalCarbs} g`,
      bolusCount,
      eventTypes: [...new Set(treatments.map((tr) => tr.eventType))],
    },
  };
}
