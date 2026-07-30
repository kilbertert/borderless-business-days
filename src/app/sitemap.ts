import type { MetadataRoute } from "next";
import { guidePath, guideSlugs } from "@/lib/guides";
import { comparisonPairs } from "@/lib/pairs";

const baseUrl = "https://borderlessbusinessdays.com";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${baseUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/pilot/`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/terms/`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/privacy/`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/refund/`, changeFrequency: "yearly", priority: 0.3 },
    ...guideSlugs.map((slug) => ({
      url: `${baseUrl}${guidePath(slug)}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...Object.keys(comparisonPairs).map((pair) => ({
      url: `${baseUrl}/compare/${pair}/`,
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
  ];
}
