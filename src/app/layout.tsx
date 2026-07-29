import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://kilbertert.github.io/borderless-business-days/"),
  title: {
    default: "Borderless Business Days | Cross-Border Workday Calculator",
    template: "%s | Borderless Business Days",
  },
  description: "Count shared business days, add working days, and find conflict-free windows across public holiday calendars in 206 markets.",
  keywords: ["business days calculator", "international public holidays", "cross-border deadline calculator", "shared working days"],
  openGraph: {
    title: "Borderless Business Days",
    description: "Plan launches and deadlines across international public holiday calendars.",
    url: "https://kilbertert.github.io/borderless-business-days/",
    siteName: "Borderless Business Days",
    type: "website",
    images: ["https://kilbertert.github.io/borderless-business-days/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Borderless Business Days",
    description: "Cross-border business day calculator for distributed teams.",
    images: ["https://kilbertert.github.io/borderless-business-days/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Borderless Business Days",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              description: "Calculate shared business days across international public holiday calendars.",
            }),
          }}
        />
      </body>
    </html>
  );
}
