import type { MetadataRoute } from "next";

const baseUrl = "https://app.sportvisualsystems.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy", "/terms", "/children-and-images"],
      disallow: [
        "/api/",
        "/auth/",
        "/club-invite/",
        "/dashboard/",
        "/join/",
        "/legal-consent/",
        "/person-invite/",
        "/share/",
        "/tag/",
        "/tv/",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
