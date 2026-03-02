// Tool: analyze_meal
// Automatic post-meal glucose response analysis

import { z } from "zod";
import { NightscoutClient } from "../client.js";
import { NightscoutConfig } from "../config.js";
import { getStrings } from "../i18n/index.js";

export const schema = z.object({
  meal_time: z.string().optional().describe("Meal time (ISO 8601 or 'YYYY-MM-DD HH:mm'). If omitted, finds the most recent meal bolus."),
  hours_after: z.number().min(1).max(6).optional().describe("Hours to analyze after the meal (default 3)"),
});

export const definition = {
  name: "analyze_meal",
  description:
    "Automatically analyze post-meal glucose response. Finds the meal bolus/carbs entry, tracks glucose before, during, and after the meal. Calculates: pre-meal glucose, peak value, time to peak, rise amount, time to return to range. Assesses bolus adequacy.",
  inputSchema: {
    type: "object" as const,
    properties: {
      meal_time: { type: "string", description: "Meal time (ISO 8601). If omitted, uses most recent meal." },
      hours_after: { type: "number", description: "Hours to analyze after meal (default 3)" },
    },
  },
};

export async function execute(
  client: NightscoutClient,
  config: NightscoutConfig,
  params: z.infer<typeof schema>
) {
  const s = getStrings(config.locale);
  const hoursAfter = params.hours_after || 3;
  const isUk = config.locale === "uk";

  let mealTime: number;

  if (params.meal_time) {
    mealTime = new Date(params.meal_time).getTime();
  } else {
    // Find most recent meal bolus
    const recentTreatments = await client.getTreatments(20);
    const mealBolus = recentTreatments?.find(
      (t) => t.eventType === "Meal Bolus" || (t.carbs && t.carbs > 0)
    );
    if (!mealBolus) {
      return { error: isUk ? "Не знайдено записів їжі" : "No meal entries found" };
    }
    mealTime = new Date(mealBolus.created_at).getTime();
  }

  // Get glucose: 30 min before → hoursAfter after
  const dateFrom = new Date(mealTime - 30 * 60 * 1000).toISOString();
  const dateTo = new Date(mealTime + hoursAfter * 60 * 60 * 1000).toISOString();

  const [entries, treatments] = await Promise.all([
    client.getEntries(500, dateFrom, dateTo),
    client.getTreatments(20, dateFrom, dateTo),
  ]);

  if (!entries || entries.length < 5) {
    return { error: s.noData, mealTime: new Date(mealTime).toISOString() };
  }

  // Find meal treatment
  const mealTreatment = treatments?.find(
    (t) =>
      Math.abs(new Date(t.created_at).getTime() - mealTime) < 30 * 60 * 1000 &&
      (t.eventType === "Meal Bolus" || (t.carbs && t.carbs > 0))
  );

  // Split into pre-meal and post-meal
  const preMealEntries = entries
    .filter((e) => e.date < mealTime && e.date >= mealTime - 30 * 60 * 1000)
    .sort((a, b) => b.date - a.date);

  const postMealEntries = entries
    .filter((e) => e.date >= mealTime)
    .sort((a, b) => a.date - b.date);

  // Pre-meal glucose (closest before meal)
  const preMealGlucose = preMealEntries.length > 0
    ? preMealEntries[0].sgv
    : postMealEntries.length > 0
    ? postMealEntries[0].sgv
    : null;

  if (!preMealGlucose || postMealEntries.length === 0) {
    return { error: s.noData };
  }

  // Find peak
  const peak = postMealEntries.reduce((max, e) => (e.sgv > max.sgv ? e : max), postMealEntries[0]);
  const peakRise = peak.sgv - preMealGlucose;
  const timeTopeakMin = Math.round((peak.date - mealTime) / 60000);

  // Find return to pre-meal level (within 20 mg/dL)
  let returnToRangeMin: number | null = null;
  for (const entry of postMealEntries) {
    if (entry.date > peak.date && entry.sgv <= preMealGlucose + 20) {
      returnToRangeMin = Math.round((entry.date - mealTime) / 60000);
      break;
    }
  }

  // Find return to 180 mg/dL if it went above
  let returnTo180Min: number | null = null;
  if (peak.sgv > 180) {
    for (const entry of postMealEntries) {
      if (entry.date > peak.date && entry.sgv <= 180) {
        returnTo180Min = Math.round((entry.date - mealTime) / 60000);
        break;
      }
    }
  }

  // Glucose at key timepoints
  const at = (minutes: number) => {
    const target = mealTime + minutes * 60 * 1000;
    const closest = postMealEntries.reduce((best, e) =>
      Math.abs(e.date - target) < Math.abs(best.date - target) ? e : best
    );
    return Math.abs(closest.date - target) < 15 * 60 * 1000
      ? client.convertGlucose(closest.sgv)
      : null;
  };

  // Assessment
  let assessment: string;
  if (peakRise < 30) assessment = isUk ? "✅ Відмінно — мінімальний підйом" : "✅ Excellent — minimal rise";
  else if (peakRise < 50) assessment = isUk ? "✅ Добре — помірний підйом" : "✅ Good — moderate rise";
  else if (peakRise < 80) assessment = isUk ? "⚠️ Прийнятно — значний підйом" : "⚠️ Acceptable — significant rise";
  else assessment = isUk ? "❌ Надмірний підйом — потребує корекції" : "❌ Excessive rise — needs adjustment";

  return {
    mealTime: new Date(mealTime).toISOString(),
    treatment: mealTreatment
      ? {
          type: mealTreatment.eventType,
          insulin: mealTreatment.insulin || null,
          carbs: mealTreatment.carbs || null,
          notes: mealTreatment.notes || null,
        }
      : null,
    units: config.units,
    preMealGlucose: client.convertGlucose(preMealGlucose),
    peak: {
      glucose: client.convertGlucose(peak.sgv),
      rise: client.convertGlucose(peakRise),
      timeTopeakMin,
    },
    recovery: {
      returnToBaseline: returnToRangeMin ? `${returnToRangeMin} min` : isUk ? "не повернулась" : "did not return",
      returnTo180: peak.sgv > 180
        ? (returnTo180Min ? `${returnTo180Min} min` : isUk ? "не повернулась" : "did not return")
        : "N/A — stayed below 180",
    },
    timepoints: {
      "at_30min": at(30),
      "at_60min": at(60),
      "at_90min": at(90),
      "at_120min": at(120),
      "at_180min": at(180),
    },
    assessment,
    curve: postMealEntries.slice(0, 40).map((e) => ({
      min: Math.round((e.date - mealTime) / 60000),
      glucose: client.convertGlucose(e.sgv),
    })),
  };
}
