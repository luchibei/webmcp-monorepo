import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { VerifyReport } from "./verify";

export interface RegistrySite {
  id: string;
  name: string;
  url: string;
  description?: string;
  status: "pending" | "verified" | "failed";
  toolCount: number;
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt?: string;
  verification?: VerifyReport;
}

interface RegistryData {
  sites: RegistrySite[];
}

const DATA_FILE = resolve(process.cwd(), "data/sites.json");

function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";

  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }

  return parsed.toString();
}

async function ensureDataFile(): Promise<void> {
  await mkdir(resolve(process.cwd(), "data"), { recursive: true });

  try {
    await readFile(DATA_FILE, "utf-8");
  } catch {
    const initialData: RegistryData = { sites: [] };
    await writeFile(DATA_FILE, JSON.stringify(initialData, null, 2), "utf-8");
  }
}

async function readData(): Promise<RegistryData> {
  await ensureDataFile();
  const raw = await readFile(DATA_FILE, "utf-8");

  try {
    const parsed = JSON.parse(raw) as RegistryData;
    return {
      sites: Array.isArray(parsed.sites) ? parsed.sites : []
    };
  } catch {
    return { sites: [] };
  }
}

async function writeData(data: RegistryData): Promise<void> {
  await ensureDataFile();
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function generateSiteId(): string {
  return `site_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

/**
 * Returns all submitted sites ordered by update time.
 */
export async function listSites(): Promise<RegistrySite[]> {
  const data = await readData();
  return data.sites.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Finds one site by id.
 */
export async function getSiteById(id: string): Promise<RegistrySite | null> {
  const data = await readData();
  return data.sites.find((site) => site.id === id) ?? null;
}

/**
 * Creates a new site entry or updates metadata if URL already exists.
 */
export async function upsertSite(input: {
  name: string;
  url: string;
  description?: string;
}): Promise<RegistrySite> {
  const data = await readData();
  const normalizedUrl = normalizeUrl(input.url);
  const now = new Date().toISOString();

  const existing = data.sites.find((site) => normalizeUrl(site.url) === normalizedUrl);
  if (existing) {
    existing.name = input.name;
    if (input.description !== undefined) {
      existing.description = input.description;
    } else {
      delete existing.description;
    }
    existing.updatedAt = now;

    await writeData(data);
    return existing;
  }

  const next: RegistrySite = {
    id: generateSiteId(),
    name: input.name,
    url: normalizedUrl,
    ...(input.description !== undefined ? { description: input.description } : {}),
    status: "pending",
    toolCount: 0,
    createdAt: now,
    updatedAt: now
  };

  data.sites.push(next);
  await writeData(data);
  return next;
}

/**
 * Saves verification result and updates registry site status.
 */
export async function saveVerificationResult(
  url: string,
  report: VerifyReport
): Promise<RegistrySite> {
  const normalizedUrl = normalizeUrl(url);
  const now = new Date().toISOString();
  const data = await readData();

  let site = data.sites.find((item) => normalizeUrl(item.url) === normalizedUrl);

  if (!site) {
    site = {
      id: generateSiteId(),
      name: new URL(normalizedUrl).hostname,
      url: normalizedUrl,
      status: "pending",
      toolCount: 0,
      createdAt: now,
      updatedAt: now
    };
    data.sites.push(site);
  }

  site.status = report.errors.length > 0 ? "failed" : "verified";
  site.toolCount = report.toolCount;
  site.verification = report;
  site.lastVerifiedAt = report.verifiedAt;
  site.updatedAt = now;

  await writeData(data);
  return site;
}
