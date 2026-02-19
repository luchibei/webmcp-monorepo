import Link from "next/link";

export default function NotFoundPage() {
  return (
    <section className="section-card" style={{ display: "grid", gap: 10 }}>
      <h1 className="page-title">Product Not Found</h1>
      <p className="muted">The requested product does not exist in this demo catalog.</p>
      <div>
        <Link className="button button-primary" href="/">
          Back to products
        </Link>
      </div>
    </section>
  );
}
