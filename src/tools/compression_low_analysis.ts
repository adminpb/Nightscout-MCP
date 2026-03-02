// Tool: compression_low_analysis
// Detect false lows caused by sensor compression (lying on sensor)

import { z } from "zod";
import { NightscoutClient, SGVEntry } from "../client.js";
import { NightscoutConfig } from "../config.js";
import { getStrings } from "../i18n/index.js";

export const schema = z.object({
  days: z.number().min(1).max(14).optional().describe("Days to analyze (default 7)"),
});

export const definition = {
  name: "compression_low_analysis",
  description:
    "Detect probable compression lows (false low readings caused by lying on the CGM sensor). Identifies characteristic patterns: sudden drop during sleep hours, quick V-shaped recovery without treatment, readings that seem too low for the context. Helps distinguish real lows from sensor artifacts.",
  inputSchema: {
    type: "object" as const,
    properties: {
      days: { type: "number", description: "Days to analyze (default 7)" },
    },
  },
};

interface CompressionEvent {
  start: string;
  lowest: number;
  lowestTime: string;
  recovery: string;
  durationMin: number;
  dropMgdl: number;
  vShaped: boolean;
  nighttime: boolean;
}

export async function execute(
  client: NightscoutClient,
  config: NightscoutConfig,
  params: z.infer<typeof schema>
) {
  const s = getStrings(config.locale);
  const isUk = config.locale === "uk";
  const days = params.days || 7;

  const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const entries = await client.getEntries(Math.min(days * 288, 5000), dateFrom);

  if (!entries || entries.length < 50) return { error: s.noData };

  // Get treatments to check if lows were treated
  const treatments = await client.getTreatments(200, dateFrom);
  const carbTimes = (treatments || [])
    .filter((t) => t.carbs && t.carbs > 0)
    .map((t) => new Date(t.created_at).getTime());

  const sorted = entries.sort((a, b) => a.date - b.date);
  const events: CompressionEvent[] = [];

  // Scan for compression low patterns
  for (let i = 5; i < sorted.length - 5; i++) {
    const entry = sorted[i];

    // Only look at low readings
    if (entry.sgv >= 70) continue;

    // Already part of a detected event?
    if (events.some((e) => Math.abs(new Date(e.lowestTime).getTime() - entry.date) < 60 * 60 * 1000)) continue;

    // Find the low cluster around this point
    const clusterStart = sorted.findIndex(
      (e, idx) => idx >= i - 10 && idx <= i && e.sgv >= 70 && sorted[idx + 1]?.sgv < 70
    );
    const startIdx = clusterStart >= 0 ? clusterStart : Math.max(0, i - 5);

    // Find recovery (back above 70)
    let endIdx = i;
    for (let j = i + 1; j < sorted.length && j < i + 20; j++) {
      if (sorted[j].sgv >= 70) {
        endIdx = j;
        break;
      }
      endIdx = j;
    }

    const beforeGlucose = sorted[startIdx].sgv;
    const lowest = Math.min(...sorted.slice(startIdx, endIdx + 1).map((e) => e.sgv));
    const lowestEntry = sorted.slice(startIdx, endIdx + 1).reduce((a, b) => a.sgv < b.sgv ? a : b);
    const afterGlucose = sorted[Math.min(endIdx + 3, sorted.length - 1)].sgv;
    const durationMin = Math.round((sorted[endIdx].date - sorted[startIdx].date) / 60000);
    const drop = beforeGlucose - lowest;

    // Compression low characteristics:
    // 1. V-shaped: drops fast, recovers fast without treatment
    const vShaped = afterGlucose >= beforeGlucose - 20 && durationMin < 120;

    // 2. No carbs given during or shortly before recovery
    const lowTime = lowestEntry.date;
    const treatedWithCarbs = carbTimes.some(
      (ct) => ct >= lowTime - 30 * 60 * 1000 && ct <= sorted[endIdx].date
    );

    // 3. Nighttime (sleep hours)
    const hour = new Date(lowestEntry.date).getHours();
    const nighttime = hour >= 22 || hour < 7;

    // Score compression probability
    let score = 0;
    if (vShaped) score += 3;
    if (!treatedWithCarbs) score += 2;
    if (nighttime) score += 2;
    if (drop > 40) score += 1;
    if (durationMin < 60) score += 1;
    if (lowest < 55 && afterGlucose > 100) score += 2; // extreme V

    if (score >= 4) {
      events.push({
        start: sorted[startIdx].dateString,
        lowest,
        lowestTime: lowestEntry.dateString,
        recovery: sorted[endIdx].dateString,
        durationMin,
        dropMgdl: drop,
        vShaped,
        nighttime,
      });
    }
  }

  // Deduplicate (events within 2h of each other)
  const deduped: CompressionEvent[] = [];
  for (const ev of events) {
    const time = new Date(ev.lowestTime).getTime();
    if (!deduped.some((d) => Math.abs(new Date(d.lowestTime).getTime() - time) < 2 * 60 * 60 * 1000)) {
      deduped.push(ev);
    }
  }

  // Count total real lows for comparison
  const allLowEntries = sorted.filter((e) => e.sgv < 70);
  const nightLows = allLowEntries.filter((e) => {
    const h = new Date(e.date).getHours();
    return h >= 22 || h < 7;
  });

  return {
    period: { days, from: dateFrom },
    units: config.units,
    compressionLowsDetected: deduped.length,
    totalLowReadings: allLowEntries.length,
    nighttimeLowReadings: nightLows.length,
    estimatedFalsePositiveRate: allLowEntries.length > 0
      ? `~${Math.round((deduped.length * 12 / allLowEntries.length) * 100)}%`
      : "N/A",
    events: deduped.map((e) => ({
      time: e.lowestTime,
      lowest: client.convertGlucose(e.lowest),
      drop: client.convertGlucose(e.dropMgdl),
      duration: `${e.durationMin} min`,
      pattern: e.vShaped ? "V-shape ✅" : "gradual",
      nighttime: e.nighttime ? "🌙" : "☀️",
    })),
    interpretation: deduped.length > 0
      ? (isUk
        ? `Виявлено ${deduped.length} ймовірних компресійних лоу. Ці показники, скоріш за все, не відображають реальну глюкозу — сенсор був притиснутий тілом під час сну.`
        : `Detected ${deduped.length} probable compression lows. These readings likely don't reflect actual glucose — the sensor was compressed by body pressure during sleep.`)
      : (isUk
        ? "Компресійних лоу не виявлено. Нічні показники виглядають надійними."
        : "No compression lows detected. Overnight readings appear reliable."),
    tip: isUk
      ? "💡 Щоб зменшити компресійні лоу: спробуйте інше місце для сенсора або спіть на іншому боці"
      : "💡 To reduce compression lows: try a different sensor site or sleep on the other side",
  };
}
