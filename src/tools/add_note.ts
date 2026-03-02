// Tool: add_note
// Quick shortcut to add a timestamped note to Nightscout

import { z } from "zod";
import { NightscoutClient } from "../client.js";
import { NightscoutConfig } from "../config.js";
import { getStrings } from "../i18n/index.js";

export const schema = z.object({
  text: z.string().describe("Note text"),
  created_at: z.string().optional().describe("Timestamp (ISO 8601). Defaults to now."),
});

export const definition = {
  name: "add_note",
  description:
    "Quickly add a timestamped note to Nightscout. Useful for logging meals, activities, symptoms, or any context. Requires NIGHTSCOUT_READONLY=false.",
  inputSchema: {
    type: "object" as const,
    properties: {
      text: { type: "string", description: "Note text" },
      created_at: { type: "string", description: "Timestamp (ISO 8601). Defaults to now." },
    },
    required: ["text"],
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

  const treatment = {
    eventType: "Note",
    notes: params.text,
    created_at: params.created_at || new Date().toISOString(),
    enteredBy: "nightscout-mcp",
  };

  const result = await client.addTreatment(treatment);

  return {
    success: true,
    note: params.text,
    timestamp: treatment.created_at,
    response: result,
  };
}
