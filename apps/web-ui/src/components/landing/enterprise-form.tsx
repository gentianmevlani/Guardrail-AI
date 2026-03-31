"use client";

import { Button } from "@/components/ui/button";
import { InlineLoader } from "@/components/ui/loaders";
import { Building2, CheckCircle, Mail, MessageSquare, Users } from "lucide-react";
import React, { useState } from "react";

interface EnterpriseFormProps {
  onSuccess?: () => void;
}

export function EnterpriseForm({ onSuccess }: EnterpriseFormProps) {
  const [formData, setFormData] = useState({
    companyName: "",
    companySize: "",
    name: "",
    email: "",
    role: "",
    useCase: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companySizes = [
    "1-10 employees",
    "11-50 employees",
    "51-200 employees",
    "201-1000 employees",
    "1000+ employees",
  ];

  const useCases = [
    "Security scanning & vulnerability detection",
    "Compliance & regulatory requirements",
    "AI code quality guardrails",
    "Custom policy enforcement",
    "SSO/SAML integration",
    "On-premise deployment",
    "API & CLI access",
    "Other",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/enterprise-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to submit inquiry");
      }

      setIsSubmitted(true);
      onSuccess?.();
    } catch (err) {
      const mailtoLink = `mailto:support@guardrailai.dev?subject=Enterprise%20Inquiry%20-%20${encodeURIComponent(formData.companyName)}&body=${encodeURIComponent(
        `Company: ${formData.companyName}\nCompany Size: ${formData.companySize}\nName: ${formData.name}\nEmail: ${formData.email}\nRole: ${formData.role}\nUse Case: ${formData.useCase}\n\nMessage:\n${formData.message}`
      )}`;
      window.location.href = mailtoLink;
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="text-center py-8" role="status" aria-live="polite">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4" aria-hidden="true">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Thank You!</h3>
        <p className="text-white/70 mb-4">
          We've received your inquiry and will get back to you within 24 hours.
        </p>
        <p className="text-sm text-white/50">
          For urgent matters, reach us at{" "}
          <a
            href="mailto:support@guardrailai.dev"
            className="text-emerald-400 hover:text-emerald-300"
          >
            support@guardrailai.dev
          </a>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-white/70 text-sm">
        Tell us about your organization and we'll create a custom plan that fits your needs.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="company-name" className="block text-sm font-medium text-white/80 mb-1.5">
            <Building2 className="w-4 h-4 inline mr-1.5 text-blue-400" aria-hidden="true" />
            Company Name <span aria-hidden="true">*</span><span className="sr-only">(required)</span>
          </label>
          <input
            id="company-name"
            type="text"
            required
            aria-required="true"
            value={formData.companyName}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
            placeholder="Acme Corp"
          />
        </div>

        <div>
          <label htmlFor="company-size" className="block text-sm font-medium text-white/80 mb-1.5">
            <Users className="w-4 h-4 inline mr-1.5 text-blue-400" aria-hidden="true" />
            Company Size <span aria-hidden="true">*</span><span className="sr-only">(required)</span>
          </label>
          <select
            id="company-size"
            required
            aria-required="true"
            value={formData.companySize}
            onChange={(e) => setFormData({ ...formData, companySize: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
          >
            <option value="" className="bg-slate-900">Select size...</option>
            {companySizes.map((size) => (
              <option key={size} value={size} className="bg-slate-900">
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="block text-sm font-medium text-white/80 mb-1.5">
            Your Name <span aria-hidden="true">*</span><span className="sr-only">(required)</span>
          </label>
          <input
            id="contact-name"
            type="text"
            required
            aria-required="true"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
            placeholder="John Smith"
          />
        </div>

        <div>
          <label htmlFor="work-email" className="block text-sm font-medium text-white/80 mb-1.5">
            <Mail className="w-4 h-4 inline mr-1.5 text-blue-400" aria-hidden="true" />
            Work Email <span aria-hidden="true">*</span><span className="sr-only">(required)</span>
          </label>
          <input
            id="work-email"
            type="email"
            required
            aria-required="true"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
            placeholder="john@acme.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="contact-role" className="block text-sm font-medium text-white/80 mb-1.5">
          Your Role
        </label>
        <input
          id="contact-role"
          type="text"
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
          placeholder="Engineering Manager, CTO, etc."
        />
      </div>

      <div>
        <label htmlFor="use-case" className="block text-sm font-medium text-white/80 mb-1.5">
          Primary Use Case <span aria-hidden="true">*</span><span className="sr-only">(required)</span>
        </label>
        <select
          id="use-case"
          required
          aria-required="true"
          value={formData.useCase}
          onChange={(e) => setFormData({ ...formData, useCase: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
        >
          <option value="" className="bg-slate-900">Select use case...</option>
          {useCases.map((useCase) => (
            <option key={useCase} value={useCase} className="bg-slate-900">
              {useCase}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-white/80 mb-1.5">
          <MessageSquare className="w-4 h-4 inline mr-1.5 text-blue-400" aria-hidden="true" />
          Tell us more about your needs
        </label>
        <textarea
          id="message"
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm resize-none"
          placeholder="What challenges are you looking to solve? Any specific requirements?"
        />
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium py-2.5"
      >
        {isSubmitting ? (
          <>
            <InlineLoader size="sm" variant="spinner" />
            <span className="ml-2">Submitting...</span>
          </>
        ) : (
          "Request Enterprise Demo"
        )}
      </Button>

      <p className="text-xs text-white/50 text-center">
        We'll respond within 24 hours. No spam, ever.
      </p>
    </form>
  );
}
