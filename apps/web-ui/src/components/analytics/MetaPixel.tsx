"use client";

import Script from "next/script";

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export function MetaPixel() {
  if (!META_PIXEL_ID) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${META_PIXEL_ID}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}

// Meta Pixel event tracking functions
export const metaPixel = {
  // Track page view
  pageView: () => {
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", "PageView");
    }
  },

  // Track signup/registration
  trackSignup: (method: string = "email") => {
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", "CompleteRegistration", {
        content_name: "signup",
        status: "complete",
        method,
      });
    }
  },

  // Track lead (demo request)
  trackLead: (leadType: string = "demo") => {
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", "Lead", {
        content_name: leadType,
        content_category: "demo_request",
        value: 50,
        currency: "USD",
      });
    }
  },

  // Track content view (pricing, features, etc.)
  trackContentView: (contentName: string, contentType: string) => {
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", "ViewContent", {
        content_name: contentName,
        content_type: contentType,
      });
    }
  },

  // Track initiate checkout (plan selection)
  trackInitiateCheckout: (planName: string, planPrice: number) => {
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", "InitiateCheckout", {
        content_name: planName,
        value: planPrice,
        currency: "USD",
        num_items: 1,
      });
    }
  },

  // Track purchase
  trackPurchase: (planName: string, planPrice: number) => {
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", "Purchase", {
        content_name: planName,
        value: planPrice,
        currency: "USD",
        num_items: 1,
      });
    }
  },

  // Track search
  trackSearch: (searchQuery: string) => {
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", "Search", {
        search_string: searchQuery,
      });
    }
  },

  // Custom event
  customEvent: (eventName: string, params?: Record<string, unknown>) => {
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("trackCustom", eventName, params);
    }
  },
};

// Type declaration for fbq
declare global {
  interface Window {
    fbq: (
      command: string,
      eventName: string,
      params?: Record<string, unknown>,
    ) => void;
    _fbq: unknown;
  }
}
