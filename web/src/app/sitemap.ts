import type { MetadataRoute } from "next";
import { listProducts } from "@/lib/services/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://emberandwick.in";
  const staticPages = ["", "/shop", "/about", "/contact", "/faq", "/privacy", "/terms", "/refund-policy"].map(
    (path) => ({
      url: `${base}${path}`,
      lastModified: new Date(),
      changeFrequency: path === "" || path === "/shop" ? ("daily" as const) : ("monthly" as const),
      priority: path === "" ? 1 : 0.7,
    }),
  );

  try {
    const products = await listProducts({ sort: "newest", page: 1, perPage: 48 });
    return [
      ...staticPages,
      ...products.items.map((product) => ({
        url: `${base}/products/${product.slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    return staticPages;
  }
}
