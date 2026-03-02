// Tool: get_device_status
// Returns pump, sensor, loop status, IOB, COB, battery

import { z } from "zod";
import { NightscoutClient } from "../client.js";
import { NightscoutConfig } from "../config.js";
import { getStrings } from "../i18n/index.js";

export const schema = z.object({
  count: z.number().min(1).max(10).optional().describe("Number of recent statuses (default 1)"),
});

export const definition = {
  name: "get_device_status",
  description:
    "Get device status: pump reservoir/battery, sensor info, loop status, active IOB (insulin on board), COB (carbs on board), and predictions. Shows the current state of the diabetes management system.",
  inputSchema: {
    type: "object" as const,
    properties: {
      count: { type: "number", description: "Number of recent statuses (default 1)" },
    },
  },
};

export async function execute(
  client: NightscoutClient,
  config: NightscoutConfig,
  params: z.infer<typeof schema>
) {
  const s = getStrings(config.locale);
  const count = params.count || 1;
  const statuses = await client.getDeviceStatus(count);

  if (!statuses || statuses.length === 0) {
    return { error: s.noDeviceStatus };
  }

  const na = s.notAvailable;

  return statuses.map((ds) => {
    const result: Record<string, unknown> = {
      device: ds.device,
      timestamp: ds.created_at,
    };

    if (ds.pump) {
      result.pump = {
        battery: ds.pump.battery?.percent
          ? `${ds.pump.battery.percent}%`
          : ds.pump.battery?.voltage
          ? `${ds.pump.battery.voltage}V`
          : na,
        reservoir: ds.pump.reservoir ? `${ds.pump.reservoir} U` : na,
        status: ds.pump.status?.status || na,
      };
    }

    if (ds.openaps) {
      result.openaps = {
        iob: ds.openaps.iob ? `${ds.openaps.iob.iob} U` : na,
        cob: ds.openaps.suggested?.COB ? `${ds.openaps.suggested.COB} g` : na,
        eventualBG: ds.openaps.suggested?.eventualBG
          ? client.convertGlucose(ds.openaps.suggested.eventualBG)
          : na,
        temp: ds.openaps.suggested?.temp || na,
      };
    }

    if (ds.loop) {
      result.loop = {
        iob: ds.loop.iob ? `${ds.loop.iob.iob} U` : na,
        cob: ds.loop.cob ? `${ds.loop.cob.cob} g` : na,
        predicted: ds.loop.predicted?.values
          ? ds.loop.predicted.values
              .slice(0, 6)
              .map((v) => client.convertGlucose(v))
          : na,
      };
    }

    if (ds.uploaderBattery !== undefined) {
      result.uploaderBattery = `${ds.uploaderBattery}%`;
    }

    return result;
  });
}
