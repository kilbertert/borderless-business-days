export const comparisonPairs = {
  "us-uk": { left: "US", right: "GB", title: "United States and United Kingdom" },
  "us-cn": { left: "US", right: "CN", title: "United States and China" },
  "us-in": { left: "US", right: "IN", title: "United States and India" },
  "gb-de": { left: "GB", right: "DE", title: "United Kingdom and Germany" },
  "au-nz": { left: "AU", right: "NZ", title: "Australia and New Zealand" },
} as const;

export type ComparisonPair = keyof typeof comparisonPairs;
