// Nightscout API Client
// Handles all HTTP communication with Nightscout REST API v1
// Includes in-memory cache with configurable TTL

import { NightscoutConfig } from "./config.js";
import crypto from "crypto";

// === Cache ===
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class ApiCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private defaultTtl: number;

  constructor(defaultTtlMs: number = 30_000) {
    this.defaultTtl = defaultTtlMs;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs ?? this.defaultTtl,
    });
  }

  invalidate(prefix?: string): void {
    if (!prefix) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  get size(): number {
    return this.store.size;
  }
}

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

// Cache TTL constants
const CACHE_TTL = {
  CURRENT: 15_000,      // 15s — current glucose changes often
  ENTRIES: 60_000,      // 60s — historical entries
  TREATMENTS: 60_000,   // 60s — treatments
  PROFILE: 300_000,     // 5min — profile rarely changes
  STATUS: 300_000,      // 5min — server status
  DEVICE: 30_000,       // 30s — device status
};

export class NightscoutClient {
  private config: NightscoutConfig;
  private cache: ApiCache;

  constructor(config: NightscoutConfig) {
    this.config = config;
    this.cache = new ApiCache();
  }

  /** Invalidate cache after writes */
  invalidateCache(): void {
    this.cache.invalidate();
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

  // ===== DATA METHODS (with caching) =====

  // Get latest SGV entries
  async getEntries(
    count: number = 1,
    dateFrom?: string,
    dateTo?: string
  ): Promise<SGVEntry[]> {
    const cacheKey = `entries:${count}:${dateFrom || ""}:${dateTo || ""}`;
    const cached = this.cache.get<SGVEntry[]>(cacheKey);
    if (cached) return cached;

    const params: Record<string, string | number> = { count };

    if (dateFrom || dateTo) {
      let findQuery: Record<string, Record<string, number>> = {};
      const dateField: Record<string, number> = {};
      if (dateFrom) dateField["$gte"] = new Date(dateFrom).getTime();
      if (dateTo) dateField["$lte"] = new Date(dateTo).getTime();
      findQuery["date"] = dateField;
      params["find"] = JSON.stringify(findQuery);
      if (count === 1) params.count = 288;
    }

    const result = await this.request<SGVEntry[]>("/api/v1/entries/sgv.json", params);
    const ttl = count <= 2 ? CACHE_TTL.CURRENT : CACHE_TTL.ENTRIES;
    this.cache.set(cacheKey, result, ttl);
    return result;
  }

  // Get treatments
  async getTreatments(
    count: number = 50,
    dateFrom?: string,
    dateTo?: string,
    eventType?: string
  ): Promise<Treatment[]> {
    const cacheKey = `treatments:${count}:${dateFrom || ""}:${dateTo || ""}:${eventType || ""}`;
    const cached = this.cache.get<Treatment[]>(cacheKey);
    if (cached) return cached;

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

    const result = await this.request<Treatment[]>("/api/v1/treatments.json", params);
    this.cache.set(cacheKey, result, CACHE_TTL.TREATMENTS);
    return result;
  }

  // Get active profile
  async getProfile(): Promise<Profile[]> {
    const cached = this.cache.get<Profile[]>("profile");
    if (cached) return cached;
    const result = await this.request<Profile[]>("/api/v1/profile.json");
    this.cache.set("profile", result, CACHE_TTL.PROFILE);
    return result;
  }

  // Get device status (latest)
  async getDeviceStatus(count: number = 1): Promise<DeviceStatus[]> {
    const cacheKey = `devicestatus:${count}`;
    const cached = this.cache.get<DeviceStatus[]>(cacheKey);
    if (cached) return cached;
    const result = await this.request<DeviceStatus[]>("/api/v1/devicestatus.json", { count });
    this.cache.set(cacheKey, result, CACHE_TTL.DEVICE);
    return result;
  }

  // Get server status
  async getStatus(): Promise<Record<string, unknown>> {
    const cached = this.cache.get<Record<string, unknown>>("status");
    if (cached) return cached;
    const result = await this.request<Record<string, unknown>>("/api/v1/status.json");
    this.cache.set("status", result, CACHE_TTL.STATUS);
    return result;
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

    // Invalidate treatments cache after write
    this.cache.invalidate("treatments");

    return response.json();
  }
}
