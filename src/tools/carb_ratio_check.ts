// Tool: carb_ratio_check
// Compare actual ICR from meal boluses vs profile ICR

import { z } from "zod";
import { NightscoutClient } from "../client.js";
import { NightscoutConfig } from "../config.js";
import { getStrings } from "../i18n/index.js";

export const schema = z.object({
  days: z.number().min(3).max(30).optional().describe("Days to analyze (default 7)"),
  target_rise_max: z.number().optional().describe("Max acceptable post-meal rise in mg/dL (default 60)"),
});

export const definition = {
  name: "carb_ratio_check",
  description:
    "Analyze real-world carb ratios by evaluating meal boluses and their post-meal glucose impact. Compares actual ICR effectiveness vs profile settings. Identifies if you're under- or over-bolusing for meals.",
  inputSchema: {
    type: "object" as const,
    properties: {
      days: { type: "number", description: "Days to analyze (default 7)" },
      target_rise_max: { type: "number", description: "Max acceptable rise in mg/dL (default 60)" },
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
  const days = params.days || 7;
  const maxRise = params.target_rise_max || 60;

  const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [treatments, entries, profiles] = await Promise.all([
    client.getTreatments(500, dateFrom),
    client.getEntries(5000, dateFrom),
    client.getProfile(),
  ]);

  if (!treatments || !entries || entries.length === 0) return { error: s.noData };

  // Find meal boluses with both insulin and carbs
  const meals = treatments.filter(
    (t) => t.insulin && t.insulin > 0 && t.carbs && t.carbs > 0
  );

  if (meals.length < 3) {
    return {
      error: isUk
        ? `Тільки ${meals.length} прийомів їжі з болюсами (потрібно мінімум 3)`
        : `Only ${meals.length} meals with boluses found (need at least 3)`,
    };
  }

  const analyses: Array<{
    time: string;
    carbs: number;
    insulin: number;
    actualRatio: number;
    preMeal: number;
    peak: number;
    rise: number;
    adequate: boolean;
  }> = [];

  for (const meal of meals) {
    const mealTime = new Date(meal.created_at).getTime();
    const carbs = meal.carbs!;
    const insulin = meal.insulin!;
    const actualRatio = Math.round(carbs / insulin * 10) / 10;

    // Pre-meal glucose
    const preMealEntries = entries.filter(
      (e) => e.date >= mealTime - 15 * 60 * 1000 && e.date <= mealTime + 5 * 60 * 1000
    );
    if (preMealEntries.length === 0) continue;
    const preMeal = preMealEntries.reduce((best, e) =>
      Math.abs(e.date - mealTime) < Math.abs(best.date - mealTime) ? e : best
    ).sgv;

    // Post-meal peak (30 min - 3 hours after)
    const postMeal = entries.filter(
      (e) => e.date > mealTime + 30 * 60 * 1000 && e.date < mealTime + 3 * 60 * 60 * 1000
    );
    if (postMeal.length < 3) continue;

    const peak = Math.max(...postMeal.map((e) => e.sgv));
    const rise = peak - preMeal;

    analyses.push({
      time: meal.created_at,
      carbs,
      insulin,
      actualRatio,
      preMeal,
      peak,
      rise,
      adequate: rise <= maxRise,
    });
  }

  if (analyses.length < 2) {
    return {
      error: isUk ? "Недостатньо даних для аналізу" : "Insufficient data for analysis",
    };
  }

  const avgRatio = Math.round(analyses.reduce((s, a) => s + a.actualRatio, 0) / analyses.length * 10) / 10;
  const avgRise = Math.round(analyses.reduce((s, a) => s + a.rise, 0) / analyses.length);
  const adequateCount = analyses.filter((a) => a.adequate).length;
  const adequatePercent = Math.round((adequateCount / analyses.length) * 100);

  // Get profile ICR
  let profileIcr: number | null = null;
  if (profiles?.length > 0) {
    const profile = profiles[0];
    const active = profile.store[profile.defaultProfile];
    if (active?.carbratio?.length > 0) {
      profileIcr = Math.round(active.carbratio.reduce((s, c) => s + c.value, 0) / active.carbratio.length * 10) / 10;
    }
  }

  let assessment: string;
  if (adequatePercent >= 70) {
    assessment = isUk ? "✅ ICR працює добре для більшості прийомів їжі" : "✅ ICR works well for most meals";
  } else if (avgRise > maxRise) {
    assessment = isUk
      ? `⚠️ Середній підйом ${client.convertGlucose(avgRise)} ${config.units} — можливо, потрібно зменшити ICR (більше інсуліну на г)`
      : `⚠️ Average rise ${client.convertGlucose(avgRise)} ${config.units} — may need to decrease ICR (more insulin per g)`;
  } else {
    assessment = isUk
      ? "⚠️ Неоднозначні результати — потрібен детальніший аналіз"
      : "⚠️ Mixed results — needs more detailed analysis";
  }

  return {
    analyzedMeals: analyses.length,
    totalMealsFound: meals.length,
    period: { days, from: dateFrom },
    actualICR: {
      average: `1U : ${avgRatio}g`,
      range: `1U : ${Math.min(...analyses.map((a) => a.actualRatio))}g – ${Math.max(...analyses.map((a) => a.actualRatio))}g`,
    },
    profileICR: profileIcr ? `1U : ${profileIcr}g` : null,
    postMealRise: {
      average: client.convertGlucose(avgRise),
      units: config.units,
      target: `< ${client.convertGlucose(maxRise)} ${config.units}`,
    },
    adequateBoluses: `${adequateCount}/${analyses.length} (${adequatePercent}%)`,
    assessment,
    meals: analyses.slice(0, 10).map((a) => ({
      time: a.time,
      carbs: `${a.carbs}g`,
      insulin: `${a.insulin}U`,
      ratio: `1:${a.actualRatio}`,
      rise: client.convertGlucose(a.rise),
      adequate: a.adequate ? "✅" : "❌",
    })),
    disclaimer: isUk
      ? "⚠️ Аналіз даних, не медична порада. Обговоріть зміни з лікарем."
      : "⚠️ Data analysis only, not medical advice. Discuss changes with your healthcare provider.",
  };
}
