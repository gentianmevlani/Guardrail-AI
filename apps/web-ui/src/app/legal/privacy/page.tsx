import {
  LegalHighlight,
  LegalList,
  LegalPageLayout,
  LegalSection,
} from "@/components/legal/legal-page-layout";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | guardrail",
  description:
    "Learn how guardrail collects, uses, and protects your personal information. GDPR and CCPA compliant.",
  openGraph: {
    title: "Privacy Policy | guardrail",
    description:
      "Learn how guardrail collects, uses, and protects your personal information.",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const tableOfContents = [
  { id: "information-we-collect", title: "Information We Collect" },
  { id: "how-we-use-information", title: "How We Use Your Information" },
  { id: "data-sharing", title: "Data Sharing" },
  { id: "data-retention", title: "Data Retention" },
  { id: "your-rights-gdpr", title: "Your Rights (GDPR)" },
  { id: "your-rights-ccpa", title: "Your Rights (CCPA)" },
  { id: "cookies", title: "Cookies & Tracking" },
  { id: "security", title: "Security" },
  { id: "children", title: "Children's Privacy" },
  { id: "international-transfers", title: "International Transfers" },
  { id: "contact", title: "Contact Information" },
  { id: "changes", title: "Changes to Policy" },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
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
            name: "Privacy Policy",
            description:
              "guardrail Privacy Policy - How we collect, use, and protect your data",
            publisher: {
              "@type": "Organization",
              name: "guardrail, Inc.",
              url: "https://guardrail.dev",
            },
            dateModified: "2026-01-06",
            inLanguage: "en-US",
          }),
        }}
      />

      <p className="text-lg text-muted-foreground mb-8">
        guardrail, Inc. (&quot;guardrail,&quot; &quot;we,&quot; &quot;our,&quot;
        or &quot;us&quot;) is committed to protecting your privacy. This Privacy
        Policy explains how we collect, use, disclose, and safeguard your
        information when you use our code security and quality platform.
      </p>

      <LegalSection
        id="information-we-collect"
        title="1. Information We Collect"
      >
        <p>We collect information in several ways:</p>

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Account Data
        </h3>
        <LegalList
          items={[
            "Email address and name (required for account creation)",
            "Company or organization name (optional)",
            "Profile picture (optional, via OAuth providers)",
            "Authentication credentials (passwords are hashed using bcrypt)",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">Usage Data</h3>
        <LegalList
          items={[
            "Projects and repositories you connect",
            "Scan results and findings metadata",
            "Feature usage patterns and frequency",
            "Dashboard interactions and preferences",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Technical Data
        </h3>
        <LegalList
          items={[
            "IP address (hashed for privacy)",
            "Browser type and version",
            "Operating system and device information",
            "Referring URLs and exit pages",
            "Timestamps and session duration",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Payment Data
        </h3>
        <LegalHighlight variant="info">
          <p>
            <strong>Important:</strong> We do not store credit card numbers or
            full payment details. All payment processing is handled securely by
            Stripe. We only store:
          </p>
          <LegalList
            items={[
              "Stripe customer ID (for subscription management)",
              "Payment status and subscription tier",
              "Invoice history and billing address",
            ]}
          />
        </LegalHighlight>

        <h3 className="font-semibold text-foreground mt-6 mb-3">Code Data</h3>
        <LegalHighlight variant="important">
          <p>
            <strong>Your Code Stays Private:</strong> guardrail CLI runs locally
            on your machine. Your source code is never uploaded to our servers
            unless you explicitly use our cloud scanning features. When using
            cloud features:
          </p>
          <LegalList
            items={[
              "Code is processed in isolated, ephemeral environments",
              "Code is deleted immediately after analysis",
              "Only scan results and metadata are stored",
              "We never train AI models on your code",
            ]}
          />
        </LegalHighlight>
      </LegalSection>

      <LegalSection
        id="how-we-use-information"
        title="2. How We Use Your Information"
      >
        <p>We use the information we collect for the following purposes:</p>

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Service Provision
        </h3>
        <LegalList
          items={[
            "Provide, operate, and maintain our services",
            "Process and complete transactions",
            "Send transactional communications (receipts, confirmations)",
            "Manage your account and subscription",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Service Improvement
        </h3>
        <LegalList
          items={[
            "Understand how users interact with our platform",
            "Develop new features and functionality",
            "Improve detection accuracy and reduce false positives",
            "Optimize performance and user experience",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Communications
        </h3>
        <LegalList
          items={[
            "Respond to support requests and inquiries",
            "Send product updates and security notices",
            "Provide marketing communications (with consent)",
            "Notify you of policy changes",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Security & Compliance
        </h3>
        <LegalList
          items={[
            "Detect and prevent fraud and abuse",
            "Enforce our Terms of Service",
            "Comply with legal obligations",
            "Protect the rights and safety of users",
          ]}
        />
      </LegalSection>

      <LegalSection id="data-sharing" title="3. Data Sharing">
        <p>We do not sell your personal information. We may share data with:</p>

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Service Providers
        </h3>
        <LegalList
          items={[
            "Stripe - Payment processing (PCI DSS compliant)",
            "Sentry - Error tracking and monitoring",
            "PostHog - Product analytics (self-hosted option available)",
            "SendGrid - Transactional email delivery",
            "GitHub/GitLab - Repository integration (with your authorization)",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Legal Requirements
        </h3>
        <p>We may disclose information when required to:</p>
        <LegalList
          items={[
            "Comply with applicable laws or regulations",
            "Respond to valid legal process (subpoenas, court orders)",
            "Protect the rights, property, or safety of guardrail or others",
            "Enforce our agreements and policies",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Business Transfers
        </h3>
        <p>
          In the event of a merger, acquisition, or sale of assets, your
          information may be transferred. We will notify you before your data
          becomes subject to a different privacy policy.
        </p>

        <LegalHighlight variant="info">
          <p>
            <strong>We Never:</strong>
          </p>
          <LegalList
            items={[
              "Sell your personal data to third parties",
              "Share your code with other customers",
              "Use your code to train AI models",
              "Provide data to advertisers",
            ]}
          />
        </LegalHighlight>
      </LegalSection>

      <LegalSection id="data-retention" title="4. Data Retention">
        <p>We retain your information based on the following schedule:</p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-lg">
            <thead>
              <tr className="bg-card">
                <th className="px-4 py-3 text-left font-semibold border-b border-border">
                  Data Type
                </th>
                <th className="px-4 py-3 text-left font-semibold border-b border-border">
                  Retention Period
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-3 border-b border-border">
                  Account data
                </td>
                <td className="px-4 py-3 border-b border-border">
                  Until account deletion requested
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 border-b border-border">
                  Scan results
                </td>
                <td className="px-4 py-3 border-b border-border">
                  90 days after project deletion
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 border-b border-border">Usage logs</td>
                <td className="px-4 py-3 border-b border-border">90 days</td>
              </tr>
              <tr>
                <td className="px-4 py-3 border-b border-border">
                  Audit trails
                </td>
                <td className="px-4 py-3 border-b border-border">
                  365 days (compliance requirement)
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 border-b border-border">
                  Billing records
                </td>
                <td className="px-4 py-3 border-b border-border">
                  7 years (tax compliance)
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">Security events</td>
                <td className="px-4 py-3">180 days</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-4">
          You may request earlier deletion of your data by contacting{" "}
          <a
            href="mailto:privacy@guardrail.dev"
            className="text-primary hover:underline"
          >
            privacy@guardrail.dev
          </a>
          . Certain data may be retained longer if required by law.
        </p>
      </LegalSection>

      <LegalSection id="your-rights-gdpr" title="5. Your Rights (GDPR)">
        <p>
          If you are located in the European Economic Area (EEA), United
          Kingdom, or Switzerland, you have the following rights under GDPR:
        </p>

        <LegalList
          items={[
            "Right to Access - Request a copy of your personal data",
            "Right to Rectification - Correct inaccurate or incomplete data",
            "Right to Erasure - Request deletion of your personal data ('right to be forgotten')",
            "Right to Restriction - Limit how we process your data",
            "Right to Data Portability - Receive your data in a machine-readable format",
            "Right to Object - Object to processing based on legitimate interests",
            "Right to Withdraw Consent - Withdraw consent at any time where processing is based on consent",
            "Right to Lodge a Complaint - File a complaint with your local data protection authority",
          ]}
        />

        <LegalHighlight variant="info">
          <p>
            <strong>Legal Basis for Processing (GDPR Article 6):</strong>
          </p>
          <LegalList
            items={[
              "Contract Performance - To provide our services to you",
              "Legitimate Interests - To improve and secure our services",
              "Consent - For marketing communications",
              "Legal Obligation - To comply with applicable laws",
            ]}
          />
        </LegalHighlight>

        <p className="mt-4">
          To exercise your GDPR rights, contact our Data Protection Officer at{" "}
          <a
            href="mailto:dpo@guardrail.dev"
            className="text-primary hover:underline"
          >
            dpo@guardrail.dev
          </a>
          . We will respond within 30 days.
        </p>
      </LegalSection>

      <LegalSection id="your-rights-ccpa" title="6. Your Rights (CCPA)">
        <p>
          If you are a California resident, you have the following rights under
          the California Consumer Privacy Act (CCPA):
        </p>

        <LegalList
          items={[
            "Right to Know - What personal information we collect, use, and share",
            "Right to Delete - Request deletion of your personal information",
            "Right to Opt-Out - Opt out of the sale of personal information (we do not sell data)",
            "Right to Non-Discrimination - Equal service and pricing regardless of privacy choices",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Categories of Information Collected (Last 12 Months)
        </h3>
        <LegalList
          items={[
            "Identifiers (name, email, IP address)",
            "Commercial information (subscription history)",
            "Internet activity (usage patterns, interactions)",
            "Inferences drawn from the above",
          ]}
        />

        <LegalHighlight variant="info">
          <p>
            <strong>We Do Not Sell Personal Information.</strong> guardrail has
            never sold personal information and has no plans to do so.
          </p>
        </LegalHighlight>

        <p className="mt-4">
          To exercise your CCPA rights, email{" "}
          <a
            href="mailto:privacy@guardrail.dev"
            className="text-primary hover:underline"
          >
            privacy@guardrail.dev
          </a>{" "}
          or use our{" "}
          <a href="/account/privacy" className="text-primary hover:underline">
            Privacy Dashboard
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="7. Cookies & Tracking">
        <p>
          We use cookies and similar technologies for the following purposes:
        </p>

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Essential Cookies (Required)
        </h3>
        <LegalList
          items={[
            "Session management and authentication",
            "Security features (CSRF protection)",
            "Load balancing and performance",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Analytics Cookies (Optional)
        </h3>
        <LegalList
          items={[
            "Understanding feature usage patterns",
            "Measuring marketing campaign effectiveness",
            "Improving user experience",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Managing Cookies
        </h3>
        <p>
          You can control cookies through your browser settings or our cookie
          consent banner. Note that disabling essential cookies may affect
          service functionality.
        </p>

        <LegalHighlight variant="info">
          <p>
            <strong>Do Not Track:</strong> We honor Do Not Track (DNT) browser
            signals. When DNT is enabled, we disable non-essential analytics.
          </p>
        </LegalHighlight>
      </LegalSection>

      <LegalSection id="security" title="8. Security">
        <p>
          We implement industry-standard security measures to protect your
          information:
        </p>

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Technical Safeguards
        </h3>
        <LegalList
          items={[
            "TLS 1.3 encryption for all data in transit",
            "AES-256 encryption for data at rest",
            "Regular security audits and penetration testing",
            "Multi-factor authentication (MFA) support",
            "Automatic security patching and updates",
          ]}
        />

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Organizational Safeguards
        </h3>
        <LegalList
          items={[
            "SOC 2 Type II certified infrastructure",
            "Role-based access controls (RBAC)",
            "Employee security training",
            "Incident response procedures",
            "Regular backup and disaster recovery testing",
          ]}
        />

        <LegalHighlight variant="warning">
          <p>
            <strong>Security Incidents:</strong> In the event of a data breach,
            we will notify affected users within 72 hours as required by GDPR,
            and cooperate with relevant authorities.
          </p>
        </LegalHighlight>
      </LegalSection>

      <LegalSection id="children" title="9. Children's Privacy">
        <p>
          Our services are not intended for children under the age of 13 (or 16
          in the EEA). We do not knowingly collect personal information from
          children.
        </p>

        <p className="mt-4">
          If you believe we have inadvertently collected information from a
          child, please contact us immediately at{" "}
          <a
            href="mailto:privacy@guardrail.dev"
            className="text-primary hover:underline"
          >
            privacy@guardrail.dev
          </a>
          , and we will promptly delete the information.
        </p>
      </LegalSection>

      <LegalSection
        id="international-transfers"
        title="10. International Transfers"
      >
        <p>
          guardrail is headquartered in the United States. If you access our
          services from outside the US, your information may be transferred to,
          stored, and processed in the US or other countries.
        </p>

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          Transfer Mechanisms
        </h3>
        <LegalList
          items={[
            "Standard Contractual Clauses (SCCs) approved by the European Commission",
            "Data processing agreements with all service providers",
            "Privacy Shield successor frameworks where applicable",
          ]}
        />

        <p className="mt-4">
          We ensure that international transfers comply with applicable data
          protection laws and that your data receives equivalent protection.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="11. Contact Information">
        <p>
          For privacy-related inquiries or to exercise your rights, contact us:
        </p>

        <div className="mt-4 p-4 rounded-lg border border-border bg-card">
          <p className="mb-2">
            <strong>guardrail, Inc.</strong>
          </p>
          <p className="text-muted-foreground">
            Email:{" "}
            <a
              href="mailto:privacy@guardrail.dev"
              className="text-primary hover:underline"
            >
              privacy@guardrail.dev
            </a>
          </p>
          <p className="text-muted-foreground">
            Data Protection Officer:{" "}
            <a
              href="mailto:dpo@guardrail.dev"
              className="text-primary hover:underline"
            >
              dpo@guardrail.dev
            </a>
          </p>
          <p className="text-muted-foreground mt-2">
            We aim to respond to all inquiries within 30 days.
          </p>
        </div>

        <h3 className="font-semibold text-foreground mt-6 mb-3">
          EU Representative
        </h3>
        <p className="text-muted-foreground">
          For users in the European Union, our EU representative can be
          contacted at{" "}
          <a
            href="mailto:eu-rep@guardrail.dev"
            className="text-primary hover:underline"
          >
            eu-rep@guardrail.dev
          </a>
        </p>
      </LegalSection>

      <LegalSection id="changes" title="12. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. When we make
          material changes:
        </p>

        <LegalList
          items={[
            "We will notify you via email at least 30 days before changes take effect",
            "We will update the 'Last Updated' date at the top of this policy",
            "We will post a notice on our website and dashboard",
            "For significant changes, we may require you to re-accept the policy",
          ]}
        />

        <p className="mt-4">
          Your continued use of our services after the effective date
          constitutes acceptance of the updated policy.
        </p>

        <LegalHighlight variant="info">
          <p>
            <strong>Policy History:</strong> Previous versions of this Privacy
            Policy are available upon request by emailing{" "}
            <a
              href="mailto:legal@guardrail.dev"
              className="text-primary hover:underline"
            >
              legal@guardrail.dev
            </a>
            .
          </p>
        </LegalHighlight>
      </LegalSection>
    </LegalPageLayout>
  );
}
