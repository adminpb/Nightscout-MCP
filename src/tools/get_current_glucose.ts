// Tool: get_current_glucose
// Returns the latest glucose reading with trend arrow, delta, and age

import { z } from "zod";
import { NightscoutClient } from "../client.js";
import { NightscoutConfig } from "../config.js";
import { getStrings, t } from "../i18n/index.js";

export const schema = z.object({});

export const definition = {
  name: "get_current_glucose",
  description:
    "Get the current (latest) glucose value with trend direction, delta from previous reading, and how old the reading is. Always call this first to understand the current state.",
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
  const entries = await client.getEntries(2);

  if (!entries || entries.length === 0) {
    return { error: s.noGlucoseData };
  }

  const latest = entries[0];
  const previous = entries.length > 1 ? entries[1] : null;

  const glucoseValue = client.convertGlucose(latest.sgv);
  const arrow = client.getArrow(latest.direction);
  const ageMs = Date.now() - latest.date;
  const ageMinutes = Math.round(ageMs / 60000);

  let delta: number | null = null;
  if (previous) {
    delta =
      Math.round(
        (client.convertGlucose(latest.sgv) -
          client.convertGlucose(previous.sgv)) *
          10
      ) / 10;
  }

  // Determine status
  let status: string;
  const mgdl = latest.sgv;
  if (mgdl < 55) status = s.urgentLow;
  else if (mgdl < 70) status = s.low;
  else if (mgdl <= 180) status = s.inRange;
  else if (mgdl <= 250) status = s.high;
  else status = s.urgentHigh;

  return {
    glucose: glucoseValue,
    units: config.units,
    trend: arrow,
    direction: latest.direction,
    delta: delta !== null ? `${delta > 0 ? "+" : ""}${delta}` : s.notAvailable,
    status,
    age: t(s.minAgo, { n: ageMinutes }),
    ageMinutes,
    timestamp: latest.dateString,
    device: latest.device,
    stale: ageMinutes > 15,
  };
}
