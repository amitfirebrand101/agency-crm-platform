import { Package, Trash2 } from "lucide-react";
import { deleteProduct } from "./actions";
import { CreateProductForm } from "./create-product-form";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Product } from "@prisma/client";

export const dynamic = "force-dynamic";

function formatPrice(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2)}`;
}

function typeVariant(type: string) {
  if (type === "physical") return "info" as const;
  if (type === "digital") return "warning" as const;
  return "muted" as const; // service
}

export default async function ProductsPage() {
  const user = await requireUser();
  let products: Product[] = [];
  let databaseUnavailable = false;

  try {
    products = await prisma.product.findMany({
      where: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId ?? undefined,
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    databaseUnavailable = true;
    console.error("Products page database query failed", err);
  }

  const totalCount = products.length;
  const activeCount = products.filter((p) => p.status === "active").length;
  const archivedCount = products.filter((p) => p.status === "archived").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Products</h1>
        <p className="mt-1 text-sm text-muted">Your catalog of products and services.</p>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total</p>
          <p className="mt-1 text-2xl font-bold">{totalCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Active</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Archived</p>
          <p className="mt-1 text-2xl font-bold text-muted">{archivedCount}</p>
        </div>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* Product list */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="text-primary" size={18} />
              <h2 className="font-semibold">Product Catalog</h2>
              <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                {totalCount}
              </span>
            </div>
          </CardHeader>

          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-background">
                <Package className="text-muted" size={28} />
              </div>
              <p className="text-base font-semibold">No products yet</p>
              <p className="mt-1 text-sm text-muted">
                Add your first product using the form on the right.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-background/50 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium truncate">{product.name}</span>
                      <Badge variant={typeVariant(product.type)}>{product.type}</Badge>
                      <Badge variant={statusVariant(product.status)}>{product.status}</Badge>
                      {product.taxable && (
                        <span className="text-xs text-muted font-medium">taxable</span>
                      )}
                    </div>
                    <div className="mt-0.5">
                      <span className="text-sm font-semibold text-foreground">
                        {formatPrice(product.priceCents)}
                      </span>
                    </div>
                    {product.description ? (
                      <p className="mt-1 text-xs text-muted line-clamp-2">
                        {product.description}
                      </p>
                    ) : null}
                  </div>

                  <form action={deleteProduct} className="shrink-0">
                    <input type="hidden" name="id" value={product.id} />
                    <SubmitButton
                      className="flex items-center justify-center rounded-md border border-border p-2 text-muted hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition"
                      pendingText=""
                      title="Delete product"
                    >
                      <Trash2 size={14} />
                    </SubmitButton>
                  </form>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Add Product sidebar */}
        <div>
          <CreateProductForm />
        </div>
      </section>
    </div>
  );
}
