import {
  LegalHighlight,
  LegalList,
  LegalPageLayout,
  LegalSection,
} from "@/components/legal/legal-page-layout";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | guardrail",
  description:
    "Terms of Service for using guardrail's code security and quality platform.",
  openGraph: {
    title: "Terms of Service | guardrail",
    description:
      "Terms of Service for using guardrail's code security and quality platform.",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const tableOfContents = [
  { id: "acceptance", title: "Acceptance of Terms" },
  { id: "description", title: "Description of Service" },
  { id: "account", title: "Account Registration" },
  { id: "acceptable-use", title: "Acceptable Use Policy" },
  { id: "billing", title: "Subscription and Billing" },
  { id: "intellectual-property", title: "Intellectual Property" },
  { id: "user-content", title: "User Content" },
  { id: "api-terms", title: "API Terms" },
  { id: "disclaimers", title: "Disclaimers" },
  { id: "limitation-liability", title: "Limitation of Liability" },
  { id: "indemnification", title: "Indemnification" },
  { id: "termination", title: "Termination" },
  { id: "dispute-resolution", title: "Dispute Resolution" },
  { id: "changes", title: "Changes to Terms" },
  { id: "contact", title: "Contact" },
];

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      lastUpdated="January 6, 2026"
      version="2.0"
      tableOfContents={tableOfContents}
    >
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Terms of Service",
            description:
              "guardrail Terms of Service - Rules and guidelines for using our platform",
            publisher: {
              "@type": "Organization",
              name: "guardrail, Inc.",
              url: "https://guardrailai.dev",
            },
            dateModified: "2026-01-06",
            inLanguage: "en-US",
          }),
        }}
      />

      <p className="text-lg text-muted-foreground mb-8">
        Welcome to guardrail. These Terms of Service (&quot;Terms&quot;) govern
        your access to and use of guardrail&apos;s services, including our
        website, CLI tools, API, and related services (collectively, the
        &quot;Service&quot;). Please read these Terms carefully before using our
        Service.
      </p>

      <LegalSection id="acceptance" title="1. Acceptance of Terms">
        <p>
          By accessing or using the Service, you agree to be bound by these
          Terms and our{" "}
          <a href="/legal/privacy" className="text-primary hover:underline">
            Privacy Policy
          </a>
          . If you do not agree to these Terms, you may not use the Service.
        </p>

        <h3 className="font-semibold text-foreground mt-6 mb-3">Eligibility</h3>
        <LegalList
          items={[
            "You must be at least 18 years old to use this Service",
            "If using on behalf of an organization, you must have authority to bind that organization to these Terms",
            "You may not use the Service if you have been previously banned or terminated",
            "The Service is not available in jurisdictions where it would be prohibited by law",
          ]}
        />

        <LegalHighlight variant="important">
          <p>
            <strong>Binding Agreement:</strong> By clicking &quot;I
            Accept,&quot; creating an account, or using the Service, you
            acknowledge that you have read, understood, and agree to be bound by
            these Terms.
          </p>
        </LegalHighlight>
      </LegalSection>

      <LegalSection id="description" title="2. Description of Service">
        <p>
          guardrail is a code security and quality platform that helps
          developers catch issues in AI-generated code before deployment. Our
          Service includes:
        </p>

        <LegalList
          items={[
            "Code scanning and security analysis",
            "Mock data and fake feature detection (Reality Mode)",
            "Compliance checking (SOC2, HIPAA, GDPR, PCI, NIST, ISO27001)",
            "CI/CD integration and deployment gating",
            "API access for programmatic integration",
            "Dashboard and reporting tools",
            "CLI tools for local analysis",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Service Tiers
        </h3>
        <LegalList
          items={[
            "Free - Limited scans and basic features",
            "Starter - Individual developers with expanded limits",
            "Pro - Teams with advanced features and priority support",
            "Compliance - Enterprise compliance frameworks",
            "Enterprise - Custom solutions with dedicated support",
          ]}
        />

        <p className="mt-4">
          We reserve the right to modify, suspend, or discontinue any part of
          the Service at any time with reasonable notice.
        </p>
      </LegalSection>

      <LegalSection id="account" title="3. Account Registration">
        <h3 className="font-semibold text-foreground mb-3">Account Creation</h3>
        <LegalList
          items={[
            "You must provide accurate and complete registration information",
            "You are responsible for maintaining the confidentiality of your account credentials",
            "You must notify us immediately of any unauthorized access to your account",
            "One account per person or legal entity (no account sharing)",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Account Security
        </h3>
        <LegalList
          items={[
            "Use a strong, unique password for your account",
            "Enable multi-factor authentication (MFA) when available",
            "Do not share API keys or access tokens",
            "Regularly rotate credentials and review access permissions",
          ]}
        />

        <LegalHighlight variant="warning">
          <p>
            <strong>Your Responsibility:</strong> You are responsible for all
            activities that occur under your account. guardrail is not liable
            for any loss or damage arising from unauthorized use of your
            account.
          </p>
        </LegalHighlight>
      </LegalSection>

      <LegalSection id="acceptable-use" title="4. Acceptable Use Policy">
        <p>You agree not to use the Service to:</p>

        <h3 className="font-semibold text-foreground mt-4 mb-3">
          Prohibited Activities
        </h3>
        <LegalList
          items={[
            "Violate any applicable laws or regulations",
            "Infringe on intellectual property rights of others",
            "Upload malicious code, viruses, or harmful content",
            "Attempt to gain unauthorized access to our systems or other users' accounts",
            "Reverse engineer, decompile, or disassemble the Service",
            "Circumvent security measures or rate limits",
            "Use the Service to develop a competing product",
            "Resell, sublicense, or redistribute the Service without authorization",
            "Engage in automated scraping or data extraction beyond API limits",
            "Impersonate others or misrepresent your affiliation",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">Rate Limits</h3>
        <p>
          You must respect the rate limits and usage quotas associated with your
          subscription tier. Excessive usage that impacts service availability
          may result in throttling or suspension.
        </p>

        <h3 className="font-semibold text-foreground mt-6 mb-3">Enforcement</h3>
        <p>
          We may investigate violations of these Terms and take appropriate
          action, including warning, suspension, or termination of your account.
        </p>
      </LegalSection>

      <LegalSection id="billing" title="5. Subscription and Billing">
        <h3 className="font-semibold text-foreground mb-3">
          Pricing and Payment
        </h3>
        <LegalList
          items={[
            "Prices are displayed in USD unless otherwise specified",
            "All fees are exclusive of applicable taxes",
            "Payment is processed securely through Stripe",
            "You authorize us to charge your payment method for recurring subscription fees",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Subscription Terms
        </h3>
        <LegalList
          items={[
            "Subscriptions automatically renew at the end of each billing period",
            "You may cancel your subscription at any time through your account settings",
            "Cancellation takes effect at the end of the current billing period",
            "No prorated refunds for partial billing periods",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Price Changes
        </h3>
        <LegalList
          items={[
            "We will provide at least 30 days notice of price increases",
            "Price changes take effect at the start of your next billing period",
            "Continued use after a price change constitutes acceptance",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Refund Policy
        </h3>
        <LegalHighlight variant="info">
          <p>
            <strong>30-Day Money-Back Guarantee:</strong> New paid subscribers
            may request a full refund within 30 days of their initial purchase.
            Contact{" "}
            <a
              href="mailto:billing@guardrailai.dev"
              className="text-primary hover:underline"
            >
              billing@guardrailai.dev
            </a>{" "}
            for refund requests.
          </p>
        </LegalHighlight>
      </LegalSection>

      <LegalSection id="intellectual-property" title="6. Intellectual Property">
        <h3 className="font-semibold text-foreground mb-3">
          guardrail&apos;s Ownership
        </h3>
        <p>
          guardrail owns all rights, title, and interest in the Service,
          including:
        </p>
        <LegalList
          items={[
            "The guardrail name, logo, and branding",
            "Our software, algorithms, and underlying technology",
            "Documentation, designs, and user interfaces",
            "Any improvements or modifications we make",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Your Ownership
        </h3>
        <p>You retain all ownership rights to:</p>
        <LegalList
          items={[
            "Your source code and repositories",
            "Your project configurations and settings",
            "Data you upload or create using the Service",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          License Grant
        </h3>
        <p>
          By using the Service, you grant guardrail a limited, non-exclusive
          license to:
        </p>
        <LegalList
          items={[
            "Process your code for the purpose of providing the Service",
            "Store scan results and metadata as described in our Privacy Policy",
            "Display aggregated, anonymized statistics (no individual code is shared)",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">Feedback</h3>
        <p>
          If you provide feedback, suggestions, or ideas about the Service, you
          grant us a perpetual, irrevocable license to use such feedback without
          compensation or attribution.
        </p>
      </LegalSection>

      <LegalSection id="user-content" title="7. User Content">
        <h3 className="font-semibold text-foreground mb-3">
          Your Responsibilities
        </h3>
        <LegalList
          items={[
            "You are solely responsible for the code and content you submit",
            "You must have the right to submit any code you analyze",
            "You must not submit code that infringes on third-party rights",
            "You must not submit code that contains illegal content",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Content Removal
        </h3>
        <p>
          We reserve the right to remove any content that violates these Terms
          or applicable law. We are not obligated to monitor content but may do
          so at our discretion.
        </p>

        <LegalHighlight variant="info">
          <p>
            <strong>Code Privacy:</strong> Your code is processed in isolated
            environments and is not shared with other users or used to train AI
            models. See our{" "}
            <a href="/legal/privacy" className="text-primary hover:underline">
              Privacy Policy
            </a>{" "}
            for details.
          </p>
        </LegalHighlight>
      </LegalSection>

      <LegalSection id="api-terms" title="8. API Terms">
        <h3 className="font-semibold text-foreground mb-3">API Access</h3>
        <LegalList
          items={[
            "API access is subject to your subscription tier limits",
            "You must use valid API keys for all requests",
            "API keys are confidential and must not be shared",
            "We may revoke API access for abuse or violations",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">Rate Limits</h3>
        <LegalList
          items={[
            "Free: 100 requests/day",
            "Starter: 1,000 requests/day",
            "Pro: 10,000 requests/day",
            "Enterprise: Custom limits",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Prohibited Uses
        </h3>
        <LegalList
          items={[
            "Reselling API access without authorization",
            "Building a competing service using our API",
            "Automated scraping beyond documented endpoints",
            "Circumventing rate limits or authentication",
          ]}
        />
      </LegalSection>

      <LegalSection id="disclaimers" title="9. Disclaimers">
        <LegalHighlight variant="warning">
          <p className="font-semibold mb-2">
            SERVICE PROVIDED &quot;AS IS&quot;
          </p>
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS
            AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
            INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY,
            FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>
        </LegalHighlight>

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          No Guarantee of Results
        </h3>
        <LegalList
          items={[
            "We do not guarantee that all security vulnerabilities will be detected",
            "Scan results are advisory and not a substitute for professional security audits",
            "We are not responsible for issues missed by our scanning tools",
            "You remain responsible for the security of your applications",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Service Availability
        </h3>
        <p>
          We strive for high availability but do not guarantee uninterrupted
          service. Scheduled maintenance windows will be communicated in
          advance.
        </p>
      </LegalSection>

      <LegalSection
        id="limitation-liability"
        title="10. Limitation of Liability"
      >
        <LegalHighlight variant="important">
          <p className="font-semibold mb-2">LIMITATION OF DAMAGES</p>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, guardrail SHALL NOT BE
            LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
            PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS,
            DATA, USE, OR GOODWILL, ARISING OUT OF OR RELATED TO THESE TERMS OR
            THE SERVICE.
          </p>
        </LegalHighlight>

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Cap on Liability
        </h3>
        <p>
          Our total liability for any claims arising from these Terms or the
          Service shall not exceed the greater of:
        </p>
        <LegalList
          items={[
            "The amount you paid to guardrail in the 12 months preceding the claim",
            "One hundred US dollars ($100)",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">Exceptions</h3>
        <p>
          Some jurisdictions do not allow limitations on liability. In such
          cases, the limitations above may not apply to you.
        </p>
      </LegalSection>

      <LegalSection id="indemnification" title="11. Indemnification">
        <p>
          You agree to indemnify, defend, and hold harmless guardrail, its
          officers, directors, employees, and agents from any claims, damages,
          losses, liabilities, costs, and expenses (including reasonable
          attorney&apos;s fees) arising from:
        </p>

        <LegalList
          items={[
            "Your use of the Service",
            "Your violation of these Terms",
            "Your violation of any third-party rights",
            "Any content you submit through the Service",
            "Your negligence or willful misconduct",
          ]}
        />
      </LegalSection>

      <LegalSection id="termination" title="12. Termination">
        <h3 className="font-semibold text-foreground mb-3">
          Termination by You
        </h3>
        <p>
          You may terminate your account at any time through your account
          settings or by contacting{" "}
          <a
            href="mailto:support@guardrailai.dev"
            className="text-primary hover:underline"
          >
            support@guardrailai.dev
          </a>
          .
        </p>

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Termination by Us
        </h3>
        <p>We may terminate or suspend your account if:</p>
        <LegalList
          items={[
            "You violate these Terms",
            "You fail to pay subscription fees",
            "Your use poses a security risk",
            "We are required by law",
            "We discontinue the Service",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Effect of Termination
        </h3>
        <LegalList
          items={[
            "Your access to the Service will be revoked",
            "Your data will be retained for 30 days, then deleted (unless required by law)",
            "You may request a data export before termination",
            "Sections that by their nature should survive will remain in effect",
          ]}
        />
      </LegalSection>

      <LegalSection id="dispute-resolution" title="13. Dispute Resolution">
        <h3 className="font-semibold text-foreground mb-3">Governing Law</h3>
        <p>
          These Terms are governed by the laws of the State of Delaware, United
          States, without regard to conflict of law principles.
        </p>

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Informal Resolution
        </h3>
        <p>
          Before filing a formal dispute, you agree to first contact us at{" "}
          <a
            href="mailto:legal@guardrailai.dev"
            className="text-primary hover:underline"
          >
            legal@guardrailai.dev
          </a>{" "}
          to attempt informal resolution for at least 30 days.
        </p>

        <h3 className="font-semibold text-foreground mt-6 mb-3">Arbitration</h3>
        <p>
          Any disputes not resolved informally shall be resolved through binding
          arbitration administered by the American Arbitration Association (AAA)
          under its Commercial Arbitration Rules. Arbitration shall take place
          in Delaware or remotely.
        </p>

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Class Action Waiver
        </h3>
        <LegalHighlight variant="warning">
          <p>
            <strong>CLASS ACTION WAIVER:</strong> You agree to resolve disputes
            with guardrail on an individual basis only. You waive any right to
            participate in a class action or class-wide arbitration.
          </p>
        </LegalHighlight>

        <h3 className="font-semibold text-foreground mt-6 mb-3">Exceptions</h3>
        <p>
          Either party may seek injunctive relief in any court of competent
          jurisdiction for actual or threatened infringement of intellectual
          property rights.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="14. Changes to Terms">
        <p>
          We may modify these Terms at any time. When we make material changes:
        </p>

        <LegalList
          items={[
            "We will provide at least 30 days notice via email or dashboard notification",
            "We will update the 'Last Updated' date at the top of these Terms",
            "Continued use after changes take effect constitutes acceptance",
            "If you do not agree to the new Terms, you must stop using the Service",
          ]}
        />

        <LegalHighlight variant="info">
          <p>
            <strong>Version History:</strong> Previous versions of these Terms
            are available upon request by emailing{" "}
            <a
              href="mailto:legal@guardrailai.dev"
              className="text-primary hover:underline"
            >
              legal@guardrailai.dev
            </a>
            .
          </p>
        </LegalHighlight>
      </LegalSection>

      <LegalSection id="contact" title="15. Contact">
        <p>For questions about these Terms, please contact us:</p>

        <div className="mt-4 p-4 rounded-lg border border-border bg-card">
          <p className="mb-2">
            <strong>guardrail, Inc.</strong>
          </p>
          <p className="text-muted-foreground">
            Legal Inquiries:{" "}
            <a
              href="mailto:legal@guardrailai.dev"
              className="text-primary hover:underline"
            >
              legal@guardrailai.dev
            </a>
          </p>
          <p className="text-muted-foreground">
            General Support:{" "}
            <a
              href="mailto:support@guardrailai.dev"
              className="text-primary hover:underline"
            >
              support@guardrailai.dev
            </a>
          </p>
          <p className="text-muted-foreground">
            Billing:{" "}
            <a
              href="mailto:billing@guardrailai.dev"
              className="text-primary hover:underline"
            >
              billing@guardrailai.dev
            </a>
          </p>
        </div>

        <p className="mt-4">
          For physical mail correspondence, please email us first to obtain our
          current mailing address.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
