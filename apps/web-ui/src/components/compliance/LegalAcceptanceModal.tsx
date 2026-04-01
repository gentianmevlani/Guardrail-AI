/**
 * Legal Acceptance Modal
 * 
 * Modal for accepting Terms of Service and Privacy Policy with version tracking.
 */

import { CheckCircle, ExternalLink, FileText, Shield, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface LegalDocument {
  type: 'terms' | 'privacy';
  title: string;
  version: string;
  currentVersion: string;
  content: string;
  url: string;
}

interface LegalAcceptanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
  requiredDocuments?: ('terms' | 'privacy')[];
}

export function LegalAcceptanceModal({
  isOpen,
  onClose,
  onAccept,
  requiredDocuments = ['terms', 'privacy']
}: LegalAcceptanceModalProps) {
  const [acceptedDocuments, setAcceptedDocuments] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Legal documents content (in production, this would come from your CMS or API)
  const documents: LegalDocument[] = [
    {
      type: 'terms',
      title: 'Terms of Service',
      version: '1.0',
      currentVersion: '1.0',
      content: `
# Terms of Service

## 1. Acceptance of Terms

By accessing and using guardrail, you accept and agree to be bound by the terms and provision of this agreement.

## 2. Use License

Permission is granted to temporarily download one copy of the materials on guardrail for personal, non-commercial transitory viewing only.

## 3. Disclaimer

The materials on guardrail are provided on an 'as is' basis. guardrail makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties.

## 4. Limitations

In no event shall guardrail or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on guardrail.

## 5. Privacy Policy

Your Privacy is important to us. Please review our Privacy Policy, which also governs the Site and informs users of our data collection practices.

## 6. Revisions and Errata

The materials appearing on guardrail could include technical, typographical, or photographic errors.

## 7. Governing Law

These terms and conditions are governed by and construed in accordance with the laws of [Jurisdiction] and you irrevocably submit to the exclusive jurisdiction of the courts in that State or location.
      `.trim(),
      url: '/legal/terms'
    },
    {
      type: 'privacy',
      title: 'Privacy Policy',
      version: '1.0',
      currentVersion: '1.0',
      content: `
# Privacy Policy

## 1. Information We Collect

We collect information you provide directly to us, such as when you create an account, use our services, or contact us.

## 2. How We Use Your Information

We use the information we collect to provide, maintain, and improve our services, process transactions, and communicate with you.

## 3. Information Sharing

We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy.

## 4. Data Security

We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.

## 5. Data Retention

We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this policy.

## 6. Your Rights

You have the right to access, update, or delete your personal information. You can also object to processing of your personal information or request data portability.

## 7. Cookies

We use cookies and similar tracking technologies to track activity on our service and hold certain information.

## 8. Children's Privacy

Our service is not intended for use by children under the age of 16. We do not knowingly collect personal information from children under 16.

## 9. International Data Transfers

Your personal information may be transferred to, and maintained on, computers located outside of your state, province, country or other governmental jurisdiction.

## 10. Changes to This Policy

We may update our privacy policy from time to time. We will notify you of any changes by posting the new privacy policy on this page.
      `.trim(),
      url: '/legal/privacy'
    }
  ];

  // Filter documents based on requirements
  const requiredDocs = documents.filter(doc => requiredDocuments.includes(doc.type));

  useEffect(() => {
    if (isOpen) {
      setAcceptedDocuments(new Set());
      setError(null);
    }
  }, [isOpen]);

  const handleDocumentAccept = (docType: string) => {
    const newAccepted = new Set(acceptedDocuments);
    if (newAccepted.has(docType)) {
      newAccepted.delete(docType);
    } else {
      newAccepted.add(docType);
    }
    setAcceptedDocuments(newAccepted);
  };

  const handleAcceptAll = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Accept all required documents
      const acceptPromises = requiredDocs.map(doc => 
        acceptDocument(doc.type, doc.currentVersion)
      );

      await Promise.all(acceptPromises);

      onAccept?.();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to accept legal documents');
    } finally {
      setIsLoading(false);
    }
  };

  const acceptDocument = async (docType: string, version: string) => {
    const response = await fetch('/api/v1/legal/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        docType,
        version,
        locale: navigator.language || 'en'
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to accept ${docType}`);
    }

    return response.json();
  };

  const allRequiredAccepted = requiredDocs.every(doc => acceptedDocuments.has(doc.type));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Legal Documents
            </h2>
            <p className="text-gray-600 mt-1">
              Please review and accept the following documents to continue
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {requiredDocs.map((doc) => (
              <div key={doc.type} className="border rounded-lg overflow-hidden">
                {/* Document Header */}
                <div className="bg-gray-50 p-4 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {doc.type === 'terms' ? (
                        <FileText className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Shield className="w-5 h-5 text-green-600" />
                      )}
                      <div>
                        <h3 className="font-semibold">{doc.title}</h3>
                        <p className="text-sm text-gray-600">Version {doc.currentVersion}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open in new tab
                      </a>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={acceptedDocuments.has(doc.type)}
                          onChange={() => handleDocumentAccept(doc.type)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Document Content */}
                <div className="p-4">
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                      {doc.content}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t p-6">
          {/* Summary */}
          <div className="mb-4">
            <div className="flex items-center gap-2 text-sm">
              {allRequiredAccepted ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <div className="w-4 h-4 border-2 border-gray-300 rounded" />
              )}
              <span className={allRequiredAccepted ? 'text-green-600' : 'text-gray-600'}>
                {allRequiredAccepted 
                  ? 'All required documents accepted' 
                  : `${requiredDocs.length - acceptedDocuments.size} document(s) remaining`
                }
              </span>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleAcceptAll}
              disabled={!allRequiredAccepted || isLoading}
              className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Accept & Continue
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Additional Info */}
          <p className="text-xs text-gray-500 mt-4 text-center">
            By accepting these documents, you agree to be bound by their terms and conditions.
            You can review these documents at any time in your account settings.
          </p>
        </div>
      </div>
    </div>
  );
}
