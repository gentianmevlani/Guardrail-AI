import { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://guardrail.dev";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard/",
          "/activity/",
          "/api-key/",
          "/audit/",
          "/billing/",
          "/cli/",
          "/compliance/",
          "/enforcement/",
          "/findings/",
          "/guardrails/",
          "/intelligence/",
          "/mcp/",
          "/policies/",
          "/profile/",
          "/reality-check/",
          "/runs/",
          "/security/",
          "/settings/",
          "/setup/",
          "/ship/",
          "/ship-check/",
          "/showcase/",
          "/account/",
          "/app/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
