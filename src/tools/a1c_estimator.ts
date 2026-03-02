// Tool: a1c_estimator
// Estimate HbA1c at a future date based on current glucose trends

import { z } from "zod";
import { NightscoutClient } from "../client.js";
import { NightscoutConfig } from "../config.js";
import { getStrings } from "../i18n/index.js";

export const schema = z.object({
  target_date: z.string().optional().describe("Date of next lab test (YYYY-MM-DD). If omitted, estimates for 30 days from now."),
  last_a1c: z.number().optional().describe("Last measured HbA1c (%). Used for weighted projection."),
  last_a1c_date: z.string().optional().describe("Date of last HbA1c test (YYYY-MM-DD)."),
});

export const definition = {
  name: "a1c_estimator",
  description:
    "Estimate future HbA1c based on current CGM data and optional last lab result. Uses GMI from recent data weighted with historical HbA1c decay. Useful before lab visits to set expectations.",
  inputSchema: {
    type: "object" as const,
    properties: {
      target_date: { type: "string", description: "Date of next lab test (YYYY-MM-DD)" },
      last_a1c: { type: "number", description: "Last measured HbA1c (%)" },
      last_a1c_date: { type: "string", description: "Date of last HbA1c test (YYYY-MM-DD)" },
    },
  },
};

export async function execute(
  client: NightscoutClient,
  config: NightscoutConfig,
  params: z.infer<typeof schema>
) {
  const s = getStrings(config.locale);
  const isUk = config.locale === "uk";

  const targetDate = params.target_date
    ? new Date(params.target_date)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Get recent data in chunks for better accuracy
  const periods = [
    { label: isUk ? "Останні 7 днів" : "Last 7 days", hours: 168 },
    { label: isUk ? "Останні 14 днів" : "Last 14 days", hours: 336 },
    { label: isUk ? "Останні 30 днів" : "Last 30 days", hours: 720 },
  ];

  const results = await Promise.all(
    periods.map(async (p) => {
      const from = new Date(Date.now() - p.hours * 60 * 60 * 1000).toISOString();
      const entries = await client.getEntries(Math.min(Math.ceil((p.hours * 60) / 5), 5000), from);
      if (!entries || entries.length === 0) return null;

      const avg = entries.reduce((s, e) => s + e.sgv, 0) / entries.length;
      const gmi = Math.round((3.31 + 0.02392 * avg) * 100) / 100;
      const eA1c = Math.round(((avg + 46.7) / 28.7) * 100) / 100;

      return {
        label: p.label,
        readings: entries.length,
        avgMgdl: Math.round(avg),
        avg: client.convertGlucose(Math.round(avg)),
        gmi,
        eA1c,
      };
    })
  );

  const validResults = results.filter(Boolean) as NonNullable<(typeof results)[0]>[];
  if (validResults.length === 0) {
    return { error: s.noData };
  }

  // Use most recent period's GMI as primary estimate
  const currentGmi = validResults[0]!.gmi;

  // If we have last A1c, do weighted projection
  // HbA1c reflects ~3 months, with recent weeks weighted more heavily
  let projectedA1c = currentGmi;
  let projectionMethod = "GMI from CGM data";

  if (params.last_a1c && params.last_a1c_date) {
    const lastDate = new Date(params.last_a1c_date);
    const daysSinceLab = Math.round((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysToTarget = Math.round((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    // Weight: old A1c decays, new CGM data grows
    // At 90 days since lab, CGM is ~100% weight
    const cgmWeight = Math.min(1, (daysSinceLab + daysToTarget) / 90);
    const labWeight = 1 - cgmWeight;

    projectedA1c = Math.round((params.last_a1c * labWeight + currentGmi * cgmWeight) * 100) / 100;
    projectionMethod = isUk
      ? `Зважена проекція: ${Math.round(labWeight * 100)}% лабораторний + ${Math.round(cgmWeight * 100)}% CGM`
      : `Weighted projection: ${Math.round(labWeight * 100)}% lab + ${Math.round(cgmWeight * 100)}% CGM`;
  }

  return {
    targetDate: targetDate.toISOString().split("T")[0],
    projectedHbA1c: `${projectedA1c}%`,
    projectionMethod,
    currentGMI: `${currentGmi}%`,
    lastLab: params.last_a1c
      ? { value: `${params.last_a1c}%`, date: params.last_a1c_date }
      : null,
    periodBreakdown: validResults.map((r) => ({
      period: r.label,
      readings: r.readings,
      average: `${r.avg} ${config.units}`,
      gmi: `${r.gmi}%`,
      eA1c: `${r.eA1c}%`,
    })),
    disclaimer: isUk
      ? "⚠️ Це оцінка на основі CGM даних, не заміна лабораторного аналізу"
      : "⚠️ This is an estimate based on CGM data, not a substitute for laboratory testing",
  };
}
