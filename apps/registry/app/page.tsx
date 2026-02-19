import Link from "next/link";

import { listSites } from "@/lib/storage";

export default async function HomePage() {
  const sites = await listSites();

  return (
    <div className="grid">
      <section className="card grid">
        <h1 className="title">WebMCP website directory</h1>
        <p className="muted">
          Submit a website, run automated verification with Playwright, and inspect exposed WebMCP
          tools.
        </p>
        <div className="button-row">
          <Link className="button button-primary" href="/submit">
            Submit a site
          </Link>
          <Link className="button button-secondary" href="/sites">
            Browse directory
          </Link>
        </div>
      </section>

      <section className="card grid">
        <h2 style={{ margin: 0 }}>Quick stats</h2>
        <p className="muted">Registered sites: {sites.length}</p>
        <p className="muted">
          Verified sites: {sites.filter((site) => site.status === "verified").length}
        </p>
      </section>
    </div>
  );
}
