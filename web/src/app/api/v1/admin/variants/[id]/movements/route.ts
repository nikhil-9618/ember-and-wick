import { getDb } from "@/lib/db";
import { apiRoute, json } from "@/lib/http";
import { notFound } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { listVariantMovements } from "@/lib/services/inventory";

export const GET = apiRoute<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  await requireAdmin(request);
  const { id } = await params;
  const db = await getDb();
  const variant = await db.product_variants.findOne({ _id: id });
  if (!variant) throw notFound("Variant not found.");

  const limit = Number.parseInt(new URL(request.url).searchParams.get("limit") ?? "50", 10);
  const movements = await listVariantMovements(id, Number.isFinite(limit) ? limit : 50);
  return json({ variant: { id: (variant as any)._id, stock: (variant as any).stock }, movements });
});