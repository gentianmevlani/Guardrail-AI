"use client";

import { UsageAnalytics } from "@/components/billing/UsageAnalytics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  downloadInvoice,
  fetchBillingHistory,
  fetchBillingUsage,
  fetchExtendedBillingUsage,
  fetchPaymentMethods,
  fetchTenants,
  updateTenantPlan,
  type BillingHistory,
  type BillingUsage,
  type ExtendedBillingUsage,
  type PaymentMethod,
} from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { logger } from "@/lib/logger";
import { PRICING_PLANS } from "@/lib/pricing";
import type { PaidTier } from "@/lib/tier-gates";
import { format } from "date-fns";
import {
  Activity,
  Check,
  CreditCard,
  Download,
  ExternalLink,
  Loader2,
  Shield,
  TrendingUp,
  Zap,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useEffect, useState } from "react";

// Simple date formatter as fallback
const formatDate = (date: Date | string) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMM d, yyyy");
};

// Force dynamic rendering
export const dynamic = "force-dynamic";

const PAID_TIERS: PaidTier[] = ["starter", "pro", "compliance"];

export default function BillingPage() {
  const { user } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [extendedUsage, setExtendedUsage] =
    useState<ExtendedBillingUsage | null>(null);
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(true);
  const [billingHistory, setBillingHistory] = useState<BillingHistory[]>([]);
  const [downloadingInvoice, setDownloadingInvoice] = useState<string | null>(
    null,
  );
  const { toast } = useToast();

  useEffect(() => {
    async function loadData() {
      try {
        const [tenants, methods, usageData, historyData, extendedUsageData] = await Promise.all([
          fetchTenants(),
          fetchPaymentMethods(),
          fetchBillingUsage(),
          fetchBillingHistory(),
          fetchExtendedBillingUsage(),
        ]);
        if (tenants.length > 0) {
          setCurrentPlan(tenants[0].plan);
          setTenantId(tenants[0].id);
        }
        setPaymentMethods(methods);
        setUsage(usageData);
        setBillingHistory(historyData);
        setExtendedUsage(extendedUsageData);
      } catch (error) {
        logger.error("Failed to load billing info", { error: error instanceof Error ? error.message : String(error) });
        toast({
          title: "Error loading billing information",
          description: "Please try refreshing the page.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [toast]);

  const handleUpgrade = async (
    plan: "free" | "starter" | "pro" | "compliance",
  ) => {
    if (PAID_TIERS.includes(plan as PaidTier)) {
      setProcessing(plan);
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            tierId: plan,
            email: user?.email,
            userId: user?.id,
          }),
        });
        const data = (await res.json()) as {
          url?: string;
          error?: string;
          message?: string;
          preview?: boolean;
        };
        if (!res.ok) {
          toast({
            title: "Checkout unavailable",
            description:
              data.message ||
              data.error ||
              "Could not start checkout. Configure Stripe or try again.",
            variant: "destructive",
          });
          return;
        }
        if (data.url) {
          window.location.href = data.url;
          return;
        }
        toast({
          title: "Checkout unavailable",
          description: data.error || "No checkout URL returned.",
          variant: "destructive",
        });
      } catch (error) {
        logger.error("Failed to start checkout", {
          error: error instanceof Error ? error.message : String(error),
        });
        toast({
          title: "Failed to start checkout",
          description: "Please try again or contact support.",
          variant: "destructive",
        });
      } finally {
        setProcessing(null);
      }
      return;
    }

    if (!tenantId) return;
    setProcessing(plan);
    try {
      const updated = await updateTenantPlan(tenantId, "free");
      if (updated) {
        setCurrentPlan(updated.plan);
        toast({
          title: "Plan updated",
          description: "Your workspace is on the Free plan.",
        });
      }
    } catch (error) {
      logger.error("Failed to update plan", {
        error: error instanceof Error ? error.message : String(error),
      });
      toast({
        title: "Failed to update plan",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleDownloadInvoice = async (invoiceId: string) => {
    setDownloadingInvoice(invoiceId);
    try {
      const blob = await downloadInvoice(invoiceId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error("Failed to download invoice", { error: error instanceof Error ? error.message : String(error) });
      toast({
        title: "Failed to download invoice",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setDownloadingInvoice(null);
    }
  };

  const handleManagePayment = async () => {
    try {
      const { createCustomerPortalSession } = await import("@/lib/api");
      const session = await createCustomerPortalSession();
      window.open(session.url, "_blank");
    } catch (error) {
      logger.error("Failed to create portal session", { error });
      toast({
        title: "Error",
        description: "Failed to open billing portal. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpgradeToPlan = async (plan: string) => {
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({ plan }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      logger.error("Failed to create checkout session", { error });
      toast({
        title: "Error",
        description: "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getUsagePercentage = (current: number, limit: number | null) => {
    if (limit === null) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return "text-red-500";
    if (percentage >= 75) return "text-yellow-500";
    return "text-green-500";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const currentPlanData = PRICING_PLANS.find((p) => p.id === currentPlan);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-white">
          Subscription & Billing
        </h1>
        <p className="text-muted-foreground">
          Manage your workspace plan and billing details.
        </p>
      </div>

      {/* Current Plan Overview */}
      <Card className="bg-card/40 border backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">Current Plan</CardTitle>
          <CardDescription className="text-muted-foreground">
            You're currently on the {currentPlanData?.name || "Free"} plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold text-white">
                    {currentPlanData?.name || "Free"}
                  </h3>
                  <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30">
                    {currentPlanData?.price === 0
                      ? "Free"
                      : `$${currentPlanData?.price}/${currentPlanData?.period}`}
                  </Badge>
                  {usage?.subscription?.status && (
                    <Badge
                      variant={
                        usage.subscription.status === "active"
                          ? "default"
                          : usage.subscription.status === "trialing"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {usage.subscription.status}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-1">
                  {currentPlanData?.description}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleManagePayment}
                className="border text-foreground/80 hover:bg-muted"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Manage Billing
              </Button>
            </div>
            
            {/* Subscription Details */}
            {usage?.subscription && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                <div>
                  <p className="text-sm text-muted-foreground">Renewal Date</p>
                  <p className="text-sm font-medium text-white">
                    {formatDate(usage.subscription.renewalDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Seats</p>
                  <p className="text-sm font-medium text-white">
                    {usage.teamMembersUsed} / {usage.teamMembersLimit || "∞"}
                  </p>
                </div>
                {usage.subscription.cancelAtPeriodEnd && (
                  <div className="col-span-2">
                    <Badge variant="destructive" className="w-fit">
                      Cancels on {formatDate(usage.subscription.renewalDate)}
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Analytics Section */}
      {extendedUsage && showAdvancedAnalytics ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-teal-400" />
                Advanced Usage Analytics
              </h2>
              <p className="text-sm text-muted-foreground">
                Detailed usage metrics, trends, and projections
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedAnalytics(false)}
              className="border text-muted-foreground hover:text-white"
            >
              Show Simple View
            </Button>
          </div>
          <UsageAnalytics usage={extendedUsage} tier={currentPlan} />
        </div>
      ) : usage ? (
        <Card className="bg-card/40 border backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Usage Metrics
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Current billing period usage
                </CardDescription>
              </div>
              {extendedUsage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvancedAnalytics(true)}
                  className="border text-teal-400 hover:text-teal-300 hover:bg-teal-500/10"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Advanced Analytics
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Code Scans
                  </span>
                  <span
                    className={`text-sm font-medium ${getUsageColor(getUsagePercentage(usage.scansUsed, usage.scansLimit))}`}
                  >
                    {usage.scansUsed} /{" "}
                    {usage.scansLimit === null ? "∞" : usage.scansLimit}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(usage.scansUsed, usage.scansLimit)}
                  className="h-2"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Reality Runs
                  </span>
                  <span
                    className={`text-sm font-medium ${getUsageColor(getUsagePercentage(usage.realityRunsUsed, usage.realityRunsLimit))}`}
                  >
                    {usage.realityRunsUsed} /{" "}
                    {usage.realityRunsLimit === null
                      ? "∞"
                      : usage.realityRunsLimit}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(
                    usage.realityRunsUsed,
                    usage.realityRunsLimit,
                  )}
                  className="h-2"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    AI Agent Runs
                  </span>
                  <span
                    className={`text-sm font-medium ${getUsageColor(getUsagePercentage(usage.aiAgentRunsUsed, usage.aiAgentRunsLimit))}`}
                  >
                    {usage.aiAgentRunsUsed} /{" "}
                    {usage.aiAgentRunsLimit === null
                      ? "∞"
                      : usage.aiAgentRunsLimit}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(
                    usage.aiAgentRunsUsed,
                    usage.aiAgentRunsLimit,
                  )}
                  className="h-2"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Team Members
                  </span>
                  <span
                    className={`text-sm font-medium ${getUsageColor(getUsagePercentage(usage.teamMembersUsed, usage.teamMembersLimit))}`}
                  >
                    {usage.teamMembersUsed} /{" "}
                    {usage.teamMembersLimit === null
                      ? "∞"
                      : usage.teamMembersLimit}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(
                    usage.teamMembersUsed,
                    usage.teamMembersLimit,
                  )}
                  className="h-2"
                />
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Billing period
                  </p>
                  <p className="text-white font-medium">
                    {formatDate(new Date(usage.currentPeriodStart))} -{" "}
                    {formatDate(new Date(usage.currentPeriodEnd))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    Next billing date
                  </p>
                  <p className="text-white font-medium">
                    {formatDate(new Date(usage.currentPeriodEnd))}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="plans" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-card/50 border">
          <TabsTrigger value="plans" className="data-[state=active]:bg-muted">
            <Shield className="w-4 h-4 mr-2" />
            Plans
          </TabsTrigger>
          <TabsTrigger value="payment" className="data-[state=active]:bg-muted">
            <CreditCard className="w-4 h-4 mr-2" />
            Payment
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-muted">
            <TrendingUp className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Plans Tab */}
        <TabsContent value="plans" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
            {PRICING_PLANS.map((plan) => {
              const isCurrent = currentPlan === plan.id;
              const isProcessing = processing === plan.id;

              return (
                <Card
                  key={plan.id}
                  className={`
                    relative bg-card/40 border backdrop-blur-sm flex flex-col
                    ${isCurrent ? "border-blue-500/50 glow-blue" : "hover:border-primary/30 transition-colors"}
                  `}
                >
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-blue-600 text-white hover:bg-blue-600">
                        Current Plan
                      </Badge>
                    </div>
                  )}

                  <CardHeader>
                    <CardTitle className="text-white flex justify-between items-center">
                      {plan.title || plan.name}
                      {plan.id === "compliance" ? (
                        <Shield className="h-5 w-5 text-green-400" />
                      ) : plan.id === "pro" ? (
                        <Zap className="h-5 w-5 text-blue-400" />
                      ) : plan.id === "starter" ? (
                        <TrendingUp className="h-5 w-5 text-purple-400" />
                      ) : (
                        <Shield className="h-5 w-5 text-muted-foreground" />
                      )}
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {plan.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1 space-y-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-white">
                        {plan.price === null
                          ? "Custom"
                          : plan.price === 0
                            ? "$0"
                            : `$${plan.price}`}
                      </span>
                      {plan.price !== null && plan.price !== 0 && (
                        <span className="text-muted-foreground">
                          {plan.period}
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      {plan.features.map((feature, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 text-sm text-foreground/80"
                        >
                          <Check className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                          {feature}
                        </div>
                      ))}
                    </div>
                  </CardContent>

                  <CardFooter>
                    <Button
                      className={`w-full ${
                        isCurrent
                          ? "bg-muted text-muted-foreground cursor-default hover:bg-muted"
                          : "bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_15px_-3px_rgba(37,99,235,0.5)]"
                      }`}
                      disabled={isCurrent || isProcessing}
                      onClick={() =>
                        handleUpgrade(
                          plan.id as
                            | "free"
                            | "starter"
                            | "pro"
                            | "compliance",
                        )
                      }
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isCurrent ? (
                        "Active"
                      ) : plan.id === "free" &&
                        ["starter", "pro", "compliance"].includes(
                          currentPlan,
                        ) ? (
                        "Downgrade"
                      ) : (
                        "Upgrade"
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Payment Tab */}
        <TabsContent value="payment" className="space-y-6">
          <Card className="bg-card/40 border backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Method
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Manage your payment details and billing information.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {paymentMethods.length > 0 ? (
                <div className="space-y-3">
                  {paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className="flex items-center justify-between p-4 border rounded-lg bg-card/30"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-16 bg-muted rounded flex items-center justify-center">
                          <span className="font-mono text-xs text-muted-foreground">
                            {method.brand?.toUpperCase() ||
                              method.type.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            •••• •••• •••• {method.last4}
                            {method.isDefault && (
                              <Badge className="ml-2 bg-blue-600/20 text-blue-400 text-[10px]">
                                Default
                              </Badge>
                            )}
                          </p>
                          {method.expiryMonth && method.expiryYear && (
                            <p className="text-xs text-muted-foreground">
                              Expires{" "}
                              {method.expiryMonth.toString().padStart(2, "0")}/
                              {method.expiryYear.toString().slice(-2)}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={handleManagePayment}
                        className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                      >
                        Update
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 space-y-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <CreditCard className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-foreground/80 font-medium">
                      No payment method
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Add a payment method to upgrade your plan
                    </p>
                  </div>
                  <Button
                    onClick={handleManagePayment}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Add Payment Method
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card className="bg-card/40 border backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Billing History
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Download and view your past invoices and payments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {billingHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border">
                      <TableHead className="text-muted-foreground">
                        Date
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Description
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Amount
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Status
                      </TableHead>
                      <TableHead className="text-muted-foreground text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billingHistory.map((item) => (
                      <TableRow key={item.id} className="border">
                        <TableCell className="text-foreground/80">
                          {formatDate(new Date(item.date))}
                        </TableCell>
                        <TableCell className="text-foreground/80">
                          {item.description}
                        </TableCell>
                        <TableCell className="text-white font-medium">
                          ${item.amount}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.status === "paid" ? "default" : "secondary"
                            }
                            className={
                              item.status === "paid"
                                ? "bg-green-600/20 text-green-400 border-green-600/30"
                                : "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"
                            }
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.status === "paid" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadInvoice(item.id)}
                              disabled={downloadingInvoice === item.id}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                            >
                              {downloadingInvoice === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  icon={TrendingUp}
                  title="No billing history"
                  description="Your billing history will appear here once you have transactions. Invoices and payments will be listed here after your first subscription."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
