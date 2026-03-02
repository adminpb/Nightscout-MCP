// Tool: add_treatment
// Writes a treatment entry to Nightscout (requires NIGHTSCOUT_READONLY=false)

import { z } from "zod";
import { NightscoutClient } from "../client.js";
import { NightscoutConfig } from "../config.js";
import { getStrings } from "../i18n/index.js";

export const schema = z.object({
  eventType: z
    .string()
    .describe("Treatment type: 'Note', 'Meal Bolus', 'Correction Bolus', 'Carb Correction', 'Exercise', 'Temp Basal', 'Site Change', 'Sensor Start'"),
  insulin: z.number().optional().describe("Insulin amount in units"),
  carbs: z.number().optional().describe("Carbs in grams"),
  notes: z.string().optional().describe("Free text note"),
  duration: z.number().optional().describe("Duration in minutes (for exercise, temp basal)"),
  created_at: z.string().optional().describe("Timestamp (ISO 8601). Defaults to now."),
});

export const definition = {
  name: "add_treatment",
  description:
    "Add a treatment entry to Nightscout: insulin bolus, carbs, note, exercise, site change, etc. Requires NIGHTSCOUT_READONLY=false. Returns the created entry for confirmation.",
  inputSchema: {
    type: "object" as const,
    properties: {
      eventType: {
        type: "string",
        description: "Treatment type: 'Note', 'Meal Bolus', 'Correction Bolus', 'Carb Correction', 'Exercise', 'Temp Basal', 'Site Change', 'Sensor Start'",
      },
      insulin: { type: "number", description: "Insulin amount in units" },
      carbs: { type: "number", description: "Carbs in grams" },
      notes: { type: "string", description: "Free text note" },
      duration: { type: "number", description: "Duration in minutes" },
      created_at: { type: "string", description: "Timestamp (ISO 8601). Defaults to now." },
    },
    required: ["eventType"],
  },
};

export async function execute(
  client: NightscoutClient,
  config: NightscoutConfig,
  params: z.infer<typeof schema>
) {
  const s = getStrings(config.locale);

  if (config.readOnly) {
    return { error: s.writeDisabled };
  }

  const treatment: Record<string, unknown> = {
    eventType: params.eventType,
    created_at: params.created_at || new Date().toISOString(),
    enteredBy: "nightscout-mcp",
  };

  if (params.insulin !== undefined) treatment.insulin = params.insulin;
  if (params.carbs !== undefined) treatment.carbs = params.carbs;
  if (params.notes !== undefined) treatment.notes = params.notes;
  if (params.duration !== undefined) treatment.duration = params.duration;

  const result = await client.addTreatment(treatment);

  return {
    success: true,
    created: treatment,
    response: result,
  };
}
