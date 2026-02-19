import { NextResponse } from "next/server";

import { listSites, saveVerificationResult, upsertSite } from "@/lib/storage";
import { verifyWebMcpSite } from "@/lib/verify";

function normalizeName(name: string, url: string): string {
  const trimmed = name.trim();
  if (trimmed) {
    return trimmed;
  }

  return new URL(url).hostname;
}

export async function GET() {
  const sites = await listSites();
  return NextResponse.json({ sites });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      url?: string;
      description?: string;
      verifyNow?: boolean;
    };

    if (!body.url || typeof body.url !== "string") {
      return NextResponse.json({ error: "Missing url." }, { status: 400 });
    }

    const parsedUrl = new URL(body.url);

    const upsertInput = {
      name: normalizeName(body.name ?? "", parsedUrl.toString()),
      url: parsedUrl.toString(),
      ...(typeof body.description === "string" ? { description: body.description } : {})
    };

    const site = await upsertSite(upsertInput);

    if (!body.verifyNow) {
      return NextResponse.json({ site });
    }

    const report = await verifyWebMcpSite(site.url);
    const updated = await saveVerificationResult(site.url, report);

    return NextResponse.json({ site: updated, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit site.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
