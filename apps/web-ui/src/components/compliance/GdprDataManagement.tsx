/**
 * GDPR Data Management Page
 *
 * Comprehensive GDPR compliance interface for data export and deletion.
 */

import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  FileText,
  RefreshCw,
  Shield,
  Trash2,
} from "lucide-react";
import { logger } from "@/lib/logger";
import { useEffect, useState } from "react";

interface GdprJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  failureReason?: string;
  downloadUrl?: string;
}

interface LegalAcceptance {
  terms: {
    accepted: boolean;
    version: string | null;
    acceptedAt: string | null;
    currentVersion: string;
    needsUpdate: boolean;
  };
  privacy: {
    accepted: boolean;
    version: string | null;
    acceptedAt: string | null;
    currentVersion: string;
    needsUpdate: boolean;
  };
}

export function GdprDataManagement() {
  const [exportJob, setExportJob] = useState<GdprJob | null>(null);
  const [deletionJob, setDeletionJob] = useState<GdprJob | null>(null);
  const [legalStatus, setLegalStatus] = useState<LegalAcceptance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    loadLegalStatus();
    loadActiveJobs();
  }, []);

  // Poll job status if active
  useEffect(() => {
    const hasActiveJobs =
      exportJob?.status === "pending" ||
      exportJob?.status === "processing" ||
      deletionJob?.status === "pending" ||
      deletionJob?.status === "processing";

    if (hasActiveJobs) {
      const interval = setInterval(() => {
        if (exportJob?.id) loadExportJobStatus(exportJob.id);
        if (deletionJob?.id) loadDeletionJobStatus(deletionJob.id);
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportJob?.status, deletionJob?.status]);

  const loadLegalStatus = async () => {
    try {
      const response = await fetch("/api/v1/legal/status");
      if (response.ok) {
        const data = await response.json();
        setLegalStatus(data.data);
      }
    } catch (error) {
      logger.logUnknownError("Failed to load legal status", error);
    }
  };

  const loadActiveJobs = async () => {
    // This would typically load active jobs from the server
    // For now, we'll check if there are any recent jobs
  };

  const loadExportJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(`/api/v1/legal/gdpr/export/${jobId}`);
      if (response.ok) {
        const data = await response.json();
        setExportJob(data.data);
      }
    } catch (error) {
      logger.logUnknownError("Failed to load export job status", error);
    }
  };

  const loadDeletionJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(`/api/v1/legal/gdpr/delete/${jobId}`);
      if (response.ok) {
        const data = await response.json();
        setDeletionJob(data.data);
      }
    } catch (error) {
      logger.logUnknownError("Failed to load deletion job status", error);
    }
  };

  const handleExportData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/legal/gdpr/export", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create export job");
      }

      const data = await response.json();
      setExportJob({
        id: data.data.jobId,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to start export",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      "⚠️ WARNING: This action cannot be undone!\n\n" +
        "Deleting your account will:\n" +
        "• Remove all your personal data\n" +
        "• Delete all projects and scans\n" +
        "• Cancel any active subscriptions\n" +
        "• Revoke all API keys and access tokens\n\n" +
        "This action is permanent and cannot be reversed.\n\n" +
        "Are you absolutely sure you want to continue?",
    );

    if (!confirmed) return;

    // Double confirmation
    const doubleConfirmed = window.confirm(
      'FINAL WARNING: Type "DELETE MY ACCOUNT" to confirm this irreversible action.\n\n' +
        "This will permanently erase all your data from guardrail.",
    );

    if (!doubleConfirmed) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/legal/gdpr/delete", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create deletion job");
      }

      const data = await response.json();
      setDeletionJob({
        id: data.data.jobId,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to start deletion",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "processing":
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Queued for processing";
      case "processing":
        return "Processing your request";
      case "completed":
        return "Completed successfully";
      case "failed":
        return "Failed to process";
      default:
        return "Unknown status";
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-600" />
          Privacy & Data Management
        </h1>
        <p className="text-gray-600 mt-2">
          Manage your personal data, export your information, or request account
          deletion in compliance with GDPR.
        </p>
      </div>

      {/* Legal Acceptance Status */}
      {legalStatus && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Legal Documents
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Terms of Service */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Terms of Service</h3>
                {legalStatus.terms.accepted ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                )}
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Version: {legalStatus.terms.currentVersion}
              </p>
              {legalStatus.terms.accepted && (
                <p className="text-xs text-gray-500">
                  Accepted on{" "}
                  {new Date(legalStatus.terms.acceptedAt!).toLocaleDateString()}
                </p>
              )}
              {legalStatus.terms.needsUpdate && (
                <p className="text-xs text-yellow-600 mt-2">
                  New version available - please review and accept
                </p>
              )}
            </div>

            {/* Privacy Policy */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Privacy Policy</h3>
                {legalStatus.privacy.accepted ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                )}
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Version: {legalStatus.privacy.currentVersion}
              </p>
              {legalStatus.privacy.accepted && (
                <p className="text-xs text-gray-500">
                  Accepted on{" "}
                  {new Date(
                    legalStatus.privacy.acceptedAt!,
                  ).toLocaleDateString()}
                </p>
              )}
              {legalStatus.privacy.needsUpdate && (
                <p className="text-xs text-yellow-600 mt-2">
                  New version available - please review and accept
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Data Export */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Download className="w-5 h-5" />
          Export Your Data
        </h2>

        <p className="text-gray-600 mb-6">
          Download a complete copy of all your personal data stored by
          guardrail, including: profile information, projects, scan results,
          usage history, and account settings.
        </p>

        {exportJob ? (
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {getStatusIcon(exportJob.status)}
                <span className="font-medium">
                  Export Job #{exportJob.id.slice(-8)}
                </span>
              </div>
              <span className="text-sm text-gray-500">
                Started {new Date(exportJob.createdAt).toLocaleString()}
              </span>
            </div>

            <p className="text-sm text-gray-600 mb-3">
              {getStatusText(exportJob.status)}
            </p>

            {exportJob.status === "completed" && exportJob.downloadUrl && (
              <a
                href={exportJob.downloadUrl}
                download
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Export
              </a>
            )}

            {exportJob.status === "failed" && (
              <div className="text-sm text-red-600">
                Error: {exportJob.failureReason}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={handleExportData}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Creating Export...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export My Data
              </>
            )}
          </button>
        )}
      </div>

      {/* Account Deletion */}
      <div className="bg-white rounded-lg border border-red-200 p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-red-600">
          <Trash2 className="w-5 h-5" />
          Delete Account
        </h2>

        <div className="space-y-4">
          <p className="text-gray-600">
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </p>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-medium text-red-800 mb-2">
              What will be deleted:
            </h3>
            <ul className="text-sm text-red-700 space-y-1">
              <li>• Personal profile information</li>
              <li>• All projects and scan results</li>
              <li>• Usage history and analytics</li>
              <li>• API keys and access tokens</li>
              <li>• Subscription and billing records</li>
              <li>• All other personal data</li>
            </ul>
          </div>

          {deletionJob ? (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon(deletionJob.status)}
                  <span className="font-medium">
                    Deletion Job #{deletionJob.id.slice(-8)}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  Started {new Date(deletionJob.createdAt).toLocaleString()}
                </span>
              </div>

              <p className="text-sm text-gray-600 mb-3">
                {getStatusText(deletionJob.status)}
              </p>

              {deletionJob.status === "completed" && (
                <div className="text-sm text-green-600">
                  Your account has been successfully deleted. You will be logged
                  out automatically.
                </div>
              )}

              {deletionJob.status === "failed" && (
                <div className="text-sm text-red-600">
                  Error: {deletionJob.failureReason}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleDeleteAccount}
              disabled={isLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processing Deletion...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete My Account
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Error</span>
          </div>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
      )}

      {/* Additional Information */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="font-semibold mb-3">Your Rights Under GDPR</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium mb-2">Right to Access</h4>
            <p className="text-gray-600">
              You can request a copy of all personal data we hold about you.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-2">Right to Erasure</h4>
            <p className="text-gray-600">
              You can request deletion of your personal data under certain
              circumstances.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-2">Right to Rectification</h4>
            <p className="text-gray-600">
              You can correct inaccurate or incomplete personal data.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-2">Right to Portability</h4>
            <p className="text-gray-600">
              You can request your data in a machine-readable format.
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            For questions about your privacy rights or to make a request,
            contact our privacy team at{" "}
            <a
              href="mailto:privacy@guardrailai.dev"
              className="text-blue-600 hover:underline"
            >
              privacy@guardrailai.dev
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
