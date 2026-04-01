"use client";

import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Key,
  Plus,
  RefreshCw,
} from "lucide-react";
import { logger } from "@/lib/logger";
import { useEffect, useState } from "react";

interface Subscription {
  tier: string;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

interface Invoice {
  id: string;
  number: string;
  status: string;
  total: number;
  currency: string;
  paidAt: string;
  hostedInvoiceUrl: string;
  invoicePdf: string;
}

interface LicenseKey {
  id: string;
  key: string;
  tier: string;
  status: string;
  activations: number;
  maxActivations: number;
  createdAt: string;
  lastUsedAt: string;
}

interface UsageSummary {
  tier: string;
  period: { start: string; end: string };
  usage: {
    scan: { count: number; limit: number; percentage: number };
    reality_run: { count: number; limit: number; percentage: number };
    ai_agent_run: { count: number; limit: number; percentage: number };
  };
}

interface BillingSettingsProps {
  apiBaseUrl?: string;
}

export function BillingSettings({ apiBaseUrl = "/api" }: BillingSettingsProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [licenseKeys, setLicenseKeys] = useState<LicenseKey[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLicenseKey, setShowLicenseKey] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);

  useEffect(() => {
    fetchBillingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBillingData = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [subRes, invoiceRes, licenseRes, usageRes] = await Promise.all([
        fetch(`${apiBaseUrl}/billing/subscription`, { headers }),
        fetch(`${apiBaseUrl}/billing/history`, { headers }),
        fetch(`${apiBaseUrl}/licenses`, { headers }),
        fetch(`${apiBaseUrl}/usage/summary`, { headers }),
      ]);

      if (subRes.ok) {
        const data = await subRes.json();
        setSubscription(data.subscription);
      }
      if (invoiceRes.ok) {
        const data = await invoiceRes.json();
        setInvoices(data.invoices || []);
      }
      if (licenseRes.ok) {
        const data = await licenseRes.json();
        setLicenseKeys(data.licenses || []);
      }
      if (usageRes.ok) {
        const data = await usageRes.json();
        setUsage(data);
      }
    } catch (error) {
      logger.logUnknownError("Failed to fetch billing data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiBaseUrl}/billing/portal`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ returnUrl: window.location.href }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      logger.logUnknownError("Failed to open billing portal", error);
    }
  };

  const handleGenerateLicenseKey = async () => {
    setGeneratingKey(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiBaseUrl}/licenses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (data.success) {
        alert(
          `License Key Generated!\n\n${data.licenseKey}\n\nCopy this key now - it won't be shown again.`,
        );
        fetchBillingData();
      }
    } catch (error) {
      logger.logUnknownError("Failed to generate license key", error);
    } finally {
      setGeneratingKey(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "paid":
        return "text-emerald-400";
      case "trialing":
        return "text-blue-400";
      case "past_due":
      case "open":
        return "text-amber-400";
      case "canceled":
      case "revoked":
        return "text-red-400";
      default:
        return "text-slate-400";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
      case "paid":
        return <CheckCircle className="w-4 h-4" />;
      case "trialing":
        return <Clock className="w-4 h-4" />;
      case "past_due":
      case "open":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Subscription Section */}
      <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Subscription
        </h2>

        {subscription ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-white capitalize">
                    {subscription.tier}
                  </span>
                  <span
                    className={`flex items-center gap-1 text-sm ${getStatusColor(subscription.status)}`}
                  >
                    {getStatusIcon(subscription.status)}
                    {subscription.status}
                  </span>
                </div>
                {subscription.currentPeriodEnd && (
                  <p className="text-sm text-slate-400 mt-1">
                    {subscription.cancelAtPeriodEnd
                      ? `Cancels on ${formatDate(subscription.currentPeriodEnd)}`
                      : `Renews on ${formatDate(subscription.currentPeriodEnd)}`}
                  </p>
                )}
              </div>
              <button
                onClick={handleManageBilling}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                Manage Billing
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>

            {subscription.cancelAtPeriodEnd && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <p className="text-amber-300 text-sm">
                  Your subscription is set to cancel. You'll retain access until
                  the end of your billing period.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-slate-400 mb-4">You're on the Free plan</p>
            <a
              href="/pricing"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg transition-colors"
            >
              Upgrade to Pro
            </a>
          </div>
        )}
      </section>

      {/* Usage Section */}
      {usage && (
        <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Usage This Month
          </h2>

          <div className="space-y-4">
            {Object.entries(usage.usage).map(([type, data]) => (
              <div key={type}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300 capitalize">
                    {type.replace("_", " ")}s
                  </span>
                  <span className="text-slate-400">
                    {data.count} / {data.limit === -1 ? "∞" : data.limit}
                  </span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      data.percentage >= 90
                        ? "bg-red-500"
                        : data.percentage >= 70
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, data.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500 mt-4">
            Usage resets on {formatDate(usage.period.end)}
          </p>
        </section>
      )}

      {/* License Keys Section */}
      <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Key className="w-5 h-5" />
            License Keys
          </h2>
          {subscription?.tier !== "free" && (
            <button
              onClick={handleGenerateLicenseKey}
              disabled={generatingKey}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-600 text-white text-sm rounded-lg transition-colors flex items-center gap-1.5"
            >
              {generatingKey ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Generate Key
            </button>
          )}
        </div>

        {licenseKeys.length > 0 ? (
          <div className="space-y-3">
            {licenseKeys.map((license) => (
              <div
                key={license.id}
                className="bg-slate-900/50 rounded-lg p-4 border border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <code className="text-sm font-mono text-slate-300">
                      {showLicenseKey === license.id
                        ? license.key
                        : license.key}
                    </code>
                    <button
                      onClick={() => copyToClipboard(license.key)}
                      className="text-slate-400 hover:text-white transition-colors"
                      title="Copy"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <span className={`text-xs ${getStatusColor(license.status)}`}>
                    {license.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                  <span>Tier: {license.tier}</span>
                  <span>
                    Activations: {license.activations}/{license.maxActivations}
                  </span>
                  <span>Created: {formatDate(license.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-sm">
            {subscription?.tier === "free"
              ? "License keys are available on paid plans."
              : "No license keys generated yet."}
          </p>
        )}
      </section>

      {/* Invoice History Section */}
      <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Download className="w-5 h-5" />
          Invoice History
        </h2>

        {invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="pb-3 font-medium">Invoice</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-slate-700/50">
                    <td className="py-3 text-white">{invoice.number}</td>
                    <td className="py-3 text-slate-300">
                      {formatDate(invoice.paidAt)}
                    </td>
                    <td className="py-3 text-white">
                      {formatCurrency(invoice.total, invoice.currency)}
                    </td>
                    <td className={`py-3 ${getStatusColor(invoice.status)}`}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(invoice.status)}
                        {invoice.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {invoice.hostedInvoiceUrl && (
                          <a
                            href={invoice.hostedInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-white transition-colors"
                            title="View"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        {invoice.invoicePdf && (
                          <a
                            href={invoice.invoicePdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-white transition-colors"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">No invoices yet.</p>
        )}
      </section>
    </div>
  );
}

export default BillingSettings;
