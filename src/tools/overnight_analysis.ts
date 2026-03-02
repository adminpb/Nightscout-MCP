// Tool: overnight_analysis
// Detailed analysis of overnight glucose patterns

import { z } from "zod";
import { NightscoutClient } from "../client.js";
import { NightscoutConfig } from "../config.js";
import { getStrings } from "../i18n/index.js";

export const schema = z.object({
  date: z.string().optional().describe("Night to analyze (YYYY-MM-DD, refers to the evening start). Defaults to last night."),
  night_start: z.number().optional().describe("Night start hour (default 22)"),
  night_end: z.number().optional().describe("Night end hour (default 7)"),
});

export const definition = {
  name: "overnight_analysis",
  description:
    "Detailed overnight glucose analysis: stability, trend direction, min/max with timestamps, dawn phenomenon detection, time in range, and basal adequacy assessment. Analyzes from evening to morning.",
  inputSchema: {
    type: "object" as const,
    properties: {
      date: { type: "string", description: "Night date (YYYY-MM-DD). Defaults to last night." },
      night_start: { type: "number", description: "Night start hour (default 22)" },
      night_end: { type: "number", description: "Night end hour (default 7)" },
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
  const nightStart = params.night_start ?? 22;
  const nightEnd = params.night_end ?? 7;

  // Determine night boundaries
  let eveningDate: Date;
  if (params.date) {
    eveningDate = new Date(params.date);
  } else {
    eveningDate = new Date();
    // If it's before nightEnd, we mean last night (yesterday evening)
    if (new Date().getHours() < nightEnd + 2) {
      eveningDate.setDate(eveningDate.getDate() - 1);
    }
  }

  const dateFrom = new Date(eveningDate);
  dateFrom.setHours(nightStart, 0, 0, 0);
  const dateTo = new Date(eveningDate);
  dateTo.setDate(dateTo.getDate() + 1);
  dateTo.setHours(nightEnd, 0, 0, 0);

  const entries = await client.getEntries(200, dateFrom.toISOString(), dateTo.toISOString());

  if (!entries || entries.length < 10) {
    return {
      error: s.noData,
      night: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
    };
  }

  const sorted = entries.sort((a, b) => a.date - b.date);
  const sgv = sorted.map((e) => e.sgv);
  const count = sgv.length;

  // Basic stats
  const avg = Math.round(sgv.reduce((a, b) => a + b, 0) / count);
  const sd = Math.round(Math.sqrt(sgv.map((v) => Math.pow(v - avg, 2)).reduce((a, b) => a + b, 0) / count));

  const minEntry = sorted.reduce((a, b) => (a.sgv < b.sgv ? a : b));
  const maxEntry = sorted.reduce((a, b) => (a.sgv > b.sgv ? a : b));

  // TIR
  const inRange = sgv.filter((v) => v >= 70 && v <= 180).length;
  const low = sgv.filter((v) => v < 70).length;
  const veryLow = sgv.filter((v) => v < 54).length;
  const toP = (n: number) => Math.round((n / count) * 1000) / 10;

  // Trend: compare first 30 min vs last 30 min
  const first30 = sorted.filter((e) => e.date - sorted[0].date < 30 * 60 * 1000);
  const last30 = sorted.filter((e) => sorted[sorted.length - 1].date - e.date < 30 * 60 * 1000);
  const firstAvg = first30.reduce((s, e) => s + e.sgv, 0) / first30.length;
  const lastAvg = last30.reduce((s, e) => s + e.sgv, 0) / last30.length;
  const overnightDrift = lastAvg - firstAvg;

  // Dawn phenomenon: check 04:00-07:00 rise
  const dawnStart = new Date(eveningDate);
  dawnStart.setDate(dawnStart.getDate() + 1);
  dawnStart.setHours(4, 0, 0, 0);
  const dawnEntries = sorted.filter((e) => e.date >= dawnStart.getTime());
  let dawnRise = 0;
  if (dawnEntries.length >= 4) {
    const dawnFirst3 = dawnEntries.slice(0, 3).reduce((s, e) => s + e.sgv, 0) / 3;
    const dawnLast3 = dawnEntries.slice(-3).reduce((s, e) => s + e.sgv, 0) / 3;
    dawnRise = dawnLast3 - dawnFirst3;
  }

  // Stability score (lower SD = better)
  let stability: string;
  if (sd < 15) stability = isUk ? "✅ Дуже стабільна" : "✅ Very stable";
  else if (sd < 25) stability = isUk ? "✅ Стабільна" : "✅ Stable";
  else if (sd < 35) stability = isUk ? "⚠️ Помірна варіабельність" : "⚠️ Moderate variability";
  else stability = isUk ? "❌ Нестабільна" : "❌ Unstable";

  // Basal assessment
  let basalAssessment: string;
  if (Math.abs(overnightDrift) < 20 && low === 0) {
    basalAssessment = isUk ? "✅ Базал виглядає адекватним" : "✅ Basal appears adequate";
  } else if (overnightDrift < -20) {
    basalAssessment = isUk ? "⚠️ Глюкоза падає — можливо базал зависокий" : "⚠️ Glucose dropping — basal may be too high";
  } else if (overnightDrift > 30) {
    basalAssessment = isUk ? "⚠️ Глюкоза росте — можливо базал занизький" : "⚠️ Glucose rising — basal may be too low";
  } else if (low > 0) {
    basalAssessment = isUk ? "❌ Нічні гіпо — знизити базал" : "❌ Overnight lows — consider reducing basal";
  } else {
    basalAssessment = isUk ? "🔍 Потребує додаткового аналізу" : "🔍 Needs further analysis";
  }

  return {
    night: {
      from: dateFrom.toISOString(),
      to: dateTo.toISOString(),
      readings: count,
    },
    units: config.units,
    average: client.convertGlucose(avg),
    sd: client.convertGlucose(sd),
    stability,
    min: {
      glucose: client.convertGlucose(minEntry.sgv),
      time: new Date(minEntry.date).toLocaleTimeString(),
    },
    max: {
      glucose: client.convertGlucose(maxEntry.sgv),
      time: new Date(maxEntry.date).toLocaleTimeString(),
    },
    timeInRange: {
      inRange: `${toP(inRange)}%`,
      low: `${toP(low)}%`,
      veryLow: `${toP(veryLow)}%`,
    },
    overnightDrift: {
      value: client.convertGlucose(Math.round(overnightDrift)),
      direction: overnightDrift > 10 ? "↑ rising" : overnightDrift < -10 ? "↓ falling" : "→ flat",
      startAvg: client.convertGlucose(Math.round(firstAvg)),
      endAvg: client.convertGlucose(Math.round(lastAvg)),
    },
    dawnPhenomenon: {
      detected: dawnRise > 30,
      rise: client.convertGlucose(Math.round(dawnRise)),
      assessment: dawnRise > 30
        ? (isUk ? "⚠️ Виявлено феномен світанку" : "⚠️ Dawn phenomenon detected")
        : (isUk ? "✅ Без феномену світанку" : "✅ No dawn phenomenon"),
    },
    basalAssessment,
    curve: sorted.map((e) => ({
      time: new Date(e.date).toLocaleTimeString(),
      glucose: client.convertGlucose(e.sgv),
      trend: client.getArrow(e.direction),
    })),
  };
}
