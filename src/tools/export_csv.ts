// Tool: export_csv
// Export glucose data as CSV for external analysis or doctor visits

import { z } from "zod";
import { NightscoutClient } from "../client.js";
import { NightscoutConfig } from "../config.js";
import { getStrings } from "../i18n/index.js";

export const schema = z.object({
  hours: z.number().min(1).max(720).optional().describe("Hours to export (default 24, max 720 = 30 days)"),
  dateFrom: z.string().optional().describe("Start date (ISO 8601)"),
  dateTo: z.string().optional().describe("End date (ISO 8601)"),
  include_treatments: z.boolean().optional().describe("Include treatments in export (default false)"),
});

export const definition = {
  name: "export_csv",
  description:
    "Export glucose data (and optionally treatments) as CSV text. Useful for sharing with healthcare providers, importing into spreadsheets, or further analysis. Returns CSV as text content.",
  inputSchema: {
    type: "object" as const,
    properties: {
      hours: { type: "number", description: "Hours to export (default 24)" },
      dateFrom: { type: "string", description: "Start date (ISO 8601)" },
      dateTo: { type: "string", description: "End date (ISO 8601)" },
      include_treatments: { type: "boolean", description: "Include treatments (default false)" },
    },
  },
};

export async function execute(
  client: NightscoutClient,
  config: NightscoutConfig,
  params: z.infer<typeof schema>
) {
  const s = getStrings(config.locale);
  const hours = params.hours || 24;
  const dateTo = params.dateTo || new Date().toISOString();
  const dateFrom = params.dateFrom || new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const maxCount = Math.min(Math.ceil((hours * 60) / 5), 5000);
  const entries = await client.getEntries(maxCount, dateFrom, dateTo);

  if (!entries || entries.length === 0) {
    return { error: s.noData };
  }

  // Build glucose CSV
  const glucoseHeader = "timestamp,glucose_mgdl,glucose_" + config.units.replace("/", "_") + ",direction,trend_arrow";
  const glucoseRows = entries
    .sort((a, b) => a.date - b.date)
    .map((e) => {
      const ts = new Date(e.date).toISOString();
      return `${ts},${e.sgv},${client.convertGlucose(e.sgv)},${e.direction},${client.getArrow(e.direction)}`;
    });

  let csv = glucoseHeader + "\n" + glucoseRows.join("\n");

  // Optionally include treatments
  let treatmentsCsv: string | null = null;
  if (params.include_treatments) {
    const treatments = await client.getTreatments(500, dateFrom, dateTo);
    if (treatments && treatments.length > 0) {
      const tHeader = "\n\ntimestamp,event_type,insulin_u,carbs_g,duration_min,notes";
      const tRows = treatments
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((t) => {
          return `${t.created_at},${t.eventType || ""},${t.insulin || ""},${t.carbs || ""},${t.duration || ""},"${(t.notes || "").replace(/"/g, '""')}"`;
        });
      treatmentsCsv = tHeader + "\n" + tRows.join("\n");
      csv += treatmentsCsv;
    }
  }

  return {
    csv,
    rows: entries.length,
    period: { from: dateFrom, to: dateTo },
    units: config.units,
    includesTreatments: !!params.include_treatments,
  };
}
