"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  Globe,
  Play,
  Terminal,
  X,
} from "lucide-react";
import { useState } from "react";

interface NetworkRequest {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  status: number;
  duration: number;
  resourceType: string;
  domain: string;
  size: number;
  headers?: Record<string, string>;
  body?: string;
  matchedRules?: string[];
}

interface TimelineEvent {
  id: string;
  timestamp: number;
  type: "navigate" | "click" | "input" | "network" | "finding";
  label: string;
  details?: string;
  findingId?: string;
}

interface EvidenceViewerProps {
  networkRequests: NetworkRequest[];
  timeline: TimelineEvent[];
  traceUrl?: string;
  onOpenTrace?: () => void;
}

const SUSPICIOUS_DOMAINS = [
  "localhost",
  "127.0.0.1",
  "staging",
  "dev.",
  "test.",
  "ngrok.io",
  "localtunnel",
];

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-muted transition-colors"
      title={label || "Copy"}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

function generateCurl(request: NetworkRequest): string {
  let curl = `curl -X ${request.method} '${request.url}'`;
  if (request.headers) {
    Object.entries(request.headers).forEach(([key, value]) => {
      curl += ` \\\n  -H '${key}: ${value}'`;
    });
  }
  if (request.body) {
    curl += ` \\\n  -d '${request.body}'`;
  }
  return curl;
}

function isSuspiciousDomain(domain: string): boolean {
  return SUSPICIOUS_DOMAINS.some((sus) => domain.toLowerCase().includes(sus));
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return "text-emerald-400";
  if (status >= 300 && status < 400) return "text-blue-400";
  if (status >= 400 && status < 500) return "text-amber-400";
  if (status >= 500) return "text-red-400";
  return "text-muted-foreground";
}

function getMethodColor(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "text-emerald-400";
    case "POST":
      return "text-blue-400";
    case "PUT":
      return "text-amber-400";
    case "DELETE":
      return "text-red-400";
    case "PATCH":
      return "text-purple-400";
    default:
      return "text-muted-foreground";
  }
}

export function EvidenceViewer({
  networkRequests,
  timeline,
  traceUrl,
  onOpenTrace,
}: EvidenceViewerProps) {
  const [selectedRequest, setSelectedRequest] = useState<NetworkRequest | null>(
    null,
  );
  const [domainFilter, setDomainFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>("all");

  // Get unique values for filters
  const domains = Array.from(new Set(networkRequests.map((r) => r.domain)));
  const methods = Array.from(new Set(networkRequests.map((r) => r.method)));
  const resourceTypes = Array.from(
    new Set(networkRequests.map((r) => r.resourceType)),
  );

  // Filter requests
  const filteredRequests = networkRequests.filter((req) => {
    if (
      domainFilter &&
      !req.domain.toLowerCase().includes(domainFilter.toLowerCase())
    )
      return false;
    if (statusFilter !== "all") {
      const statusGroup = statusFilter;
      if (statusGroup === "2xx" && (req.status < 200 || req.status >= 300))
        return false;
      if (statusGroup === "3xx" && (req.status < 300 || req.status >= 400))
        return false;
      if (statusGroup === "4xx" && (req.status < 400 || req.status >= 500))
        return false;
      if (statusGroup === "5xx" && req.status < 500) return false;
    }
    if (methodFilter !== "all" && req.method !== methodFilter) return false;
    if (resourceTypeFilter !== "all" && req.resourceType !== resourceTypeFilter)
      return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Domain search */}
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              placeholder="Filter domain..."
              className="pl-9 pr-4 py-1.5 text-sm bg-card border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/30 w-48"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-sm bg-card border rounded-lg text-foreground/80 focus:outline-none focus:border-primary/30"
          >
            <option value="all">All Status</option>
            <option value="2xx">2xx Success</option>
            <option value="3xx">3xx Redirect</option>
            <option value="4xx">4xx Client Error</option>
            <option value="5xx">5xx Server Error</option>
          </select>

          {/* Method filter */}
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-3 py-1.5 text-sm bg-card border rounded-lg text-foreground/80 focus:outline-none focus:border-primary/30"
          >
            <option value="all">All Methods</option>
            {methods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* Resource type filter */}
          <select
            value={resourceTypeFilter}
            onChange={(e) => setResourceTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-sm bg-card border rounded-lg text-foreground/80 focus:outline-none focus:border-primary/30"
          >
            <option value="all">All Types</option>
            {resourceTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {traceUrl && (
          <Button
            variant="outline"
            size="sm"
            className="border text-foreground/80"
            onClick={onOpenTrace}
          >
            <Play className="h-4 w-4 mr-2" />
            Open Playwright Trace
          </Button>
        )}
      </div>

      <div className="grid grid-cols-[1fr,400px] gap-4">
        {/* Network Table */}
        <div className="rounded-lg border overflow-hidden">
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-card sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b w-16">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b w-16">
                    Method
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b">
                    URL
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b w-20">
                    Type
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b w-20">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRequests.map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => setSelectedRequest(req)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      selectedRequest?.id === req.id
                        ? "bg-muted"
                        : "hover:bg-muted/50",
                    )}
                  >
                    <td
                      className={cn(
                        "px-3 py-2 text-sm font-mono",
                        getStatusColor(req.status),
                      )}
                    >
                      {req.status}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-sm font-mono font-medium",
                        getMethodColor(req.method),
                      )}
                    >
                      {req.method}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isSuspiciousDomain(req.domain) && (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] flex-shrink-0">
                            suspicious
                          </Badge>
                        )}
                        {req.matchedRules && req.matchedRules.length > 0 && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                        )}
                        <span
                          className="text-sm text-foreground/80 font-mono truncate"
                          title={req.url}
                        >
                          {req.url}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {req.resourceType}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground font-mono">
                      {req.duration}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Request Details Panel */}
        <div className="rounded-lg border bg-card/50">
          {selectedRequest ? (
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "font-mono font-medium",
                      getMethodColor(selectedRequest.method),
                    )}
                  >
                    {selectedRequest.method}
                  </span>
                  <span
                    className={cn(
                      "font-mono",
                      getStatusColor(selectedRequest.status),
                    )}
                  >
                    {selectedRequest.status}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <CopyButton
                    value={generateCurl(selectedRequest)}
                    label="Copy as cURL"
                  />
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="p-1 rounded hover:bg-muted transition-colors"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* URL */}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    URL
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-sm text-foreground/80 font-mono break-all">
                      {selectedRequest.url}
                    </code>
                    <CopyButton value={selectedRequest.url} />
                  </div>
                </div>

                {/* Domain warning */}
                {isSuspiciousDomain(selectedRequest.domain) && (
                  <div className="p-3 rounded bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-2 text-amber-400 text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      Suspicious domain detected:{" "}
                      <code className="font-mono">
                        {selectedRequest.domain}
                      </code>
                    </div>
                  </div>
                )}

                {/* Matched rules */}
                {selectedRequest.matchedRules &&
                  selectedRequest.matchedRules.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        Matched Rules
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {selectedRequest.matchedRules.map((rule) => (
                          <Badge
                            key={rule}
                            className="bg-red-500/20 text-red-400 border-red-500/30 text-xs font-mono"
                          >
                            {rule}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Headers */}
                {selectedRequest.headers &&
                  Object.keys(selectedRequest.headers).length > 0 && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        Headers
                      </div>
                      <div className="p-3 rounded bg-muted border max-h-40 overflow-y-auto">
                        {Object.entries(selectedRequest.headers).map(
                          ([key, value]) => (
                            <div key={key} className="text-xs font-mono">
                              <span className="text-blue-400">{key}:</span>{" "}
                              <span className="text-foreground/80">
                                {value}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                {/* Body */}
                {selectedRequest.body && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Body
                    </div>
                    <div className="p-3 rounded bg-muted border max-h-40 overflow-y-auto">
                      <pre className="text-xs text-foreground/80 font-mono whitespace-pre-wrap">
                        {selectedRequest.body}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Copy cURL */}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    cURL
                  </div>
                  <div className="relative">
                    <pre className="p-3 rounded bg-muted border text-xs text-foreground/80 font-mono overflow-x-auto">
                      {generateCurl(selectedRequest)}
                    </pre>
                    <div className="absolute top-2 right-2">
                      <CopyButton
                        value={generateCurl(selectedRequest)}
                        label="Copy cURL"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              <div className="text-center">
                <Eye className="h-8 w-8 mx-auto mb-2 text-muted-foreground/70" />
                <p>Select a request to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-lg border p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Timeline
        </div>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-3">
            {timeline.map((event, idx) => (
              <div key={event.id} className="flex items-start gap-4 relative">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10",
                    event.type === "finding"
                      ? "bg-red-500/20 border border-red-500/30"
                      : "bg-muted border",
                  )}
                >
                  {event.type === "navigate" && (
                    <Globe className="h-4 w-4 text-blue-400" />
                  )}
                  {event.type === "click" && (
                    <Terminal className="h-4 w-4 text-muted-foreground" />
                  )}
                  {event.type === "input" && (
                    <Terminal className="h-4 w-4 text-muted-foreground" />
                  )}
                  {event.type === "network" && (
                    <Globe className="h-4 w-4 text-muted-foreground" />
                  )}
                  {event.type === "finding" && (
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        event.type === "finding"
                          ? "text-red-400"
                          : "text-foreground/80",
                      )}
                    >
                      {event.label}
                    </span>
                    <span className="text-xs text-muted-foreground/70 font-mono">
                      {event.timestamp}ms
                    </span>
                  </div>
                  {event.details && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {event.details}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
