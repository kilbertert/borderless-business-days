import type { MetadataRoute } from "next";
import { comparisonPairs } from "@/lib/pairs";

const baseUrl = "https://kilbertert.github.io/borderless-business-days";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${baseUrl}/`, changeFrequency: "weekly", priority: 1 },
    ...Object.keys(comparisonPairs).map((pair) => ({
      url: `${baseUrl}/compare/${pair}/`,
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
  ];
}
