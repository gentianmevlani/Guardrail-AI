"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { CreditCard, Check, Zap, Download, Calendar, TrendingUp, DollarSign, Package } from "lucide-react";
import { motion } from "motion/react";

export function BillingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  const currentPlan = {
    name: "Pro",
    price: 49,
    billingCycle: "monthly",
    nextBillingDate: "Feb 15, 2024",
    scans: 500,
    scansUsed: 287,
    users: 10,
    usersActive: 8,
  };

  const plans = [
    {
      name: "Free",
      description: "Perfect for personal projects",
      price: { monthly: 0, annual: 0 },
      features: [
        "100 scans per month",
        "1 user",
        "Basic security scanning",
        "Community support",
        "7 days report history",
      ],
      limitations: [
        "No CI/CD integration",
        "No custom policies",
      ],
      popular: false,
    },
    {
      name: "Pro",
      description: "Best for small teams",
      price: { monthly: 49, annual: 470 },
      features: [
        "500 scans per month",
        "10 users",
        "Advanced security scanning",
        "Priority support",
        "90 days report history",
        "CI/CD integration",
        "Custom policies",
        "API access",
      ],
      limitations: [],
      popular: true,
    },
    {
      name: "Enterprise",
      description: "For large organizations",
      price: { monthly: 199, annual: 1990 },
      features: [
        "Unlimited scans",
        "Unlimited users",
        "Full security suite",
        "24/7 dedicated support",
        "Unlimited report history",
        "Advanced CI/CD integration",
        "Custom policies & rules",
        "Full API access",
        "SSO / SAML",
        "Compliance reports",
        "SLA guarantee",
      ],
      limitations: [],
      popular: false,
    },
  ];

  const invoices = [
    {
      id: "INV-2024-001",
      date: "Jan 15, 2024",
      amount: 49.00,
      status: "paid",
      description: "Pro Plan - Monthly",
    },
    {
      id: "INV-2023-012",
      date: "Dec 15, 2023",
      amount: 49.00,
      status: "paid",
      description: "Pro Plan - Monthly",
    },
    {
      id: "INV-2023-011",
      date: "Nov 15, 2023",
      amount: 49.00,
      status: "paid",
      description: "Pro Plan - Monthly",
    },
    {
      id: "INV-2023-010",
      date: "Oct 15, 2023",
      amount: 49.00,
      status: "paid",
      description: "Pro Plan - Monthly",
    },
  ];

  const usageHistory = [
    { month: "Jan 2024", scans: 287, cost: 49.00 },
    { month: "Dec 2023", scans: 423, cost: 49.00 },
    { month: "Nov 2023", scans: 356, cost: 49.00 },
    { month: "Oct 2023", scans: 412, cost: 49.00 },
    { month: "Sep 2023", scans: 289, cost: 49.00 },
    { month: "Aug 2023", scans: 501, cost: 49.00 },
  ];

  const stats = [
    { 
      label: "Current Plan", 
      value: currentPlan.name, 
      color: "text-blue-400",
      bg: "from-blue-500/20 to-cyan-500/20",
      icon: Package
    },
    { 
      label: "Monthly Cost", 
      value: `$${currentPlan.price}`, 
      color: "text-emerald-400",
      bg: "from-emerald-500/20 to-green-500/20",
      icon: DollarSign
    },
    { 
      label: "Scans Used", 
      value: `${currentPlan.scansUsed}/${currentPlan.scans}`, 
      color: "text-purple-400",
      bg: "from-purple-500/20 to-pink-500/20",
      icon: TrendingUp
    },
    { 
      label: "Next Billing", 
      value: "Feb 15", 
      color: "text-cyan-400",
      bg: "from-cyan-500/20 to-blue-500/20",
      icon: Calendar
    },
  ];

  const getSavings = (price: { monthly: number; annual: number }) => {
    const annualMonthly = price.monthly * 12;
    const savings = annualMonthly - price.annual;
    const percentage = Math.round((savings / annualMonthly) * 100);
    return { amount: savings, percentage };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30">
              <CreditCard className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
                Billing
              </h1>
              <p className="text-zinc-400">Manage your subscription and billing</p>
            </div>
          </div>
          <Button variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600">
            <Download className="w-4 h-4 mr-2" />
            Download Invoices
          </Button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05 }}
          >
            <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-400">{stat.label}</p>
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-lg bg-gradient-to-br ${stat.bg}`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Current Subscription */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">Current Subscription</CardTitle>
            <CardDescription className="text-zinc-400">
              Your active plan and usage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-2xl font-bold text-white">{currentPlan.name} Plan</h3>
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Active</Badge>
                  </div>
                  <p className="text-zinc-400">Billed {currentPlan.billingCycle}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">${currentPlan.price}</p>
                  <p className="text-sm text-zinc-400">per month</p>
                </div>
              </div>

              {/* Usage Progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-400">Scans Usage</span>
                  <span className="text-sm text-zinc-300">{currentPlan.scansUsed} / {currentPlan.scans}</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      (currentPlan.scansUsed / currentPlan.scans) >= 0.9 ? "bg-gradient-to-r from-red-500 to-pink-500" :
                      (currentPlan.scansUsed / currentPlan.scans) >= 0.7 ? "bg-gradient-to-r from-yellow-500 to-orange-500" :
                      "bg-gradient-to-r from-blue-500 to-cyan-500"
                    }`}
                    style={{ width: `${(currentPlan.scansUsed / currentPlan.scans) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-400">Team Members</span>
                  <span className="text-sm text-zinc-300">{currentPlan.usersActive} / {currentPlan.users}</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-500"
                    style={{ width: `${(currentPlan.usersActive / currentPlan.users) * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                <span className="text-sm text-zinc-400">Next billing date: {currentPlan.nextBillingDate}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400 hover:text-white">
                    Cancel Subscription
                  </Button>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white">
                    Upgrade Plan
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Billing Cycle Toggle */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex items-center justify-center gap-3"
      >
        <span className={`text-sm ${billingCycle === "monthly" ? "text-white" : "text-zinc-500"}`}>Monthly</span>
        <button
          onClick={() => setBillingCycle(billingCycle === "monthly" ? "annual" : "monthly")}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            billingCycle === "annual" ? "bg-blue-600" : "bg-zinc-700"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              billingCycle === "annual" ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span className={`text-sm ${billingCycle === "annual" ? "text-white" : "text-zinc-500"}`}>
          Annual <Badge className="ml-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Save 20%</Badge>
        </span>
      </motion.div>

      {/* Pricing Plans */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {plans.map((plan, index) => {
          const savings = getSavings(plan.price);
          
          return (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
            >
              <Card className={`border-zinc-800 bg-zinc-900/50 backdrop-blur-xl hover:border-zinc-700 transition-all ${
                plan.popular ? "ring-2 ring-blue-500/50" : ""
              }`}>
                <CardHeader>
                  {plan.popular && (
                    <Badge className="w-fit mb-2 bg-blue-500/20 text-blue-400 border-blue-500/30">
                      Most Popular
                    </Badge>
                  )}
                  <CardTitle className="text-white">{plan.name}</CardTitle>
                  <CardDescription className="text-zinc-400">{plan.description}</CardDescription>
                  <div className="pt-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white">
                        ${billingCycle === "monthly" ? plan.price.monthly : Math.round(plan.price.annual / 12)}
                      </span>
                      <span className="text-zinc-400">/month</span>
                    </div>
                    {billingCycle === "annual" && plan.price.annual > 0 && (
                      <p className="text-sm text-emerald-400 mt-1">
                        Save ${savings.amount}/year ({savings.percentage}% off)
                      </p>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span className="text-zinc-300">{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Button 
                    className={`w-full ${
                      plan.name === currentPlan.name
                        ? "bg-zinc-700 text-zinc-400 cursor-default"
                        : plan.popular
                        ? "bg-blue-600 hover:bg-blue-500 text-white"
                        : "bg-zinc-800 hover:bg-zinc-700 text-white"
                    }`}
                    disabled={plan.name === currentPlan.name}
                  >
                    {plan.name === currentPlan.name ? "Current Plan" : "Upgrade"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Payment Method */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">Payment Method</CardTitle>
            <CardDescription className="text-zinc-400">
              Manage your payment information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-zinc-700">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">•••• •••• •••• 4242</p>
                  <p className="text-xs text-zinc-500">Expires 12/25</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400 hover:text-white">
                Update
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Invoice History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">Invoice History</CardTitle>
            <CardDescription className="text-zinc-400">
              Your past billing statements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-emerald-500/20">
                      <Check className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{invoice.id}</p>
                      <p className="text-xs text-zinc-500">{invoice.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-white">${invoice.amount.toFixed(2)}</p>
                      <p className="text-xs text-zinc-500">{invoice.date}</p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
