/**
 * UTM Parameter Utilities
 * Track marketing campaign effectiveness
 */

export interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

/**
 * Parse UTM parameters from URL
 */
export function parseUTMParams(url?: string): UTMParams {
  if (typeof window === "undefined") return {};

  const searchParams = new URLSearchParams(
    url ? new URL(url).search : window.location.search,
  );

  return {
    utm_source: searchParams.get("utm_source") || undefined,
    utm_medium: searchParams.get("utm_medium") || undefined,
    utm_campaign: searchParams.get("utm_campaign") || undefined,
    utm_term: searchParams.get("utm_term") || undefined,
    utm_content: searchParams.get("utm_content") || undefined,
  };
}

/**
 * Store UTM params in sessionStorage for attribution
 */
export function storeUTMParams(): void {
  if (typeof window === "undefined") return;

  const params = parseUTMParams();
  if (Object.values(params).some((v) => v !== undefined)) {
    sessionStorage.setItem("utm_params", JSON.stringify(params));
    sessionStorage.setItem("utm_landing_page", window.location.pathname);
    sessionStorage.setItem("utm_timestamp", new Date().toISOString());
  }
}

/**
 * Get stored UTM params
 */
export function getStoredUTMParams(): UTMParams & {
  landing_page?: string;
  timestamp?: string;
} {
  if (typeof window === "undefined") return {};

  try {
    const params = sessionStorage.getItem("utm_params");
    const landingPage = sessionStorage.getItem("utm_landing_page");
    const timestamp = sessionStorage.getItem("utm_timestamp");

    return {
      ...(params ? JSON.parse(params) : {}),
      landing_page: landingPage || undefined,
      timestamp: timestamp || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Build URL with UTM parameters
 */
export function buildUTMUrl(baseUrl: string, params: UTMParams): string {
  const url = new URL(baseUrl);

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

/**
 * Pre-built UTM configurations for different campaigns
 */
export const UTM_CAMPAIGNS = {
  // Google Ads
  googleAds: {
    search: (keyword: string) => ({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "mockproof_search",
      utm_term: keyword,
    }),
    display: (placement: string) => ({
      utm_source: "google",
      utm_medium: "display",
      utm_campaign: "mockproof_display",
      utm_content: placement,
    }),
  },

  // Meta/Facebook Ads
  metaAds: {
    feed: (adSet: string) => ({
      utm_source: "facebook",
      utm_medium: "paid_social",
      utm_campaign: "mockproof_fb",
      utm_content: adSet,
    }),
    instagram: (adSet: string) => ({
      utm_source: "instagram",
      utm_medium: "paid_social",
      utm_campaign: "mockproof_ig",
      utm_content: adSet,
    }),
  },

  // Organic Social
  social: {
    twitter: (post: string) => ({
      utm_source: "twitter",
      utm_medium: "social",
      utm_campaign: "organic_social",
      utm_content: post,
    }),
    linkedin: (post: string) => ({
      utm_source: "linkedin",
      utm_medium: "social",
      utm_campaign: "organic_social",
      utm_content: post,
    }),
    discord: () => ({
      utm_source: "discord",
      utm_medium: "community",
      utm_campaign: "discord_community",
    }),
  },

  // Content Marketing
  content: {
    devto: (article: string) => ({
      utm_source: "devto",
      utm_medium: "content",
      utm_campaign: "content_marketing",
      utm_content: article,
    }),
    github: (repo: string) => ({
      utm_source: "github",
      utm_medium: "referral",
      utm_campaign: "github_presence",
      utm_content: repo,
    }),
    docs: (page: string) => ({
      utm_source: "docs",
      utm_medium: "documentation",
      utm_campaign: "docs_cta",
      utm_content: page,
    }),
  },

  // Email
  email: {
    newsletter: (issue: string) => ({
      utm_source: "newsletter",
      utm_medium: "email",
      utm_campaign: "newsletter",
      utm_content: issue,
    }),
    onboarding: (step: string) => ({
      utm_source: "onboarding",
      utm_medium: "email",
      utm_campaign: "onboarding_sequence",
      utm_content: step,
    }),
  },

  // Referral
  referral: {
    partner: (partnerName: string) => ({
      utm_source: partnerName,
      utm_medium: "referral",
      utm_campaign: "partner_referral",
    }),
    affiliate: (affiliateId: string) => ({
      utm_source: "affiliate",
      utm_medium: "referral",
      utm_campaign: "affiliate_program",
      utm_content: affiliateId,
    }),
  },
};

/**
 * Generate tracking URLs for marketing campaigns
 */
export function generateCampaignUrls(
  baseUrl: string = "https://guardrail.dev",
) {
  return {
    // Google Ads URLs
    googleSearch: {
      mockData: buildUTMUrl(
        baseUrl,
        UTM_CAMPAIGNS.googleAds.search("mock+data+production"),
      ),
      ciPassed: buildUTMUrl(
        baseUrl,
        UTM_CAMPAIGNS.googleAds.search("ci+passed+production+failed"),
      ),
      aiCode: buildUTMUrl(
        baseUrl,
        UTM_CAMPAIGNS.googleAds.search("ai+generated+code+verification"),
      ),
    },

    // Social URLs
    twitter: buildUTMUrl(baseUrl, UTM_CAMPAIGNS.social.twitter("launch_post")),
    linkedin: buildUTMUrl(
      baseUrl,
      UTM_CAMPAIGNS.social.linkedin("launch_post"),
    ),
    discord: buildUTMUrl(baseUrl, UTM_CAMPAIGNS.social.discord()),

    // Content URLs
    devto: buildUTMUrl(baseUrl, UTM_CAMPAIGNS.content.devto("intro_article")),
    github: buildUTMUrl(
      baseUrl,
      UTM_CAMPAIGNS.content.github("guardrail-official"),
    ),
  };
}
