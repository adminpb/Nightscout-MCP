#!/usr/bin/env node

// Nightscout MCP Server
// Model Context Protocol server for Nightscout CGM data

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { NightscoutClient } from "./client.js";
import { z } from "zod";

// Import tools
import * as getCurrentGlucose from "./tools/get_current_glucose.js";
import * as getGlucoseHistory from "./tools/get_glucose_history.js";
import * as getStatistics from "./tools/get_statistics.js";
import * as getTreatments from "./tools/get_treatments.js";
import * as getProfile from "./tools/get_profile.js";
import * as getDeviceStatus from "./tools/get_device_status.js";
import * as getDailyReport from "./tools/get_daily_report.js";
import * as detectPatterns from "./tools/detect_patterns.js";
import * as addTreatment from "./tools/add_treatment.js";
import * as addNote from "./tools/add_note.js";
import * as comparePeriods from "./tools/compare_periods.js";
import * as findEvents from "./tools/find_events.js";
import * as glucoseAtTime from "./tools/glucose_at_time.js";
import * as analyzeMeal from "./tools/analyze_meal.js";
import * as overnightAnalysis from "./tools/overnight_analysis.js";
import * as exportCsv from "./tools/export_csv.js";
import * as a1cEstimator from "./tools/a1c_estimator.js";
import * as weeklyComparison from "./tools/weekly_comparison.js";
import * as insulinSensitivityCheck from "./tools/insulin_sensitivity_check.js";
import * as carbRatioCheck from "./tools/carb_ratio_check.js";
import * as compressionLowAnalysis from "./tools/compression_low_analysis.js";

// Load config and create client
const config = loadConfig();
const client = new NightscoutClient(config);

// Create MCP server
const server = new McpServer({
  name: "nightscout-mcp",
  version: "0.4.0",
  description: "MCP server for Nightscout CGM data — glucose readings, treatments, statistics, and analytics",
});

// Helper: register tool with Zod schema shape instead of JSON
function reg(mod: {
  definition: { name: string; description: string };
  schema: { shape: Record<string, unknown>; parse: (v: unknown) => unknown };
  execute: (client: NightscoutClient, config: ReturnType<typeof loadConfig>, params: any) => Promise<unknown>;
}) {
  server.tool(
    mod.definition.name,
    mod.definition.description,
    mod.schema.shape,
    async (params: Record<string, unknown>) => {
      try {
        const parsed = mod.schema.parse(params);
        const result = await mod.execute(client, config, parsed);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    }
  );
}

// ===== REGISTER ALL 21 TOOLS =====

reg(getCurrentGlucose);
reg(getGlucoseHistory);
reg(getStatistics);
reg(getTreatments);
reg(getProfile);
reg(getDeviceStatus);
reg(getDailyReport);
reg(detectPatterns);
reg(addTreatment);
reg(addNote);
reg(comparePeriods);
reg(findEvents);
reg(glucoseAtTime);
reg(analyzeMeal);
reg(overnightAnalysis);
reg(exportCsv);
reg(a1cEstimator);
reg(weeklyComparison);
reg(insulinSensitivityCheck);
reg(carbRatioCheck);
reg(compressionLowAnalysis);

// ===== REGISTER RESOURCES =====

server.resource(
  "nightscout-status",
  "nightscout://status",
  async (uri) => {
    try {
      const status = await client.getStatus();
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(status, null, 2),
          mimeType: "application/json",
        }],
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `Error fetching status: ${(error as Error).message}`,
          mimeType: "text/plain",
        }],
      };
    }
  }
);

server.resource(
  "nightscout-profile",
  "nightscout://profile/current",
  async (uri) => {
    try {
      const profiles = await client.getProfile();
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(profiles?.[0] || {}, null, 2),
          mimeType: "application/json",
        }],
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `Error fetching profile: ${(error as Error).message}`,
          mimeType: "text/plain",
        }],
      };
    }
  }
);

// ===== REGISTER PROMPTS =====

server.prompt(
  "daily_review",
  "Analyze today's glucose data — trends, time in range, notable events",
  {},
  async () => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: "Analyze my glucose data for today. Use get_daily_report for the current day, then get_current_glucose for the latest reading. Provide an assessment: TIR, key trends, what went well, what could be improved. Be specific with times and values.",
      },
    }],
  })
);

server.prompt(
  "meal_analysis",
  "Analyze how a recent meal affected glucose levels",
  { meal_time: z.string().optional().describe("Approximate time of the meal (e.g., '12:30' or '2 hours ago')") },
  async ({ meal_time }) => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `Analyze how a meal affected my glucose${meal_time ? ` (meal was approximately at ${meal_time})` : " (most recent meal)"}. Check get_glucose_history for 4 hours around the meal and get_treatments to find the bolus/carbs entry. Assess: post-meal peak, time to return to range, whether the bolus was adequate.`,
      },
    }],
  })
);

server.prompt(
  "weekly_summary",
  "Weekly glucose report with trends and recommendations",
  {},
  async () => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: "Generate a weekly glucose report. Use get_statistics with hours=168. Compare against standard targets: TIR >= 70%, time below range < 4%, CV < 36%. Identify trends and provide specific, actionable recommendations.",
      },
    }],
  })
);

server.prompt(
  "optimization_advice",
  "Suggest improvements to diabetes management settings",
  {},
  async () => ({
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: "Review my profile (get_profile), weekly statistics (get_statistics hours=168), and weekly treatments (get_treatments hours=168). Based on patterns, suggest whether basal rates, ISF, or ICR need adjustment. Note recurring lows/highs. DISCLAIMER: This is data analysis only, not medical advice — discuss any changes with your healthcare provider.",
      },
    }],
  })
);

// ===== START SERVER =====

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Nightscout MCP server running");
  console.error(`   URL: ${config.url}`);
  console.error(`   Units: ${config.units}`);
  console.error(`   Mode: ${config.readOnly ? "read-only" : "read-write"}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
