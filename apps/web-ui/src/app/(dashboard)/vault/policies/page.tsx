"use client";

/**
 * Receipt Vault - Policies Page
 * Edit architecture boundaries and strictness
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Plus, Trash2, AlertCircle } from "lucide-react";
import { logger } from "@/lib/logger";

interface Boundary {
  id: string;
  name: string;
  from: string;
  to: string;
  allowed: boolean;
}

interface PolicyConfig {
  strictness: "dev" | "pre-merge" | "pre-deploy";
  boundaries: Boundary[];
}

export default function VaultPoliciesPage() {
  const [config, setConfig] = useState<PolicyConfig>({
    strictness: "dev",
    boundaries: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchPolicies() {
      try {
        const res = await fetch("/api/guardrail/policies");
        setConfig(await res.json());
      } catch (e) {
        logger.logUnknownError("Failed to fetch policies", e);
      } finally {
        setLoading(false);
      }
    }
    fetchPolicies();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/guardrail/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.errors?.join(", ") || data.error || "Failed to save");
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const addBoundary = () => {
    setConfig({
      ...config,
      boundaries: [
        ...config.boundaries,
        { id: Date.now().toString(), name: "", from: "", to: "", allowed: false },
      ],
    });
  };

  const removeBoundary = (id: string) => {
    setConfig({
      ...config,
      boundaries: config.boundaries.filter((b) => b.id !== id),
    });
  };

  const updateBoundary = (id: string, field: keyof Boundary, value: string | boolean) => {
    setConfig({
      ...config,
      boundaries: config.boundaries.map((b) =>
        b.id === id ? { ...b, [field]: value } : b
      ),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Policies</h1>
          <p className="text-muted-foreground">Configure architecture boundaries</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-2 text-red-500">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-green-500">
          Policies saved successfully!
        </div>
      )}

      {/* Strictness */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Strictness Level</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {(["dev", "pre-merge", "pre-deploy"] as const).map((level) => (
              <Button
                key={level}
                variant={config.strictness === level ? "default" : "outline"}
                size="sm"
                onClick={() => setConfig({ ...config, strictness: level })}
              >
                {level}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {config.strictness === "dev" && "Relaxed - warnings only"}
            {config.strictness === "pre-merge" && "Moderate - block on high severity"}
            {config.strictness === "pre-deploy" && "Strict - block on any violation"}
          </p>
        </CardContent>
      </Card>

      {/* Boundaries */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Architecture Boundaries</CardTitle>
          <Button size="sm" variant="outline" onClick={addBoundary}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </CardHeader>
        <CardContent>
          {config.boundaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No boundaries configured.</p>
          ) : (
            <div className="space-y-4">
              {config.boundaries.map((boundary) => (
                <div key={boundary.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3">
                    <Input
                      placeholder="Name"
                      value={boundary.name}
                      onChange={(e) => updateBoundary(boundary.id, "name", e.target.value)}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      placeholder="From (glob)"
                      value={boundary.from}
                      onChange={(e) => updateBoundary(boundary.id, "from", e.target.value)}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      placeholder="To (glob)"
                      value={boundary.to}
                      onChange={(e) => updateBoundary(boundary.id, "to", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <Switch
                      checked={boundary.allowed}
                      onCheckedChange={(v) => updateBoundary(boundary.id, "allowed", v)}
                    />
                    <Label className="text-xs">{boundary.allowed ? "Allow" : "Block"}</Label>
                  </div>
                  <div className="col-span-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeBoundary(boundary.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
