// Tool: get_profile
// Returns the active Nightscout profile with ISF, ICR, basals, targets

import { z } from "zod";
import { NightscoutClient } from "../client.js";
import { NightscoutConfig } from "../config.js";
import { getStrings } from "../i18n/index.js";

export const schema = z.object({});

export const definition = {
  name: "get_profile",
  description:
    "Get the active Nightscout profile: insulin sensitivity factor (ISF), insulin-to-carb ratio (ICR), basal rates, target glucose ranges, and DIA. Useful for understanding pump/loop settings.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
};

export async function execute(
  client: NightscoutClient,
  config: NightscoutConfig,
  _params: z.infer<typeof schema>
) {
  const s = getStrings(config.locale);
  const profiles = await client.getProfile();

  if (!profiles || profiles.length === 0) {
    return { error: s.noProfileFound };
  }

  const profile = profiles[0];
  const activeProfileName = profile.defaultProfile;
  const activeProfile = profile.store[activeProfileName];

  if (!activeProfile) {
    return {
      error: s.profileNotFound.replace("{name}", activeProfileName),
    };
  }

  return {
    name: activeProfileName,
    dia: activeProfile.dia,
    units: activeProfile.units,
    timezone: activeProfile.timezone,
    basalRates: activeProfile.basal.map((b) => ({
      time: b.time,
      rate: `${b.value} U/hr`,
    })),
    carbRatio: activeProfile.carbratio.map((c) => ({
      time: c.time,
      ratio: `1U : ${c.value}g`,
    })),
    sensitivity: activeProfile.sens.map((s) => ({
      time: s.time,
      isf: `${client.convertGlucose(s.value)} ${config.units}/U`,
    })),
    targetRange: activeProfile.target_low.map((low, i) => ({
      time: low.time,
      low: client.convertGlucose(low.value),
      high: client.convertGlucose(
        activeProfile.target_high[i]?.value || low.value
      ),
      units: config.units,
    })),
    totalDailyBasal: `${
      Math.round(
        activeProfile.basal.reduce((sum, b, i, arr) => {
          const nextTime = arr[i + 1]?.timeAsSeconds || 86400;
          const duration = (nextTime - b.timeAsSeconds) / 3600;
          return sum + b.value * duration;
        }, 0) * 100
      ) / 100
    } U`,
  };
}
