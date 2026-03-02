// Tool: insulin_sensitivity_check
// Compare actual ISF from correction boluses vs profile ISF

import { z } from "zod";
import { NightscoutClient } from "../client.js";
import { NightscoutConfig } from "../config.js";
import { getStrings } from "../i18n/index.js";

export const schema = z.object({
  days: z.number().min(3).max(30).optional().describe("Days to analyze (default 7)"),
});

export const definition = {
  name: "insulin_sensitivity_check",
  description:
    "Analyze real-world insulin sensitivity by tracking correction boluses and their glucose impact. Compares actual ISF from data with profile ISF to detect if settings need adjustment. Requires at least 3 days with correction events.",
  inputSchema: {
    type: "object" as const,
    properties: {
      days: { type: "number", description: "Days to analyze (default 7)" },
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

  const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [treatments, entries, profiles] = await Promise.all([
    client.getTreatments(500, dateFrom),
    client.getEntries(5000, dateFrom),
    client.getProfile(),
  ]);

  if (!treatments || !entries || entries.length === 0) {
    return { error: s.noData };
  }

  // Find correction boluses (insulin without carbs)
  const corrections = treatments.filter(
    (t) =>
      t.insulin && t.insulin > 0 &&
      (!t.carbs || t.carbs === 0) &&
      (t.eventType === "Correction Bolus" || t.eventType === "Bolus" || !t.carbs)
  );

  if (corrections.length < 3) {
    return {
      error: isUk
        ? `Знайдено тільки ${corrections.length} корекційних болюсів (потрібно мінімум 3)`
        : `Only ${corrections.length} correction boluses found (need at least 3)`,
      tip: isUk
        ? "Спробуйте збільшити період аналізу"
        : "Try increasing the analysis period",
    };
  }

  // For each correction, track glucose drop over 2-4 hours
  const analyses: Array<{
    time: string;
    insulin: number;
    glucoseBefore: number;
    glucoseAfter: number;
    drop: number;
    actualIsf: number;
  }> = [];

  for (const corr of corrections) {
    const corrTime = new Date(corr.created_at).getTime();
    const insulin = corr.insulin!;

    // Glucose at correction time (±10 min)
    const nearCorr = entries.filter(
      (e) => Math.abs(e.date - corrTime) < 10 * 60 * 1000
    );
    if (nearCorr.length === 0) continue;
    const glucoseBefore = nearCorr.reduce((best, e) =>
      Math.abs(e.date - corrTime) < Math.abs(best.date - corrTime) ? e : best
    ).sgv;

    // Glucose 2-4 hours after (find the lowest point)
    const after = entries.filter(
      (e) => e.date > corrTime + 90 * 60 * 1000 && e.date < corrTime + 4 * 60 * 60 * 1000
    );
    if (after.length < 3) continue;

    // Check no carbs were given in the 3h window
    const carbsInWindow = treatments.filter(
      (t) => t.carbs && t.carbs > 0 &&
        new Date(t.created_at).getTime() > corrTime &&
        new Date(t.created_at).getTime() < corrTime + 3 * 60 * 60 * 1000
    );
    if (carbsInWindow.length > 0) continue;

    const lowestAfter = Math.min(...after.map((e) => e.sgv));
    const drop = glucoseBefore - lowestAfter;

    if (drop > 0 && insulin > 0) {
      analyses.push({
        time: corr.created_at,
        insulin,
        glucoseBefore,
        glucoseAfter: lowestAfter,
        drop,
        actualIsf: Math.round(drop / insulin),
      });
    }
  }

  if (analyses.length < 2) {
    return {
      error: isUk
        ? "Недостатньо чистих корекцій для аналізу (заважають вуглеводи або нестача даних)"
        : "Not enough clean corrections to analyze (carbs interference or insufficient data)",
    };
  }

  const actualIsfs = analyses.map((a) => a.actualIsf);
  const avgActualIsf = Math.round(actualIsfs.reduce((a, b) => a + b, 0) / actualIsfs.length);

  // Get profile ISF
  let profileIsf: number | null = null;
  if (profiles && profiles.length > 0) {
    const profile = profiles[0];
    const active = profile.store[profile.defaultProfile];
    if (active?.sens?.length > 0) {
      profileIsf = Math.round(active.sens.reduce((s, v) => s + v.value, 0) / active.sens.length);
    }
  }

  const diff = profileIsf ? Math.round(((avgActualIsf - profileIsf) / profileIsf) * 100) : null;

  let assessment: string;
  if (!profileIsf) {
    assessment = isUk ? "🔍 Профіль ISF недоступний для порівняння" : "🔍 Profile ISF unavailable for comparison";
  } else if (Math.abs(diff!) < 15) {
    assessment = isUk ? "✅ ISF в профілі відповідає реальності" : "✅ Profile ISF matches reality";
  } else if (avgActualIsf > profileIsf) {
    assessment = isUk
      ? `⚠️ Реальна ISF вища (${client.convertGlucose(avgActualIsf)} vs ${client.convertGlucose(profileIsf)}) — інсулін діє сильніше, ніж в налаштуваннях`
      : `⚠️ Actual ISF higher (${client.convertGlucose(avgActualIsf)} vs ${client.convertGlucose(profileIsf)}) — insulin more effective than settings suggest`;
  } else {
    assessment = isUk
      ? `⚠️ Реальна ISF нижча (${client.convertGlucose(avgActualIsf)} vs ${client.convertGlucose(profileIsf)}) — інсулін діє слабше, ніж в налаштуваннях`
      : `⚠️ Actual ISF lower (${client.convertGlucose(avgActualIsf)} vs ${client.convertGlucose(profileIsf)}) — insulin less effective than settings suggest`;
  }

  return {
    units: `${config.units}/U`,
    analyzedCorrections: analyses.length,
    totalCorrectionsFound: corrections.length,
    period: { days, from: dateFrom },
    actualISF: {
      average: client.convertGlucose(avgActualIsf),
      min: client.convertGlucose(Math.min(...actualIsfs)),
      max: client.convertGlucose(Math.max(...actualIsfs)),
    },
    profileISF: profileIsf ? client.convertGlucose(profileIsf) : null,
    deviation: diff !== null ? `${diff > 0 ? "+" : ""}${diff}%` : null,
    assessment,
    events: analyses.slice(0, 10).map((a) => ({
      time: a.time,
      insulin: `${a.insulin} U`,
      before: client.convertGlucose(a.glucoseBefore),
      after: client.convertGlucose(a.glucoseAfter),
      drop: client.convertGlucose(a.drop),
      isf: client.convertGlucose(a.actualIsf),
    })),
    disclaimer: isUk
      ? "⚠️ Аналіз даних, не медична порада. Обговоріть зміни з лікарем."
      : "⚠️ Data analysis only, not medical advice. Discuss changes with your healthcare provider.",
  };
}
