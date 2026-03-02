// Tool: get_daily_report
// Generates a comprehensive daily summary

import { z } from "zod";
import { NightscoutClient } from "../client.js";
import { NightscoutConfig } from "../config.js";
import { getStrings, t } from "../i18n/index.js";

export const schema = z.object({
  date: z
    .string()
    .optional()
    .describe("Date to report on (YYYY-MM-DD). Defaults to today."),
});

export const definition = {
  name: "get_daily_report",
  description:
    "Generate a comprehensive daily report: glucose stats (min/max/avg/TIR), all treatments (insulin, carbs, notes), time in ranges, and notable events. Perfect for daily review.",
  inputSchema: {
    type: "object" as const,
    properties: {
      date: {
        type: "string",
        description: "Date to report on (YYYY-MM-DD). Defaults to today.",
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

  const targetDate = params.date ? new Date(params.date) : new Date();
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  const dateFrom = dayStart.toISOString();
  const dateTo = dayEnd.toISOString();

  const [entries, treatments] = await Promise.all([
    client.getEntries(288, dateFrom, dateTo),
    client.getTreatments(100, dateFrom, dateTo),
  ]);

  const dateStr = dayStart.toISOString().split("T")[0];

  // Glucose analysis
  let glucoseStats: Record<string, unknown> = { message: s.noData };
  let timeInRanges: Record<string, unknown> = {};
  let notableEvents: string[] = [];

  if (entries && entries.length > 0) {
    const sgvValues = entries.map((e) => e.sgv);
    const count = sgvValues.length;
    const avgMgdl = sgvValues.reduce((a, b) => a + b, 0) / count;
    const sdMgdl = Math.sqrt(
      sgvValues
        .map((v) => Math.pow(v - avgMgdl, 2))
        .reduce((a, b) => a + b, 0) / count
    );

    const inRange = sgvValues.filter((v) => v >= 70 && v <= 180).length;
    const low = sgvValues.filter((v) => v < 70).length;
    const veryLow = sgvValues.filter((v) => v < 54).length;
    const high = sgvValues.filter((v) => v > 180).length;
    const veryHigh = sgvValues.filter((v) => v > 250).length;

    const toPercent = (n: number) => Math.round((n / count) * 1000) / 10;

    glucoseStats = {
      readings: count,
      average: client.convertGlucose(Math.round(avgMgdl)),
      sd: client.convertGlucose(Math.round(sdMgdl)),
      min: client.convertGlucose(Math.min(...sgvValues)),
      max: client.convertGlucose(Math.max(...sgvValues)),
      units: config.units,
    };

    timeInRanges = {
      inRange: `${toPercent(inRange)}%`,
      low: `${toPercent(low)}%`,
      veryLow: `${toPercent(veryLow)}%`,
      high: `${toPercent(high)}%`,
      veryHigh: `${toPercent(veryHigh)}%`,
    };

    if (veryLow > 0) {
      const lowestEntry = entries.reduce((a, b) => (a.sgv < b.sgv ? a : b));
      notableEvents.push(
        t(s.veryLowAt, {
          value: client.convertGlucose(lowestEntry.sgv),
          units: config.units,
          time: new Date(lowestEntry.date).toLocaleTimeString(),
        })
      );
    }
    if (veryHigh > 0) {
      const highestEntry = entries.reduce((a, b) => (a.sgv > b.sgv ? a : b));
      notableEvents.push(
        t(s.veryHighAt, {
          value: client.convertGlucose(highestEntry.sgv),
          units: config.units,
          time: new Date(highestEntry.date).toLocaleTimeString(),
        })
      );
    }
  }

  // Treatment summary
  let treatmentSummary: Record<string, unknown> = {
    message: s.noTreatments,
  };
  if (treatments && treatments.length > 0) {
    const totalInsulin = treatments
      .filter((tr) => tr.insulin)
      .reduce((sum, tr) => sum + (tr.insulin || 0), 0);
    const totalCarbs = treatments
      .filter((tr) => tr.carbs)
      .reduce((sum, tr) => sum + (tr.carbs || 0), 0);

    treatmentSummary = {
      count: treatments.length,
      totalInsulin: `${Math.round(totalInsulin * 10) / 10} U`,
      totalCarbs: `${totalCarbs} g`,
      events: treatments.map((tr) => ({
        type: tr.eventType,
        time: new Date(tr.created_at).toLocaleTimeString(),
        insulin: tr.insulin || undefined,
        carbs: tr.carbs || undefined,
        notes: tr.notes || undefined,
      })),
    };
  }

  return {
    date: dateStr,
    glucose: glucoseStats,
    timeInRanges,
    treatments: treatmentSummary,
    notableEvents:
      notableEvents.length > 0 ? notableEvents : [s.noNotableEvents],
  };
}
