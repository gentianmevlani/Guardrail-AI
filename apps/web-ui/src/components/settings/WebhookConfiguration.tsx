"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, TestTube, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { logger } from "@/lib/logger";

interface WebhookConfig {
  id: string;
  url: string;
  secret?: string;
  events: string[];
  active: boolean;
  description?: string;
}

export function WebhookConfiguration() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});

  const addWebhook = () => {
    const newWebhook: WebhookConfig = {
      id: `webhook-${Date.now()}`,
      url: "",
      events: ["ship.decision"],
      active: true,
    };
    setWebhooks([...webhooks, newWebhook]);
  };

  const removeWebhook = (id: string) => {
    setWebhooks(webhooks.filter(w => w.id !== id));
    delete testResults[id];
  };

  const updateWebhook = (id: string, updates: Partial<WebhookConfig>) => {
    setWebhooks(webhooks.map(w => w.id === id ? { ...w, ...updates } : w));
  };

  const toggleEvent = (webhookId: string, event: string) => {
    setWebhooks(webhooks.map(w => {
      if (w.id === webhookId) {
        const events = w.events.includes(event)
          ? w.events.filter(e => e !== event)
          : [...w.events, event];
        return { ...w, events };
      }
      return w;
    }));
  };

  const testWebhook = async (webhook: WebhookConfig) => {
    setTesting(webhook.id);
    setTestResults({ ...testResults, [webhook.id]: false });

    try {
      const response = await fetch("/api/v1/webhooks/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhook.url,
          secret: webhook.secret,
          payload: {
            event: "test",
            data: { message: "Test webhook from guardrail" },
            timestamp: new Date().toISOString(),
          },
        }),
      });

      const success = response.ok;
      setTestResults({ ...testResults, [webhook.id]: success });
      
      if (success) {
        logger.info("Webhook test successful:", webhook.url);
      } else {
        logger.error("Webhook test failed:", webhook.url);
      }
    } catch (error: any) {
      logger.error("Webhook test error:", error);
      setTestResults({ ...testResults, [webhook.id]: false });
    } finally {
      setTesting(null);
    }
  };

  const saveWebhooks = async () => {
    try {
      const response = await fetch("/api/v1/webhooks/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhooks }),
      });

      if (response.ok) {
        logger.info("Webhooks saved successfully");
        alert("Webhooks saved successfully!");
      } else {
        throw new Error("Failed to save webhooks");
      }
    } catch (error: any) {
      logger.error("Failed to save webhooks:", error);
      alert(`Failed to save webhooks: ${error.message}`);
    }
  };

  const availableEvents = [
    { id: "ship.decision", name: "Ship Decision", description: "When ship verdict changes" },
    { id: "scan.complete", name: "Scan Complete", description: "When a scan finishes" },
    { id: "finding.critical", name: "Critical Finding", description: "When critical findings are detected" },
    { id: "fix.applied", name: "Fix Applied", description: "When a fix is applied" },
  ];

  return (
    <Card className="bg-black/40 border-zinc-800 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white">Webhook Configuration</CardTitle>
            <CardDescription className="text-zinc-400">
              Configure webhooks for CI/CD and external integrations
            </CardDescription>
          </div>
          <Button onClick={addWebhook} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Webhook
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {webhooks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-400 mb-4">No webhooks configured</p>
            <Button onClick={addWebhook} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Webhook
            </Button>
          </div>
        ) : (
          <>
            {webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={webhook.active}
                      onCheckedChange={(checked) =>
                        updateWebhook(webhook.id, { active: checked })
                      }
                    />
                    <Label className="text-white">Active</Label>
                    {testResults[webhook.id] !== undefined && (
                      testResults[webhook.id] ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testWebhook(webhook)}
                      disabled={testing === webhook.id}
                    >
                      <TestTube className="w-3 h-3 mr-1" />
                      {testing === webhook.id ? "Testing..." : "Test"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeWebhook(webhook.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`url-${webhook.id}`}>Webhook URL</Label>
                  <Input
                    id={`url-${webhook.id}`}
                    value={webhook.url}
                    onChange={(e) =>
                      updateWebhook(webhook.id, { url: e.target.value })
                    }
                    placeholder="https://your-server.com/webhook"
                    className="bg-zinc-900 border-zinc-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`secret-${webhook.id}`}>
                    Secret (optional)
                  </Label>
                  <Input
                    id={`secret-${webhook.id}`}
                    type="password"
                    value={webhook.secret || ""}
                    onChange={(e) =>
                      updateWebhook(webhook.id, { secret: e.target.value })
                    }
                    placeholder="Webhook secret for signature verification"
                    className="bg-zinc-900 border-zinc-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Events</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableEvents.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-2 p-2 rounded bg-zinc-950/50 border border-zinc-800 cursor-pointer hover:bg-zinc-950"
                        onClick={() => toggleEvent(webhook.id, event.id)}
                      >
                        <input
                          type="checkbox"
                          checked={webhook.events.includes(event.id)}
                          onChange={() => toggleEvent(webhook.id, event.id)}
                          className="rounded"
                        />
                        <div className="flex-1">
                          <div className="text-sm text-white">{event.name}</div>
                          <div className="text-xs text-zinc-500">
                            {event.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-end pt-4">
              <Button onClick={saveWebhooks}>Save Webhooks</Button>
            </div>
          </>
        )}

        <div className="mt-6 p-4 rounded-lg bg-blue-950/20 border border-blue-800/50">
          <h4 className="text-sm font-medium text-blue-400 mb-2">
            CI/CD Integration
          </h4>
          <p className="text-xs text-zinc-400 mb-3">
            Use webhooks to integrate with GitHub Actions, GitLab CI, CircleCI,
            and other CI/CD platforms.
          </p>
          <div className="space-y-2 text-xs text-zinc-500">
            <div>
              <strong>GitHub Actions:</strong> Use webhook to trigger workflows
              on ship decision changes
            </div>
            <div>
              <strong>Slack:</strong> Get notified in Slack channels when
              critical issues are found
            </div>
            <div>
              <strong>Custom:</strong> Send data to any HTTP endpoint
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
