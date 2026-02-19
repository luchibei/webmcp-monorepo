import Link from "next/link";
import { notFound } from "next/navigation";

import { VerifySiteButton } from "@/components/verify-site-button";
import { getSiteById } from "@/lib/storage";

function statusClass(status: string): string {
  if (status === "verified") {
    return "badge badge-verified";
  }

  if (status === "failed") {
    return "badge badge-failed";
  }

  return "badge badge-pending";
}

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await getSiteById(id);

  if (!site) {
    notFound();
  }

  return (
    <div className="grid">
      <section className="card grid">
        <h1 className="title">{site.name}</h1>
        <p className="muted">{site.url}</p>
        {site.description ? <p className="muted">{site.description}</p> : null}

        <div className="button-row" style={{ alignItems: "center" }}>
          <span className={statusClass(site.status)}>{site.status}</span>
          <span className="muted">Tool count: {site.toolCount}</span>
          <span className="muted">
            Last verified:{" "}
            {site.lastVerifiedAt ? new Date(site.lastVerifiedAt).toLocaleString() : "-"}
          </span>
        </div>

        <VerifySiteButton url={site.url} />

        <Link className="button button-secondary" href="/sites" style={{ width: "fit-content" }}>
          Back to list
        </Link>
      </section>

      <section className="card grid">
        <h2 style={{ margin: 0 }}>Tools</h2>
        {site.verification?.tools?.length ? (
          <div className="tool-list">
            {site.verification.tools.map((tool) => (
              <article key={tool.name} className="tool-item">
                <strong>{tool.name}</strong>
                <p className="muted">{tool.description || "(no description)"}</p>
                <p className="muted">readOnlyHint: {tool.readOnlyHint ? "true" : "false"}</p>
                <p className="muted">risk: {tool.risk ?? "unknown/write"}</p>
                <p className="muted">schemaValid: {tool.schemaValid ? "true" : "false"}</p>
                <p className="muted">schema: {tool.schemaSummary}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No tool details yet. Run verification first.</p>
        )}
      </section>

      {site.verification ? (
        <section className="card grid">
          <h2 style={{ margin: 0 }}>Raw verification report</h2>
          <pre>{JSON.stringify(site.verification, null, 2)}</pre>
        </section>
      ) : null}
    </div>
  );
}
