import { NextResponse } from "next/server";

import { saveVerificationResult } from "@/lib/storage";
import { verifyWebMcpSite } from "@/lib/verify";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url query parameter." }, { status: 400 });
  }

  try {
    const report = await verifyWebMcpSite(url);
    const site = await saveVerificationResult(url, report);

    return NextResponse.json({
      site,
      report
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
