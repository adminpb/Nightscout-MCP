// Tool: compare_periods
// Compare glucose statistics between two time periods

import { z } from "zod";
import { NightscoutClient } from "../client.js";
import { NightscoutConfig } from "../config.js";
import { getStrings } from "../i18n/index.js";

export const schema = z.object({
  periodA_from: z.string().describe("Period A start date (ISO 8601 or YYYY-MM-DD)"),
  periodA_to: z.string().describe("Period A end date (ISO 8601 or YYYY-MM-DD)"),
  periodB_from: z.string().describe("Period B start date (ISO 8601 or YYYY-MM-DD)"),
  periodB_to: z.string().describe("Period B end date (ISO 8601 or YYYY-MM-DD)"),
  labelA: z.string().optional().describe("Label for period A (e.g., 'Training days')"),
  labelB: z.string().optional().describe("Label for period B (e.g., 'Rest days')"),
});

export const definition = {
  name: "compare_periods",
  description:
    "Compare glucose statistics between two time periods side by side. Use for: training vs rest days, this week vs last week, before vs after medication changes, weekdays vs weekends. Returns TIR, average, SD, CV, HbA1c, and time-in-ranges for both periods with deltas.",
  inputSchema: {
    type: "object" as const,
    properties: {
      periodA_from: { type: "string", description: "Period A start date (ISO 8601 or YYYY-MM-DD)" },
      periodA_to: { type: "string", description: "Period A end date" },
      periodB_from: { type: "string", description: "Period B start date" },
      periodB_to: { type: "string", description: "Period B end date" },
      labelA: { type: "string", description: "Label for period A (e.g., 'Training days')" },
      labelB: { type: "string", description: "Label for period B (e.g., 'Rest days')" },
    },
    required: ["periodA_from", "periodA_to", "periodB_from", "periodB_to"],
  },
};

function calcPeriodStats(entries: Array<{ sgv: number; date: number }>, client: NightscoutClient) {
  if (entries.length === 0) return null;

  const sgv = entries.map((e) => e.sgv);
  const count = sgv.length;
  const sum = sgv.reduce((a, b) => a + b, 0);
  const avgMgdl = sum / count;
  const sdMgdl = Math.sqrt(sgv.map((v) => Math.pow(v - avgMgdl, 2)).reduce((a, b) => a + b, 0) / count);
  const cv = Math.round((sdMgdl / avgMgdl) * 100 * 10) / 10;
  const eA1c = Math.round(((avgMgdl + 46.7) / 28.7) * 10) / 10;
  const gmi = Math.round((3.31 + 0.02392 * avgMgdl) * 10) / 10;

  const veryLow = sgv.filter((v) => v < 54).length;
  const low = sgv.filter((v) => v >= 54 && v < 70).length;
  const inRange = sgv.filter((v) => v >= 70 && v <= 180).length;
  const high = sgv.filter((v) => v > 180 && v <= 250).length;
  const veryHigh = sgv.filter((v) => v > 250).length;
  const toP = (n: number) => Math.round((n / count) * 1000) / 10;

  return {
    readings: count,
    average: client.convertGlucose(Math.round(avgMgdl)),
    sd: client.convertGlucose(Math.round(sdMgdl)),
    cv,
    estimatedHbA1c: eA1c,
    gmi,
    min: client.convertGlucose(Math.min(...sgv)),
    max: client.convertGlucose(Math.max(...sgv)),
    tir: toP(inRange),
    timeBelowRange: toP(veryLow) + toP(low),
    timeAboveRange: toP(high) + toP(veryHigh),
    ranges: {
      veryLow: toP(veryLow),
      low: toP(low),
      inRange: toP(inRange),
      high: toP(high),
      veryHigh: toP(veryHigh),
    },
  };
}

export async function execute(
  client: NightscoutClient,
  config: NightscoutConfig,
  params: z.infer<typeof schema>
) {
  const s = getStrings(config.locale);

  const [entriesA, entriesB] = await Promise.all([
    client.getEntries(5000, params.periodA_from, params.periodA_to),
    client.getEntries(5000, params.periodB_from, params.periodB_to),
  ]);

  const statsA = calcPeriodStats(entriesA || [], client);
  const statsB = calcPeriodStats(entriesB || [], client);

  if (!statsA || !statsB) {
    return { error: s.noData };
  }

  const delta = (a: number, b: number) => {
    const d = Math.round((a - b) * 10) / 10;
    return d > 0 ? `+${d}` : `${d}`;
  };

  return {
    units: config.units,
    periodA: {
      label: params.labelA || "Period A",
      from: params.periodA_from,
      to: params.periodA_to,
      stats: statsA,
    },
    periodB: {
      label: params.labelB || "Period B",
      from: params.periodB_from,
      to: params.periodB_to,
      stats: statsB,
    },
    comparison: {
      average: delta(statsA.average, statsB.average),
      tir: delta(statsA.tir, statsB.tir),
      cv: delta(statsA.cv, statsB.cv),
      estimatedHbA1c: delta(statsA.estimatedHbA1c, statsB.estimatedHbA1c),
      timeBelowRange: delta(statsA.timeBelowRange, statsB.timeBelowRange),
      timeAboveRange: delta(statsA.timeAboveRange, statsB.timeAboveRange),
      betterTIR: statsA.tir > statsB.tir ? params.labelA || "Period A" : params.labelB || "Period B",
      betterCV: statsA.cv < statsB.cv ? params.labelA || "Period A" : params.labelB || "Period B",
    },
  };
}
