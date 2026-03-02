// Tool: get_statistics
// Calculates TIR, average glucose, estimated HbA1c, SD, CV for a period

import { z } from "zod";
import { NightscoutClient } from "../client.js";
import { NightscoutConfig } from "../config.js";
import { getStrings } from "../i18n/index.js";

export const schema = z.object({
  hours: z
    .number()
    .min(1)
    .max(720)
    .optional()
    .describe("Hours to analyze (default 24, max 720 = 30 days)"),
  dateFrom: z.string().optional().describe("Start date (ISO 8601)"),
  dateTo: z.string().optional().describe("End date (ISO 8601)"),
  targetLow: z
    .number()
    .optional()
    .describe("Low target in mg/dL (default 70)"),
  targetHigh: z
    .number()
    .optional()
    .describe("High target in mg/dL (default 180)"),
});

export const definition = {
  name: "get_statistics",
  description:
    "Calculate glucose statistics: Time in Range (TIR), average glucose, estimated HbA1c, standard deviation (SD), coefficient of variation (CV), and time in various ranges. Essential for understanding overall glucose control quality.",
  inputSchema: {
    type: "object" as const,
    properties: {
      hours: {
        type: "number",
        description: "Hours to analyze (default 24, max 720 = 30 days)",
      },
      dateFrom: { type: "string", description: "Start date (ISO 8601)" },
      dateTo: { type: "string", description: "End date (ISO 8601)" },
      targetLow: {
        type: "number",
        description: "Low target in mg/dL (default 70)",
      },
      targetHigh: {
        type: "number",
        description: "High target in mg/dL (default 180)",
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

  const targetLow = params.targetLow || 70;
  const targetHigh = params.targetHigh || 180;

  const maxCount = Math.ceil((hours * 60) / 5);
  const entries = await client.getEntries(
    Math.min(maxCount, 5000),
    dateFrom,
    dateTo
  );

  if (!entries || entries.length === 0) {
    return {
      error: s.noData,
      period: { from: dateFrom, to: dateTo },
    };
  }

  const sgvValues = entries.map((e) => e.sgv);
  const count = sgvValues.length;
  const sum = sgvValues.reduce((a, b) => a + b, 0);
  const avgMgdl = sum / count;
  const avg = client.convertGlucose(Math.round(avgMgdl));

  const squaredDiffs = sgvValues.map((v) => Math.pow(v - avgMgdl, 2));
  const sdMgdl = Math.sqrt(
    squaredDiffs.reduce((a, b) => a + b, 0) / count
  );
  const sd = client.convertGlucose(Math.round(sdMgdl));

  const cv = Math.round((sdMgdl / avgMgdl) * 100 * 10) / 10;
  const eA1c = Math.round(((avgMgdl + 46.7) / 28.7) * 10) / 10;
  const gmi = Math.round((3.31 + 0.02392 * avgMgdl) * 10) / 10;

  const veryLow = sgvValues.filter((v) => v < 54).length;
  const low = sgvValues.filter((v) => v >= 54 && v < targetLow).length;
  const inRange = sgvValues.filter(
    (v) => v >= targetLow && v <= targetHigh
  ).length;
  const high = sgvValues.filter(
    (v) => v > targetHigh && v <= 250
  ).length;
  const veryHigh = sgvValues.filter((v) => v > 250).length;

  const toPercent = (n: number) => Math.round((n / count) * 1000) / 10;

  const minMgdl = Math.min(...sgvValues);
  const maxMgdl = Math.max(...sgvValues);

  const firstDate = new Date(entries[entries.length - 1].date);
  const lastDate = new Date(entries[0].date);
  const actualHours =
    Math.round(
      ((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60)) * 10
    ) / 10;

  return {
    period: {
      from: firstDate.toISOString(),
      to: lastDate.toISOString(),
      hours: actualHours,
      readings: count,
    },
    average: avg,
    units: config.units,
    sd,
    cv: `${cv}%`,
    cvStatus: cv < 36 ? `✅ ${s.stable}` : `⚠️ ${s.unstable}`,
    estimatedHbA1c: `${eA1c}%`,
    gmi: `${gmi}%`,
    min: client.convertGlucose(minMgdl),
    max: client.convertGlucose(maxMgdl),
    timeInRanges: {
      veryLow: {
        count: veryLow,
        percent: `${toPercent(veryLow)}%`,
        label: "< 54 mg/dL (< 3.0 mmol/L)",
      },
      low: {
        count: low,
        percent: `${toPercent(low)}%`,
        label: `54-${targetLow} mg/dL`,
      },
      inRange: {
        count: inRange,
        percent: `${toPercent(inRange)}%`,
        label: `${targetLow}-${targetHigh} mg/dL ✅`,
      },
      high: {
        count: high,
        percent: `${toPercent(high)}%`,
        label: `${targetHigh}-250 mg/dL`,
      },
      veryHigh: {
        count: veryHigh,
        percent: `${toPercent(veryHigh)}%`,
        label: "> 250 mg/dL",
      },
    },
    targets: {
      tirGoal: s.tirGoal,
      tirMet: toPercent(inRange) >= 70 ? `✅ ${s.yes}` : `❌ ${s.no}`,
      belowRangeGoal: s.belowRangeGoal,
      belowRangeMet:
        toPercent(veryLow) + toPercent(low) < 4
          ? `✅ ${s.yes}`
          : `❌ ${s.no}`,
    },
  };
}
