// Tool: weekly_comparison
// One-call comparison of this week vs last week

import { z } from "zod";
import { NightscoutClient } from "../client.js";
import { NightscoutConfig } from "../config.js";
import { getStrings } from "../i18n/index.js";

export const schema = z.object({});

export const definition = {
  name: "weekly_comparison",
  description:
    "One-call comparison of this week vs last week. Automatically calculates both periods and returns side-by-side stats: TIR, average, CV, HbA1c, time-in-ranges with improvement indicators. No parameters needed.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
};

function calcStats(entries: Array<{ sgv: number }>, client: NightscoutClient) {
  if (!entries.length) return null;
  const sgv = entries.map((e) => e.sgv);
  const count = sgv.length;
  const avg = sgv.reduce((a, b) => a + b, 0) / count;
  const sd = Math.sqrt(sgv.map((v) => (v - avg) ** 2).reduce((a, b) => a + b, 0) / count);
  const cv = Math.round((sd / avg) * 1000) / 10;
  const eA1c = Math.round(((avg + 46.7) / 28.7) * 100) / 100;
  const inRange = sgv.filter((v) => v >= 70 && v <= 180).length;
  const low = sgv.filter((v) => v < 70).length;
  const veryLow = sgv.filter((v) => v < 54).length;
  const high = sgv.filter((v) => v > 180).length;
  const toP = (n: number) => Math.round((n / count) * 1000) / 10;

  return {
    readings: count,
    average: client.convertGlucose(Math.round(avg)),
    sd: client.convertGlucose(Math.round(sd)),
    cv, eA1c,
    tir: toP(inRange),
    low: toP(low + veryLow),
    high: toP(high),
    min: client.convertGlucose(Math.min(...sgv)),
    max: client.convertGlucose(Math.max(...sgv)),
  };
}

export async function execute(
  client: NightscoutClient,
  config: NightscoutConfig,
  _params: z.infer<typeof schema>
) {
  const s = getStrings(config.locale);
  const isUk = config.locale === "uk";
  const now = Date.now();

  const thisWeekFrom = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const lastWeekFrom = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
  const lastWeekTo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [thisEntries, lastEntries] = await Promise.all([
    client.getEntries(5000, thisWeekFrom),
    client.getEntries(5000, lastWeekFrom, lastWeekTo),
  ]);

  const thisStats = calcStats(thisEntries || [], client);
  const lastStats = calcStats(lastEntries || [], client);

  if (!thisStats || !lastStats) return { error: s.noData };

  const d = (a: number, b: number) => {
    const v = Math.round((a - b) * 10) / 10;
    return v > 0 ? `+${v}` : `${v}`;
  };
  const better = (a: number, b: number, lowerIsBetter = false) =>
    lowerIsBetter ? (a < b ? "✅" : a > b ? "❌" : "➡️") : (a > b ? "✅" : a < b ? "❌" : "➡️");

  return {
    units: config.units,
    thisWeek: { label: isUk ? "Цей тиждень" : "This week", ...thisStats },
    lastWeek: { label: isUk ? "Минулий тиждень" : "Last week", ...lastStats },
    changes: {
      tir: `${d(thisStats.tir, lastStats.tir)}% ${better(thisStats.tir, lastStats.tir)}`,
      average: `${d(thisStats.average, lastStats.average)} ${better(thisStats.average, lastStats.average, true)}`,
      cv: `${d(thisStats.cv, lastStats.cv)}% ${better(thisStats.cv, lastStats.cv, true)}`,
      eA1c: `${d(thisStats.eA1c, lastStats.eA1c)}% ${better(thisStats.eA1c, lastStats.eA1c, true)}`,
      low: `${d(thisStats.low, lastStats.low)}% ${better(thisStats.low, lastStats.low, true)}`,
      high: `${d(thisStats.high, lastStats.high)}% ${better(thisStats.high, lastStats.high, true)}`,
    },
    overallTrend: thisStats.tir > lastStats.tir && thisStats.cv <= lastStats.cv
      ? (isUk ? "📈 Покращення" : "📈 Improving")
      : thisStats.tir < lastStats.tir
      ? (isUk ? "📉 Погіршення" : "📉 Declining")
      : (isUk ? "➡️ Стабільно" : "➡️ Stable"),
  };
}
