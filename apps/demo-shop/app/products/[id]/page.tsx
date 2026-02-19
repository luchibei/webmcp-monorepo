import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductDetailActions } from "@/components/product-detail-actions";
import { formatCurrency } from "@/lib/shop-domain";
import { MOCK_PRODUCTS } from "@/lib/products";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = MOCK_PRODUCTS.find((item) => item.id === id);

  if (!product) {
    notFound();
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section>
        <h1 className="page-title">{product.name}</h1>
        <p className="page-subtitle">{product.description}</p>
      </section>

      <section className="section-card" data-testid="product-detail-card">
        <p className="product-emoji" style={{ fontSize: "2.6rem" }}>
          {product.image}
        </p>
        <p className="muted">Category: {product.category}</p>
        <p className="muted">In stock: {product.stock}</p>
        <p className="muted">Rating: {product.rating}</p>
        <p className="price" style={{ marginTop: 2 }}>
          {formatCurrency(product.price)}
        </p>

        <ProductDetailActions productId={product.id} />
      </section>

      <div className="button-row">
        <Link className="button button-secondary" href="/">
          Back to Products
        </Link>
        <Link className="button button-primary" href="/cart">
          View Cart
        </Link>
      </div>
    </div>
  );
}
