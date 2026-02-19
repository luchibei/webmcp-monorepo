import Link from "next/link";

import { listSites } from "@/lib/storage";

function statusClass(status: string): string {
  if (status === "verified") {
    return "badge badge-verified";
  }

  if (status === "failed") {
    return "badge badge-failed";
  }

  return "badge badge-pending";
}

export default async function SitesPage() {
  const sites = await listSites();

  return (
    <div className="grid">
      <section className="card grid">
        <h1 className="title">Registry sites</h1>
        {sites.length === 0 ? (
          <p className="muted">No sites submitted yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Status</th>
                <th>Tools</th>
                <th>Last verified</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => (
                <tr key={site.id}>
                  <td>
                    <strong>{site.name}</strong>
                    <div className="muted">{site.url}</div>
                  </td>
                  <td>
                    <span className={statusClass(site.status)}>{site.status}</span>
                  </td>
                  <td>{site.toolCount}</td>
                  <td>
                    {site.lastVerifiedAt ? new Date(site.lastVerifiedAt).toLocaleString() : "-"}
                  </td>
                  <td>
                    <Link className="button button-secondary" href={`/sites/${site.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
