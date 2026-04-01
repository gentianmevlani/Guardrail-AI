"use client";

import Script from "next/script";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname,
            send_page_view: true
          });
        `}
      </Script>
    </>
  );
}

// Analytics event tracking functions
export const analytics = {
  // Page view tracking
  pageView: (url: string) => {
    if (typeof window !== "undefined" && window.gtag && GA_MEASUREMENT_ID) {
      window.gtag("config", GA_MEASUREMENT_ID, {
        page_path: url,
      });
    }
  },

  // Custom event tracking
  event: (action: string, params?: Record<string, unknown>) => {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", action, params);
    }
  },

  // Conversion tracking - Signup
  trackSignup: (method: string = "email") => {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "sign_up", {
        method,
        event_category: "engagement",
        event_label: "user_signup",
      });
      // Also track as conversion
      window.gtag("event", "conversion", {
        send_to: `${GA_MEASUREMENT_ID}/signup`,
        event_category: "conversion",
        event_label: "signup_complete",
      });
    }
  },

  // Conversion tracking - Demo Request
  trackDemoRequest: () => {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "generate_lead", {
        event_category: "engagement",
        event_label: "demo_request",
        value: 50, // Estimated lead value
      });
      window.gtag("event", "conversion", {
        send_to: `${GA_MEASUREMENT_ID}/demo_request`,
        event_category: "conversion",
        event_label: "demo_requested",
      });
    }
  },

  // Track pricing page view
  trackPricingView: () => {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "view_item_list", {
        event_category: "engagement",
        event_label: "pricing_viewed",
      });
    }
  },

  // Track plan selection
  trackPlanSelect: (planName: string, planPrice: number) => {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "select_item", {
        event_category: "engagement",
        event_label: planName,
        value: planPrice,
        items: [
          {
            item_name: planName,
            price: planPrice,
          },
        ],
      });
    }
  },

  // Track CTA clicks
  trackCTAClick: (ctaName: string, location: string) => {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "cta_click", {
        event_category: "engagement",
        event_label: ctaName,
        cta_location: location,
      });
    }
  },

  // Track feature interest
  trackFeatureInterest: (featureName: string) => {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "feature_interest", {
        event_category: "engagement",
        event_label: featureName,
      });
    }
  },

  // Track documentation view
  trackDocsView: (docPage: string) => {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "docs_view", {
        event_category: "engagement",
        event_label: docPage,
      });
    }
  },
};

// Type declaration for gtag
declare global {
  interface Window {
    gtag: (
      command: string,
      targetId: string,
      config?: Record<string, unknown>,
    ) => void;
    dataLayer: unknown[];
  }
}
