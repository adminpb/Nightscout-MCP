#!/usr/bin/env node

// Nightscout MCP Server
// Model Context Protocol server for Nightscout CGM data

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { NightscoutClient } from "./client.js";

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

// Load config and create client
const config = loadConfig();
const client = new NightscoutClient(config);

// Create MCP server
const server = new McpServer({
  name: "nightscout-mcp",
  version: "0.3.0",
  description: "MCP server for Nightscout CGM data — glucose readings, treatments, statistics, and analytics",
});

// ===== REGISTER TOOLS =====

server.tool(
  getCurrentGlucose.definition.name,
  getCurrentGlucose.definition.description,
  getCurrentGlucose.definition.inputSchema.properties,
  async (params) => {
    try {
      const result = await getCurrentGlucose.execute(client, config, params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  getGlucoseHistory.definition.name,
  getGlucoseHistory.definition.description,
  getGlucoseHistory.definition.inputSchema.properties,
  async (params) => {
    try {
      const parsed = getGlucoseHistory.schema.parse(params);
      const result = await getGlucoseHistory.execute(client, config, parsed);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  getStatistics.definition.name,
  getStatistics.definition.description,
  getStatistics.definition.inputSchema.properties,
  async (params) => {
    try {
      const parsed = getStatistics.schema.parse(params);
      const result = await getStatistics.execute(client, config, parsed);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  getTreatments.definition.name,
  getTreatments.definition.description,
  getTreatments.definition.inputSchema.properties,
  async (params) => {
    try {
      const parsed = getTreatments.schema.parse(params);
      const result = await getTreatments.execute(client, config, parsed);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  getProfile.definition.name,
  getProfile.definition.description,
  getProfile.definition.inputSchema.properties,
  async (params) => {
    try {
      const result = await getProfile.execute(client, config, params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  getDeviceStatus.definition.name,
  getDeviceStatus.definition.description,
  getDeviceStatus.definition.inputSchema.properties,
  async (params) => {
    try {
      const parsed = getDeviceStatus.schema.parse(params);
      const result = await getDeviceStatus.execute(client, config, parsed);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  getDailyReport.definition.name,
  getDailyReport.definition.description,
  getDailyReport.definition.inputSchema.properties,
  async (params) => {
    try {
      const parsed = getDailyReport.schema.parse(params);
      const result = await getDailyReport.execute(client, config, parsed);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  detectPatterns.definition.name,
  detectPatterns.definition.description,
  detectPatterns.definition.inputSchema.properties,
  async (params) => {
    try {
      const parsed = detectPatterns.schema.parse(params);
      const result = await detectPatterns.execute(client, config, parsed);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  addTreatment.definition.name,
  addTreatment.definition.description,
  addTreatment.definition.inputSchema.properties,
  async (params) => {
    try {
      const parsed = addTreatment.schema.parse(params);
      const result = await addTreatment.execute(client, config, parsed);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  addNote.definition.name,
  addNote.definition.description,
  addNote.definition.inputSchema.properties,
  async (params) => {
    try {
      const parsed = addNote.schema.parse(params);
      const result = await addNote.execute(client, config, parsed);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// --- High priority: compare, find, glucose_at_time ---

server.tool(
  comparePeriods.definition.name,
  comparePeriods.definition.description,
  comparePeriods.definition.inputSchema.properties,
  async (params) => {
    try {
      const parsed = comparePeriods.schema.parse(params);
      const result = await comparePeriods.execute(client, config, parsed);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  findEvents.definition.name,
  findEvents.definition.description,
  findEvents.definition.inputSchema.properties,
  async (params) => {
    try {
      const parsed = findEvents.schema.parse(params);
      const result = await findEvents.execute(client, config, parsed);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  glucoseAtTime.definition.name,
  glucoseAtTime.definition.description,
  glucoseAtTime.definition.inputSchema.properties,
  async (params) => {
    try {
      const parsed = glucoseAtTime.schema.parse(params);
      const result = await glucoseAtTime.execute(client, config, parsed);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// --- Medium priority: meal analysis, overnight, export ---

server.tool(
  analyzeMeal.definition.name,
  analyzeMeal.definition.description,
  analyzeMeal.definition.inputSchema.properties,
  async (params) => {
    try {
      const parsed = analyzeMeal.schema.parse(params);
      const result = await analyzeMeal.execute(client, config, parsed);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  overnightAnalysis.definition.name,
  overnightAnalysis.definition.description,
  overnightAnalysis.definition.inputSchema.properties,
  async (params) => {
    try {
      const parsed = overnightAnalysis.schema.parse(params);
      const result = await overnightAnalysis.execute(client, config, parsed);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

server.tool(
  exportCsv.definition.name,
  exportCsv.definition.description,
  exportCsv.definition.inputSchema.properties,
  async (params) => {
    try {
      const parsed = exportCsv.schema.parse(params);
      const result = await exportCsv.execute(client, config, parsed);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

// --- Lower priority: a1c estimator ---

server.tool(
  a1cEstimator.definition.name,
  a1cEstimator.definition.description,
  a1cEstimator.definition.inputSchema.properties,
  async (params) => {
    try {
      const parsed = a1cEstimator.schema.parse(params);
      const result = await a1cEstimator.execute(client, config, parsed);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }], isError: true };
    }
  }
);

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
  { meal_time: { description: "Approximate time of the meal (e.g., '12:30' or '2 hours ago')", required: false } },
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
        text: "Generate a weekly glucose report. Use get_statistics with hours=168. Compare against standard targets: TIR ≥ 70%, time below range < 4%, CV < 36%. Identify trends and provide specific, actionable recommendations.",
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
  console.error(`🩸 Nightscout MCP server running`);
  console.error(`   URL: ${config.url}`);
  console.error(`   Units: ${config.units}`);
  console.error(`   Mode: ${config.readOnly ? "read-only" : "read-write"}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
