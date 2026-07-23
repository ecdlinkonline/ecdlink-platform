"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CheckCircle2, Minus, Plus, ReceiptText, Send } from "lucide-react";
import {
  Alert,
  CartSummary,
  DeliveryTracker,
  InvoiceLayout,
  PageHeader,
  ProductCard,
  StatusBadge,
  useToast
} from "@/components/design-system";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { calculateCart, deliveryStages, formatCurrency, getProductFromList, monthlyBudgetOptions, procurementNotifications } from "@/lib/procurement/catalog";
import type { CartItem, ProcurementCategory, ProcurementProduct } from "@/lib/procurement/types";

function updateCart(items: CartItem[], productId: string, delta: number) {
  const exists = items.some((item) => item.productId === productId);
  if (!exists && delta > 0) return [...items, { productId, quantity: 1 }];
  return items
    .map((item) => item.productId === productId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item)
    .filter((item) => item.quantity > 0);
}

export function CentreProcurementModule({ products: procurementProducts, categories: procurementCategories }: { products: ProcurementProduct[]; categories: ProcurementCategory[] }) {
  const [budget, setBudget] = useState(5000);
  const [customBudget, setCustomBudget] = useState("");
  const [category, setCategory] = useState<ProcurementCategory | "All">("All");
  const [cart, setCart] = useState<CartItem[]>(procurementProducts.slice(0, 5).map((product, index) => ({ productId: product.id, quantity: [8, 4, 6, 12, 6][index] ?? 1 })));
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { pushToast } = useToast();
  const activeBudget = customBudget ? Number(customBudget) : budget;
  const totals = useMemo(() => calculateCart(cart, procurementProducts), [cart, procurementProducts]);
  const remaining = activeBudget - totals.total;
  const products = useMemo(() => procurementProducts.filter((product) => category === "All" || product.category === category), [category, procurementProducts]);

  return (
    <main className="min-h-screen bg-brand-accent dark:bg-slate-950">
      <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Monthly Procurement"
          title="Build July 2026 centre order"
          description="Choose a monthly budget, browse the ECDLink supplier catalogue, add products to cart, checkout and generate an invoice."
          actions={<Link href="/dashboard/ecd-centre"><Button variant="secondary">Back to centre dashboard</Button></Link>}
        />

        <Alert
          tone="success"
          title="Monthly ordering is open"
          description="Centres can submit July orders until 17 July 2026. ECDLink will consolidate approved orders for suppliers."
        />

        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <Card className="dark:border-slate-800 dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="dark:text-white">1. Select monthly budget</CardTitle>
                <CardDescription className="dark:text-slate-400">Choose a fixed budget or enter a custom amount.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {monthlyBudgetOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        setBudget(option);
                        setCustomBudget("");
                      }}
                      className={`rounded-lg border p-4 text-left ${activeBudget === option && !customBudget ? "border-brand-navy bg-blue-50" : "border-brand-line bg-white dark:border-slate-800 dark:bg-slate-950"}`}
                    >
                      <p className="text-sm font-semibold text-slate-500">Budget</p>
                      <p className="mt-1 font-bold text-brand-ink dark:text-white">{formatCurrency(option)}</p>
                    </button>
                  ))}
                  <label className="rounded-lg border border-brand-line bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                    <span className="text-sm font-semibold text-slate-500">Custom</span>
                    <input
                      value={customBudget}
                      onChange={(event) => setCustomBudget(event.target.value)}
                      type="number"
                      placeholder="Amount"
                      className="mt-1 w-full bg-transparent font-bold text-brand-ink outline-none dark:text-white"
                    />
                  </label>
                </div>
                <div className="mt-5 rounded-lg bg-brand-accent p-4 dark:bg-slate-950">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Remaining budget</span>
                    <span className={`font-bold ${remaining < 0 ? "text-red-700" : "text-brand-green"}`}>{formatCurrency(remaining)}</span>
                  </div>
                  <Progress value={(totals.total / activeBudget) * 100} className="mt-3" />
                </div>
              </CardContent>
            </Card>

            <Card className="dark:border-slate-800 dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="dark:text-white">2. Browse products by category</CardTitle>
                <CardDescription className="dark:text-slate-400">Catalogue contains {procurementProducts.length} seeded products.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
                  {(["All", ...procurementCategories] as Array<ProcurementCategory | "All">).map((item) => (
                    <button
                      key={item}
                      onClick={() => setCategory(item)}
                      className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold ${category === item ? "bg-brand-navy text-white" : "bg-white text-slate-600 ring-1 ring-brand-line dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-800"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {products.map((product) => {
                    const quantity = cart.find((item) => item.productId === product.id)?.quantity ?? 0;
                    return (
                      <ProductCard
                        key={product.id}
                        title={product.name}
                        meta={`${product.packSize} | ${product.supplierBrand}`}
                        price={formatCurrency(product.price)}
                        status={product.availability}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold text-slate-500">Estimated total</p>
                            <p className="font-bold text-brand-ink dark:text-white">{formatCurrency(product.price * quantity)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setCart((items) => updateCart(items, product.id, -1))} className="grid h-9 w-9 place-items-center rounded-lg border border-brand-line dark:border-slate-800"><Minus className="h-4 w-4" /></button>
                            <span className="grid h-9 w-10 place-items-center rounded-lg bg-brand-accent text-sm font-bold dark:bg-slate-950">{quantity}</span>
                            <button disabled={product.availability === "Out of Stock"} onClick={() => setCart((items) => updateCart(items, product.id, 1))} className="grid h-9 w-9 place-items-center rounded-lg bg-brand-navy text-white disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                          </div>
                        </div>
                      </ProductCard>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="dark:border-slate-800 dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="dark:text-white">Delivery tracker</CardTitle>
                <CardDescription className="dark:text-slate-400">Delivery states after admin approval and supplier packing.</CardDescription>
              </CardHeader>
              <CardContent>
                <DeliveryTracker stages={deliveryStages.map((stage, index) => ({ label: stage, complete: index < (submitted ? 2 : 1) }))} />
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <Card className="dark:border-slate-800 dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="dark:text-white">3. Shopping cart</CardTitle>
                <CardDescription className="dark:text-slate-400">Product name, pack, supplier, quantity and estimated total.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {cart.map((item) => {
                  const product = getProductFromList(procurementProducts, item.productId);
                  return (
                    <div key={item.productId} className="rounded-lg border border-brand-line p-3 dark:border-slate-800">
                      <div className="flex justify-between gap-3">
                        <div>
                          <p className="font-bold text-brand-ink dark:text-white">{product.name}</p>
                          <p className="text-sm text-slate-500">{product.packSize} | {product.supplierBrand}</p>
                        </div>
                        <StatusBadge status={product.availability} />
                      </div>
                      <div className="mt-3 flex justify-between text-sm">
                        <span>{item.quantity} x {formatCurrency(product.price)}</span>
                        <span className="font-bold text-brand-navy dark:text-blue-200">{formatCurrency(product.price * item.quantity)}</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <CartSummary
              rows={[
                { label: "Subtotal", value: formatCurrency(totals.subtotal) },
                { label: "ECDLink coordination", value: formatCurrency(totals.serviceFee) },
                { label: "Remaining budget", value: formatCurrency(remaining) }
              ]}
              total={formatCurrency(totals.total)}
            />

            <Button
              className="w-full"
              disabled={remaining < 0 || submitting}
              onClick={async () => {
                setSubmitting(true);
                const response = await fetch("/api/procurement/orders", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ budget: activeBudget, items: cart })
                });
                const body = await response.json().catch(() => null);
                setSubmitting(false);
                if (!response.ok) {
                  pushToast({ title: "Order could not be submitted", description: body?.error ?? "Please review the cart and try again." });
                  return;
                }
                setSubmitted(true);
                pushToast({ title: "Order submitted", description: `${body?.data?.orderNumber ?? "Monthly order"} generated.` });
              }}
            >
              {submitting ? "Submitting..." : "Submit monthly order"}
              <Send className="h-4 w-4" />
            </Button>

            <InvoiceLayout invoiceNo="INV-ECD-2026-001" recipient="Little Stars ECD Centre" total={formatCurrency(totals.total)} status={submitted ? "Draft PDF Ready" : "Draft"} />

            <Card className="dark:border-slate-800 dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 dark:text-white"><Bell className="h-5 w-5 text-brand-green" /> Notifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {procurementNotifications.map((item, index) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className={`h-4 w-4 ${index <= (submitted ? 1 : 0) ? "text-brand-green" : "text-slate-300"}`} />
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="dark:border-slate-800 dark:bg-slate-900">
              <CardContent className="p-5">
                <ReceiptText className="h-6 w-6 text-brand-navy dark:text-blue-200" />
                <p className="mt-3 font-bold text-brand-ink dark:text-white">PDF placeholder</p>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">Future PDF generation will attach the order summary and invoice.</p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>
    </main>
  );
}
