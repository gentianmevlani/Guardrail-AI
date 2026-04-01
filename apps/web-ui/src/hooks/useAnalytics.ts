"use client";

import { analytics } from "@/components/analytics/GoogleAnalytics";
import { metaPixel } from "@/components/analytics/MetaPixel";
import { storeUTMParams } from "@/lib/utm";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Hook to handle analytics tracking
 * Automatically tracks page views and stores UTM parameters
 */
export function useAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track page views on route change
  useEffect(() => {
    const url = pathname + (searchParams?.toString() ? `?${searchParams}` : "");

    // Track in Google Analytics
    analytics.pageView(url);

    // Track in Meta Pixel
    metaPixel.pageView();

    // Store UTM params on first visit
    storeUTMParams();
  }, [pathname, searchParams]);

  return {
    // Google Analytics tracking
    trackSignup: analytics.trackSignup,
    trackDemoRequest: analytics.trackDemoRequest,
    trackPricingView: analytics.trackPricingView,
    trackPlanSelect: analytics.trackPlanSelect,
    trackCTAClick: analytics.trackCTAClick,
    trackFeatureInterest: analytics.trackFeatureInterest,
    trackDocsView: analytics.trackDocsView,
    trackEvent: analytics.event,

    // Meta Pixel tracking
    metaTrackSignup: metaPixel.trackSignup,
    metaTrackLead: metaPixel.trackLead,
    metaTrackContentView: metaPixel.trackContentView,
    metaTrackCheckout: metaPixel.trackInitiateCheckout,
    metaTrackPurchase: metaPixel.trackPurchase,

    // Combined tracking (fires both GA and Meta)
    trackConversion: {
      signup: (method: string = "email") => {
        analytics.trackSignup(method);
        metaPixel.trackSignup(method);
      },
      demoRequest: () => {
        analytics.trackDemoRequest();
        metaPixel.trackLead("demo");
      },
      planSelect: (planName: string, planPrice: number) => {
        analytics.trackPlanSelect(planName, planPrice);
        metaPixel.trackInitiateCheckout(planName, planPrice);
      },
      purchase: (planName: string, planPrice: number) => {
        analytics.event("purchase", {
          value: planPrice,
          currency: "USD",
          items: [{ item_name: planName, price: planPrice }],
        });
        metaPixel.trackPurchase(planName, planPrice);
      },
    },
  };
}
