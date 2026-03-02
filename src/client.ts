// Nightscout API Client
// Handles all HTTP communication with Nightscout REST API v1

import { NightscoutConfig } from "./config.js";
import crypto from "crypto";

export interface SGVEntry {
  _id: string;
  sgv: number; // mg/dL raw value
  date: number; // epoch ms
  dateString: string;
  trend: number;
  direction: string;
  device: string;
  type: string;
}

export interface Treatment {
  _id: string;
  eventType: string;
  created_at: string;
  glucose?: number;
  glucoseType?: string;
  carbs?: number;
  insulin?: number;
  duration?: number;
  notes?: string;
  enteredBy?: string;
}

export interface Profile {
  _id: string;
  defaultProfile: string;
  store: Record<
    string,
    {
      dia: number;
      carbratio: Array<{ time: string; value: number; timeAsSeconds: number }>;
      sens: Array<{ time: string; value: number; timeAsSeconds: number }>;
      basal: Array<{ time: string; value: number; timeAsSeconds: number }>;
      target_low: Array<{ time: string; value: number; timeAsSeconds: number }>;
      target_high: Array<{
        time: string;
        value: number;
        timeAsSeconds: number;
      }>;
      timezone: string;
      units: string;
    }
  >;
}

export interface DeviceStatus {
  _id: string;
  created_at: string;
  device: string;
  pump?: {
    battery?: { percent?: number; voltage?: number };
    reservoir?: number;
    status?: { status: string; timestamp: string };
    iob?: { iob: number; timestamp: string };
  };
  openaps?: {
    iob?: { iob: number; activity: number; timestamp: string };
    suggested?: {
      bg: number;
      temp: string;
      eventualBG: number;
      COB: number;
      IOB: number;
    };
    enacted?: Record<string, unknown>;
  };
  loop?: {
    iob?: { iob: number; timestamp: string };
    cob?: { cob: number; timestamp: string };
    predicted?: { values: number[] };
  };
  uploaderBattery?: number;
}

// Direction arrow mapping
const DIRECTION_ARROWS: Record<string, string> = {
  DoubleUp: "⇈",
  SingleUp: "↑",
  FortyFiveUp: "↗",
  Flat: "→",
  FortyFiveDown: "↘",
  SingleDown: "↓",
  DoubleDown: "⇊",
  "NOT COMPUTABLE": "?",
  "RATE OUT OF RANGE": "⚠",
};

export class NightscoutClient {
  private config: NightscoutConfig;

  constructor(config: NightscoutConfig) {
    this.config = config;
  }

  // Convert mg/dL to mmol/L
  toMmol(mgdl: number): number {
    return Math.round((mgdl / 18.0) * 10) / 10;
  }

  // Convert value based on configured units
  convertGlucose(mgdl: number): number {
    return this.config.units === "mmol/L" ? this.toMmol(mgdl) : mgdl;
  }

  // Get direction arrow
  getArrow(direction: string): string {
    return DIRECTION_ARROWS[direction] || direction;
  }

  // Build auth headers / query params
  private getAuthParams(): Record<string, string> {
    if (this.config.token) {
      return { token: this.config.token };
    }
    if (this.config.apiSecret) {
      // Nightscout expects SHA1 hash of the API secret
      const hash = crypto
        .createHash("sha1")
        .update(this.config.apiSecret)
        .digest("hex");
      return { "api-secret": hash };
    }
    return {};
  }

  // Generic API request
  private async request<T>(
    endpoint: string,
    params: Record<string, string | number> = {}
  ): Promise<T> {
    const authParams = this.getAuthParams();
    const allParams = { ...params };

    const url = new URL(`${this.config.url}${endpoint}`);

    // Token goes in query params
    if (authParams.token) {
      url.searchParams.set("token", authParams.token);
    }

    for (const [key, value] of Object.entries(allParams)) {
      url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    // api-secret goes in headers
    if (authParams["api-secret"]) {
      headers["api-secret"] = authParams["api-secret"];
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      throw new Error(
        `Nightscout API error: ${response.status} ${response.statusText} for ${endpoint}`
      );
    }

    return response.json() as Promise<T>;
  }

  // ===== DATA METHODS =====

  // Get latest SGV entries
  async getEntries(
    count: number = 1,
    dateFrom?: string,
    dateTo?: string
  ): Promise<SGVEntry[]> {
    const params: Record<string, string | number> = { count };

    if (dateFrom || dateTo) {
      let findQuery: Record<string, Record<string, number>> = {};
      const dateField: Record<string, number> = {};
      if (dateFrom) dateField["$gte"] = new Date(dateFrom).getTime();
      if (dateTo) dateField["$lte"] = new Date(dateTo).getTime();
      findQuery["date"] = dateField;
      params["find"] = JSON.stringify(findQuery);
      // When filtering by date, get more entries
      if (count === 1) params.count = 288; // ~24h at 5min intervals
    }

    return this.request<SGVEntry[]>("/api/v1/entries/sgv.json", params);
  }

  // Get treatments
  async getTreatments(
    count: number = 50,
    dateFrom?: string,
    dateTo?: string,
    eventType?: string
  ): Promise<Treatment[]> {
    const params: Record<string, string | number> = { count };

    if (dateFrom || dateTo || eventType) {
      let findQuery: Record<string, unknown> = {};
      if (dateFrom || dateTo) {
        const dateField: Record<string, string> = {};
        if (dateFrom) dateField["$gte"] = dateFrom;
        if (dateTo) dateField["$lte"] = dateTo;
        findQuery["created_at"] = dateField;
      }
      if (eventType) findQuery["eventType"] = eventType;
      params["find"] = JSON.stringify(findQuery);
    }

    return this.request<Treatment[]>("/api/v1/treatments.json", params);
  }

  // Get active profile
  async getProfile(): Promise<Profile[]> {
    return this.request<Profile[]>("/api/v1/profile.json");
  }

  // Get device status (latest)
  async getDeviceStatus(count: number = 1): Promise<DeviceStatus[]> {
    return this.request<DeviceStatus[]>("/api/v1/devicestatus.json", { count });
  }

  // Get server status
  async getStatus(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/api/v1/status.json");
  }

  // ===== WRITE METHODS =====

  async addTreatment(treatment: Partial<Treatment>): Promise<unknown> {
    if (this.config.readOnly) {
      throw new Error(
        "Write operations are disabled. Set NIGHTSCOUT_READONLY=false to enable."
      );
    }

    const authParams = this.getAuthParams();
    const url = new URL(`${this.config.url}/api/v1/treatments.json`);
    if (authParams.token) {
      url.searchParams.set("token", authParams.token);
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (authParams["api-secret"]) {
      headers["api-secret"] = authParams["api-secret"];
    }

    const response = await fetch(url.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify(treatment),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to add treatment: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }
}
