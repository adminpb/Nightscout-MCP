// Internationalization support
// Default: English. Optional locales can be added.

export interface TranslationStrings {
  // Status labels
  urgentLow: string;
  low: string;
  inRange: string;
  high: string;
  urgentHigh: string;
  stale: string;

  // Statistics
  stable: string;
  unstable: string;
  tirGoal: string;
  belowRangeGoal: string;
  yes: string;
  no: string;

  // Time
  minAgo: string;

  // Reports
  noData: string;
  noTreatments: string;
  noNotableEvents: string;

  // Device
  notAvailable: string;

  // Errors
  noGlucoseData: string;
  noProfileFound: string;
  profileNotFound: string;
  noDeviceStatus: string;
  writeDisabled: string;

  // Notable events
  veryLowAt: string;
  veryHighAt: string;
}

const en: TranslationStrings = {
  urgentLow: "URGENT LOW 🔴",
  low: "LOW 🟡",
  inRange: "IN RANGE 🟢",
  high: "HIGH 🟡",
  urgentHigh: "URGENT HIGH 🔴",
  stale: "STALE",

  stable: "Stable (CV < 36%)",
  unstable: "Unstable (CV ≥ 36%)",
  tirGoal: "≥ 70% (recommended)",
  belowRangeGoal: "< 4%",
  yes: "Yes",
  no: "No",

  minAgo: "{n} min ago",

  noData: "No glucose data for this period",
  noTreatments: "No treatments found for this period",
  noNotableEvents: "No notable events",

  notAvailable: "N/A",

  noGlucoseData: "No glucose data available",
  noProfileFound: "No profile found",
  profileNotFound: 'Default profile "{name}" not found in store',
  noDeviceStatus: "No device status available",
  writeDisabled:
    "Write operations are disabled. Set NIGHTSCOUT_READONLY=false to enable.",

  veryLowAt: "⚠️ Very low: {value} {units} at {time}",
  veryHighAt: "⚠️ Very high: {value} {units} at {time}",
};

const uk: TranslationStrings = {
  urgentLow: "КРИТИЧНО НИЗЬКА 🔴",
  low: "НИЗЬКА 🟡",
  inRange: "В ДІАПАЗОНІ 🟢",
  high: "ВИСОКА 🟡",
  urgentHigh: "КРИТИЧНО ВИСОКА 🔴",
  stale: "ЗАСТАРІЛІ ДАНІ",

  stable: "Стабільна (CV < 36%)",
  unstable: "Нестабільна (CV ≥ 36%)",
  tirGoal: "≥ 70% (рекомендовано)",
  belowRangeGoal: "< 4%",
  yes: "Так",
  no: "Ні",

  minAgo: "{n} хв тому",

  noData: "Немає даних глюкози за цей період",
  noTreatments: "Немає записів лікування за цей період",
  noNotableEvents: "Немає помітних подій",

  notAvailable: "Н/Д",

  noGlucoseData: "Немає даних глюкози",
  noProfileFound: "Профіль не знайдено",
  profileNotFound: 'Профіль за замовчуванням "{name}" не знайдено',
  noDeviceStatus: "Статус пристрою недоступний",
  writeDisabled:
    "Запис вимкнено. Встановіть NIGHTSCOUT_READONLY=false для увімкнення.",

  veryLowAt: "⚠️ Дуже низька: {value} {units} о {time}",
  veryHighAt: "⚠️ Дуже висока: {value} {units} о {time}",
};

const locales: Record<string, TranslationStrings> = { en, uk };

export function getStrings(locale: string): TranslationStrings {
  return locales[locale] || locales["en"];
}

// Simple template interpolation: t("Hello {name}", { name: "World" })
export function t(
  template: string,
  params: Record<string, string | number> = {}
): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, String(value));
  }
  return result;
}
