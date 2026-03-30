/**
 * Cookie Consent Banner
 *
 * GDPR-compliant cookie consent banner that blocks non-essential tracking
 * until user gives explicit consent.
 */

import { logger } from "@/lib/logger";
import { Eye, Lock, Settings, Shield, X } from "lucide-react";
import { useEffect, useState } from "react";

interface ConsentPreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

interface CookieConsentBannerProps {
  onPreferencesChange?: (preferences: ConsentPreferences) => void;
  className?: string;
}

export function CookieConsentBanner({
  onPreferencesChange,
  className = "",
}: CookieConsentBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    necessary: true, // Always required
    analytics: false,
    marketing: false,
    functional: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Check if user has already given consent
  useEffect(() => {
    const savedConsent = localStorage.getItem("cookie-consent");
    if (!savedConsent) {
      setIsVisible(true);
    } else {
      try {
        const parsed = JSON.parse(savedConsent);
        setPreferences(parsed);
        applyConsent(parsed);
      } catch (error) {
        logger.logUnknownError("Failed to parse saved consent:", error);
        setIsVisible(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply consent preferences
  const applyConsent = async (prefs: ConsentPreferences) => {
    // Save to localStorage
    localStorage.setItem("cookie-consent", JSON.stringify(prefs));

    // Apply to tracking scripts
    if (prefs.analytics) {
      // Enable Google Analytics, etc.
      window.gtag?.("consent", "update", {
        analytics_storage: "granted",
      });
    } else {
      // Disable analytics
      window.gtag?.("consent", "update", {
        analytics_storage: "denied",
      });
    }

    if (prefs.marketing) {
      // Enable marketing cookies
      window.gtag?.("consent", "update", {
        ad_storage: "granted",
      });
    } else {
      // Disable marketing
      window.gtag?.("consent", "update", {
        ad_storage: "denied",
      });
    }

    // Notify parent component
    onPreferencesChange?.(prefs);
  };

  // Handle accept all
  const handleAcceptAll = async () => {
    setIsLoading(true);
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true,
    };

    try {
      await saveConsentToServer(allAccepted);
      setPreferences(allAccepted);
      await applyConsent(allAccepted);
      setIsVisible(false);
    } catch (error) {
      logger.logUnknownError("Failed to save consent:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle accept necessary only
  const handleAcceptNecessary = async () => {
    setIsLoading(true);
    const necessaryOnly = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false,
    };

    try {
      await saveConsentToServer(necessaryOnly);
      setPreferences(necessaryOnly);
      await applyConsent(necessaryOnly);
      setIsVisible(false);
    } catch (error) {
      logger.logUnknownError("Failed to save consent:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle custom preferences
  const handleSavePreferences = async () => {
    setIsLoading(true);

    try {
      await saveConsentToServer(preferences);
      await applyConsent(preferences);
      setIsVisible(false);
      setShowSettings(false);
    } catch (error) {
      logger.logUnknownError("Failed to save consent:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Save consent to server
  const saveConsentToServer = async (prefs: ConsentPreferences) => {
    const response = await fetch("/api/v1/legal/consent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(prefs),
    });

    if (!response.ok) {
      throw new Error("Failed to save consent preferences");
    }

    return response.json();
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Overlay for settings modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            {/* Settings Header */}
            <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Cookie Preferences
                </h2>
                <p className="text-gray-600 mt-1">
                  Manage your cookie preferences and privacy settings
                </p>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Settings Content */}
            <div className="p-6 space-y-6">
              {/* Necessary Cookies */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-4 h-4 text-gray-600" />
                    <h3 className="font-medium">Essential Cookies</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    These cookies are required for the website to function and
                    cannot be disabled. They include session management,
                    security, and basic functionality.
                  </p>
                </div>
                <div className="ml-4">
                  <input
                    type="checkbox"
                    checked={preferences.necessary}
                    disabled
                    className="w-4 h-4 text-blue-600 rounded disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Analytics Cookies */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4 text-gray-600" />
                    <h3 className="font-medium">Analytics Cookies</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    These cookies help us understand how visitors interact with
                    our website by collecting and reporting information
                    anonymously.
                  </p>
                </div>
                <div className="ml-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.analytics}
                      onChange={(e) =>
                        setPreferences((prev) => ({
                          ...prev,
                          analytics: e.target.checked,
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              {/* Marketing Cookies */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-gray-600" />
                    <h3 className="font-medium">Marketing Cookies</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    These cookies are used to deliver advertisements that are
                    relevant to you and your interests.
                  </p>
                </div>
                <div className="ml-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.marketing}
                      onChange={(e) =>
                        setPreferences((prev) => ({
                          ...prev,
                          marketing: e.target.checked,
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              {/* Functional Cookies */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings className="w-4 h-4 text-gray-600" />
                    <h3 className="font-medium">Functional Cookies</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    These cookies enable enhanced functionality and
                    personalization, such as videos and live chats.
                  </p>
                </div>
                <div className="ml-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.functional}
                      onChange={(e) =>
                        setPreferences((prev) => ({
                          ...prev,
                          functional: e.target.checked,
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Settings Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t p-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleSavePreferences}
                disabled={isLoading}
                className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? "Saving..." : "Save Preferences"}
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Banner */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40 ${className}`}
      >
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Message */}
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">
                Privacy & Cookies
              </h3>
              <p className="text-sm text-gray-600">
                We use cookies to enhance your experience, analyze site traffic,
                and personalize content. By continuing to use this site, you
                agree to our use of cookies.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 sm:ml-4">
              <button
                onClick={handleAcceptAll}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {isLoading ? "Accepting..." : "Accept All"}
              </button>
              <button
                onClick={handleAcceptNecessary}
                disabled={isLoading}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {isLoading ? "Saving..." : "Necessary Only"}
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm font-medium flex items-center gap-1"
              >
                <Settings className="w-4 h-4" />
                Customize
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setIsVisible(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
