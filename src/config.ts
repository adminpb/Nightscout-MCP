// Nightscout MCP — Configuration
// Reads from environment variables

export interface NightscoutConfig {
  url: string;
  apiSecret?: string;
  token?: string;
  units: "mmol/L" | "mg/dL";
  readOnly: boolean;
  locale: string;
}

export function loadConfig(): NightscoutConfig {
  const url = process.env.NIGHTSCOUT_URL;
  if (!url) {
    throw new Error(
      "NIGHTSCOUT_URL is required. Set it as an environment variable."
    );
  }

  const apiSecret = process.env.NIGHTSCOUT_API_SECRET;
  const token = process.env.NIGHTSCOUT_TOKEN;

  if (!apiSecret && !token) {
    throw new Error(
      "Either NIGHTSCOUT_API_SECRET or NIGHTSCOUT_TOKEN must be set."
    );
  }

  return {
    url: url.replace(/\/+$/, ""), // trim trailing slashes
    apiSecret,
    token,
    units: (process.env.NIGHTSCOUT_UNITS as "mmol/L" | "mg/dL") || "mmol/L",
    readOnly: process.env.NIGHTSCOUT_READONLY !== "false", // default true
    locale: process.env.NIGHTSCOUT_LOCALE || "en",
  };
}
