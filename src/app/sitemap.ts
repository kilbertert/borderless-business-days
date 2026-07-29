import type { MetadataRoute } from "next";
import { comparisonPairs } from "@/lib/pairs";

const baseUrl = "https://kilbertert.github.io/borderless-business-days";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${baseUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/pilot/`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/terms/`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/privacy/`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/refund/`, changeFrequency: "yearly", priority: 0.3 },
    ...Object.keys(comparisonPairs).map((pair) => ({
      url: `${baseUrl}/compare/${pair}/`,
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
  ];
}
