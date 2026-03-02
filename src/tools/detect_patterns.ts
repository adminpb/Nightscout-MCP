// Tool: detect_patterns
// Analyzes glucose data to find recurring patterns

import { z } from "zod";
import { NightscoutClient, SGVEntry } from "../client.js";
import { NightscoutConfig } from "../config.js";
import { getStrings } from "../i18n/index.js";

export const schema = z.object({
  days: z
    .number()
    .min(3)
    .max(30)
    .optional()
    .describe("Number of days to analyze (default 7, min 3, max 30)"),
  targetLow: z.number().optional().describe("Low target in mg/dL (default 70)"),
  targetHigh: z.number().optional().describe("High target in mg/dL (default 180)"),
});

export const definition = {
  name: "detect_patterns",
  description:
    "Analyze glucose data over multiple days to detect recurring patterns: overnight lows, dawn phenomenon, post-meal spikes, time-of-day trends, and day-to-day variability. Requires at least 3 days of data.",
  inputSchema: {
    type: "object" as const,
    properties: {
      days: {
        type: "number",
        description: "Number of days to analyze (default 7, min 3)",
      },
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

interface TimeBlock {
  label: string;
  labelUk: string;
  startHour: number;
  endHour: number;
}

const TIME_BLOCKS: TimeBlock[] = [
  { label: "Night (00:00–06:00)", labelUk: "Ніч (00:00–06:00)", startHour: 0, endHour: 6 },
  { label: "Morning (06:00–10:00)", labelUk: "Ранок (06:00–10:00)", startHour: 6, endHour: 10 },
  { label: "Midday (10:00–14:00)", labelUk: "День (10:00–14:00)", startHour: 10, endHour: 14 },
  { label: "Afternoon (14:00–18:00)", labelUk: "Після обіду (14:00–18:00)", startHour: 14, endHour: 18 },
  { label: "Evening (18:00–22:00)", labelUk: "Вечір (18:00–22:00)", startHour: 18, endHour: 22 },
  { label: "Late night (22:00–00:00)", labelUk: "Пізній вечір (22:00–00:00)", startHour: 22, endHour: 24 },
];

function getHour(entry: SGVEntry): number {
  return new Date(entry.date).getHours();
}

function getDateKey(entry: SGVEntry): string {
  return new Date(entry.date).toISOString().split("T")[0];
}

function calcStats(values: number[]) {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const sd = Math.sqrt(values.map((v) => Math.pow(v - avg, 2)).reduce((a, b) => a + b, 0) / values.length);
  return {
    avg: Math.round(avg),
    sd: Math.round(sd),
    min: Math.min(...values),
    max: Math.max(...values),
    count: values.length,
  };
}

export async function execute(
  client: NightscoutClient,
  config: NightscoutConfig,
  params: z.infer<typeof schema>
) {
  const s = getStrings(config.locale);
  const days = params.days || 7;
  const targetLow = params.targetLow || 70;
  const targetHigh = params.targetHigh || 180;

  const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const dateTo = new Date().toISOString();
  const maxEntries = days * 288;

  const entries = await client.getEntries(Math.min(maxEntries, 5000), dateFrom, dateTo);

  if (!entries || entries.length < 36) {
    return { error: s.noData, period: { from: dateFrom, to: dateTo } };
  }

  const isUk = config.locale === "uk";

  // === Time block analysis ===
  const blockAnalysis = TIME_BLOCKS.map((block) => {
    const blockEntries = entries.filter((e) => {
      const h = getHour(e);
      return h >= block.startHour && h < block.endHour;
    });
    const sgvValues = blockEntries.map((e) => e.sgv);
    const stats = calcStats(sgvValues);
    if (!stats) return null;

    const lowCount = sgvValues.filter((v) => v < targetLow).length;
    const highCount = sgvValues.filter((v) => v > targetHigh).length;
    const inRangePercent = Math.round(
      (sgvValues.filter((v) => v >= targetLow && v <= targetHigh).length / sgvValues.length) * 100
    );

    return {
      period: isUk ? block.labelUk : block.label,
      average: client.convertGlucose(stats.avg),
      sd: client.convertGlucose(stats.sd),
      min: client.convertGlucose(stats.min),
      max: client.convertGlucose(stats.max),
      tir: `${inRangePercent}%`,
      lowEvents: lowCount,
      highEvents: highCount,
      readings: stats.count,
    };
  }).filter(Boolean);

  // === Overnight lows (00:00-06:00) ===
  const nightEntries = entries.filter((e) => getHour(e) >= 0 && getHour(e) < 6);
  const nightLows = nightEntries.filter((e) => e.sgv < targetLow);
  const nightLowDays = new Set(nightLows.map(getDateKey));

  // === Dawn phenomenon (04:00-08:00 rising trend) ===
  const uniqueDays = [...new Set(entries.map(getDateKey))];
  let dawnPhenomenonDays = 0;

  for (const day of uniqueDays) {
    const earlyMorning = entries.filter((e) => {
      const d = new Date(e.date);
      return getDateKey(e) === day && d.getHours() >= 4 && d.getHours() < 8;
    });
    if (earlyMorning.length < 6) continue;

    const sorted = earlyMorning.sort((a, b) => a.date - b.date);
    const first3Avg = sorted.slice(0, 3).reduce((s, e) => s + e.sgv, 0) / 3;
    const last3Avg = sorted.slice(-3).reduce((s, e) => s + e.sgv, 0) / 3;

    if (last3Avg - first3Avg > 30) dawnPhenomenonDays++;
  }

  // === Post-meal spikes (look for rapid rises > 60 mg/dL in 60 min) ===
  let spikeEvents: Array<{ time: string; rise: number }> = [];
  for (let i = 0; i < entries.length - 12; i++) {
    const current = entries[i];
    // Look 30-90 min ahead
    const laterEntries = entries.filter(
      (e) => e.date < current.date && e.date > current.date - 90 * 60 * 1000 && e.date < current.date - 20 * 60 * 1000
    );
    if (laterEntries.length === 0) continue;

    const minBefore = Math.min(...laterEntries.map((e) => e.sgv));
    const rise = current.sgv - minBefore;

    if (rise > 60) {
      spikeEvents.push({
        time: new Date(current.date).toISOString(),
        rise: client.convertGlucose(rise),
      });
    }
  }
  // Deduplicate spikes (keep 1 per 2 hours)
  const deduped: typeof spikeEvents = [];
  for (const spike of spikeEvents) {
    const spikeTime = new Date(spike.time).getTime();
    const tooClose = deduped.some(
      (s) => Math.abs(new Date(s.time).getTime() - spikeTime) < 2 * 60 * 60 * 1000
    );
    if (!tooClose) deduped.push(spike);
  }

  // === Day-to-day variability ===
  const dailyAverages: Record<string, number> = {};
  for (const day of uniqueDays) {
    const dayEntries = entries.filter((e) => getDateKey(e) === day);
    const avg = dayEntries.reduce((s, e) => s + e.sgv, 0) / dayEntries.length;
    dailyAverages[day] = Math.round(avg);
  }

  const dailyAvgValues = Object.values(dailyAverages);
  const dayVariability = calcStats(dailyAvgValues);

  // === Build patterns list ===
  const patterns: Array<{ pattern: string; severity: string; details: string }> = [];

  if (nightLowDays.size >= 2) {
    patterns.push({
      pattern: isUk ? "Нічні гіпоглікемії" : "Overnight lows",
      severity: nightLowDays.size >= Math.ceil(uniqueDays.length / 2) ? "⚠️ frequent" : "🔍 occasional",
      details: isUk
        ? `${nightLowDays.size} з ${uniqueDays.length} ночей з гіпо (${nightLows.length} показників < ${client.convertGlucose(targetLow)})`
        : `${nightLowDays.size} of ${uniqueDays.length} nights with lows (${nightLows.length} readings < ${client.convertGlucose(targetLow)})`,
    });
  }

  if (dawnPhenomenonDays >= 2) {
    patterns.push({
      pattern: isUk ? "Феномен світанку" : "Dawn phenomenon",
      severity: dawnPhenomenonDays >= Math.ceil(uniqueDays.length / 2) ? "⚠️ frequent" : "🔍 occasional",
      details: isUk
        ? `${dawnPhenomenonDays} з ${uniqueDays.length} днів зі зростанням > 1.7 mmol/L між 04:00–08:00`
        : `${dawnPhenomenonDays} of ${uniqueDays.length} days with > 30 mg/dL rise between 04:00–08:00`,
    });
  }

  if (deduped.length >= 3) {
    patterns.push({
      pattern: isUk ? "Постпрандіальні піки" : "Post-meal spikes",
      severity: deduped.length >= days ? "⚠️ frequent" : "🔍 occasional",
      details: isUk
        ? `${deduped.length} різких підйомів (> 3.3 mmol/L) за ${days} днів`
        : `${deduped.length} rapid rises (> 60 mg/dL) over ${days} days`,
    });
  }

  if (dayVariability && dayVariability.sd > 15) {
    patterns.push({
      pattern: isUk ? "Висока варіабельність між днями" : "High day-to-day variability",
      severity: dayVariability.sd > 25 ? "⚠️ high" : "🔍 moderate",
      details: isUk
        ? `SD середньодобової глюкози: ${client.convertGlucose(dayVariability.sd)} ${config.units}`
        : `Daily average SD: ${client.convertGlucose(dayVariability.sd)} ${config.units}`,
    });
  }

  // Find worst / best time blocks
  const blocksSorted = [...(blockAnalysis as any[])].sort(
    (a, b) => parseInt(b.tir) - parseInt(a.tir)
  );

  return {
    period: {
      from: dateFrom,
      to: dateTo,
      days: uniqueDays.length,
      totalReadings: entries.length,
    },
    units: config.units,
    patterns: patterns.length > 0
      ? patterns
      : [{ pattern: isUk ? "Патернів не виявлено" : "No significant patterns detected", severity: "✅", details: "" }],
    timeBlockAnalysis: blockAnalysis,
    bestTimeBlock: blocksSorted[0]?.period || null,
    worstTimeBlock: blocksSorted[blocksSorted.length - 1]?.period || null,
    overnightLows: {
      nightsWithLows: nightLowDays.size,
      totalNights: uniqueDays.length,
      totalLowReadings: nightLows.length,
    },
    dawnPhenomenon: {
      daysDetected: dawnPhenomenonDays,
      totalDays: uniqueDays.length,
    },
    spikes: {
      count: deduped.length,
      events: deduped.slice(0, 10), // top 10
    },
    dailyAverages: Object.entries(dailyAverages).map(([date, avg]) => ({
      date,
      average: client.convertGlucose(avg),
      units: config.units,
    })),
  };
}
