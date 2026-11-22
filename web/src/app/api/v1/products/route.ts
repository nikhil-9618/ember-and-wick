import { apiRoute, json } from "@/lib/http";
import { productQuerySchema } from "@/lib/validation";
import { listProducts } from "@/lib/services/catalog";

export const GET = apiRoute(async (request) => {
  const url = new URL(request.url);
  const params = productQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
  const result = await listProducts(params);
  return json(result, { cache: "public" });
});
