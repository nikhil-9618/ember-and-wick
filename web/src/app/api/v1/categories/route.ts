import { apiRoute, json } from "@/lib/http";
import { listCategories } from "@/lib/services/catalog";

export const GET = apiRoute(async () => {
  return json({ categories: await listCategories() }, { cache: "public" });
});
