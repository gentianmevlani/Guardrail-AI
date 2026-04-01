"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchPolicies,
  updatePolicy,
  type PolicyAllowlistEntry,
  type PolicyProfile,
  type PolicyRule,
} from "@/lib/api";
import { logger } from "@/lib/logger";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileCode,
  Globe,
  Loader2,
  Lock,
  Package,
  Plus,
  Save,
  ScrollText,
  Shield,
  Trash2,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export default function PoliciesPage() {
  const [profiles, setProfiles] = useState<PolicyProfile[]>([]);
  const [rules, setRules] = useState<PolicyRule[]>([]);
  const [allowlist, setAllowlist] = useState<PolicyAllowlistEntry[]>([]);
  const [ignoreGlobs, setIgnoreGlobs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("profiles");
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [hasChanges, setHasChanges] = useState(false);
  const [newAllowlistValue, setNewAllowlistValue] = useState("");
  const [newAllowlistType, setNewAllowlistType] = useState<
    "domain" | "endpoint" | "package"
  >("domain");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newIgnoreGlob, setNewIgnoreGlob] = useState("");

  useEffect(() => {
    async function loadPolicies() {
      setIsLoading(true);
      try {
        const data = await fetchPolicies();
        if (data) {
          setProfiles(data.profiles || []);
          setRules(data.rules || []);
          setAllowlist(data.allowlist || []);
          setIgnoreGlobs(data.ignoreGlobs || []);
          const defaultProfile = data.profiles?.find((p) => p.isDefault);
          if (defaultProfile) {
            setSelectedProfile(defaultProfile.id);
          } else if (data.profiles?.length > 0) {
            setSelectedProfile(data.profiles[0].id);
          }
        }
      } catch (error) {
        logger.error("Failed to load policies:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadPolicies();
  }, []);

  const getSeverityBadge = (severity: "off" | "warn" | "error") => {
    switch (severity) {
      case "off":
        return (
          <Badge variant="outline" className="text-muted-foreground border">
            Off
          </Badge>
        );
      case "warn":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            Warn
          </Badge>
        );
      case "error":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            Error
          </Badge>
        );
    }
  };

  const handleRuleSeverityChange = (
    ruleId: string,
    newSeverity: "off" | "warn" | "error",
  ) => {
    setRules(
      rules.map((r) => (r.id === ruleId ? { ...r, severity: newSeverity } : r)),
    );
    setHasChanges(true);
  };

  const handleAddAllowlist = () => {
    if (!newAllowlistValue.trim()) return;
    setAllowlist([
      ...allowlist,
      {
        type: newAllowlistType,
        value: newAllowlistValue,
        addedBy: "Unknown",
        addedAt: "Unknown",
      },
    ]);
    setNewAllowlistValue("");
    setHasChanges(true);
  };

  const handleRemoveAllowlist = (value: string) => {
    setAllowlist(allowlist.filter((a) => a.value !== value));
    setHasChanges(true);
  };

  const handleAddIgnoreGlob = () => {
    if (!newIgnoreGlob.trim()) return;
    setIgnoreGlobs([...ignoreGlobs, newIgnoreGlob]);
    setNewIgnoreGlob("");
    setHasChanges(true);
  };

  const handleRemoveIgnoreGlob = (glob: string) => {
    setIgnoreGlobs(ignoreGlobs.filter((g) => g !== glob));
    setHasChanges(true);
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    await updatePolicy("default", {
      profiles,
      rules,
      allowlist,
      ignoreGlobs,
    });
    setHasChanges(false);
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <p className="text-muted-foreground">Loading policies...</p>
        </div>
      </div>
    );
  }

  const selectedProfileData = profiles.find((p) => p.id === selectedProfile);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-blue-400" />
            Policies
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure enforcement rules, profiles, and allowlists for your
            organization
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge className="bg-yellow-500/20 text-yellow-400 mr-2">
              Unsaved changes
            </Badge>
          )}
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            disabled={!hasChanges || isSaving}
            onClick={handleSaveChanges}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="bg-card border">
          <TabsTrigger
            value="profiles"
            className="data-[state=active]:bg-muted"
          >
            <Zap className="w-4 h-4 mr-2" />
            Profiles
          </TabsTrigger>
          <TabsTrigger value="rules" className="data-[state=active]:bg-muted">
            <Shield className="w-4 h-4 mr-2" />
            Rule Severities
          </TabsTrigger>
          <TabsTrigger
            value="allowlists"
            className="data-[state=active]:bg-muted"
          >
            <Globe className="w-4 h-4 mr-2" />
            Allowlists
          </TabsTrigger>
          <TabsTrigger value="ignores" className="data-[state=active]:bg-muted">
            <FileCode className="w-4 h-4 mr-2" />
            Ignore Patterns
          </TabsTrigger>
          <TabsTrigger
            value="requirements"
            className="data-[state=active]:bg-muted"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Ship Requirements
          </TabsTrigger>
          <TabsTrigger
            value="permissions"
            className="data-[state=active]:bg-muted"
          >
            <Users className="w-4 h-4 mr-2" />
            Permissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profiles">
          {profiles.length === 0 ? (
            <Card className="bg-card/40 border backdrop-blur-sm">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Zap className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground/80 mb-2">
                  No profiles configured yet
                </h3>
                <p className="text-muted-foreground text-sm text-center max-w-md">
                  Profiles define gate settings for different environments.
                  Create your first profile to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                {profiles.map((profile) => (
                  <Card
                    key={profile.id}
                    className={`bg-card/40 border backdrop-blur-sm cursor-pointer transition-all ${
                      selectedProfile === profile.id
                        ? "ring-2 ring-blue-500"
                        : ""
                    }`}
                    onClick={() => setSelectedProfile(profile.id)}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-white">
                          {profile.name}
                        </CardTitle>
                        {profile.isDefault && (
                          <Badge className="bg-blue-500/20 text-blue-400">
                            Default
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-muted-foreground">
                        {profile.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          MockProof
                        </span>
                        {getSeverityBadge(profile.gates.mockproof.failOn)}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Reality Mode
                        </span>
                        {getSeverityBadge(profile.gates.reality.failOn)}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Airlock
                        </span>
                        {getSeverityBadge(profile.gates.airlock.failOn)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {selectedProfileData && (
                <Card className="bg-card/40 border backdrop-blur-sm mt-4">
                  <CardHeader>
                    <CardTitle className="text-white">
                      Profile Configuration
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Configure gates for the selected profile
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(["mockproof", "reality", "airlock"] as const).map(
                        (gateKey) => {
                          const gateNames = {
                            mockproof: "MockProof",
                            reality: "Reality Mode",
                            airlock: "Airlock",
                          };
                          const gate = selectedProfileData.gates[gateKey];
                          return (
                            <div
                              key={gateKey}
                              className="flex items-center justify-between p-4 rounded-lg bg-card/50 border"
                            >
                              <div className="flex items-center gap-3">
                                <Switch checked={gate.enabled} />
                                <div>
                                  <p className="font-medium text-foreground/90">
                                    {gateNames[gateKey]}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Enable this gate in the selected profile
                                  </p>
                                </div>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" className="border">
                                    Fail on:{" "}
                                    {gate.failOn.charAt(0).toUpperCase() +
                                      gate.failOn.slice(1)}
                                    <ChevronDown className="w-4 h-4 ml-2" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="bg-card border">
                                  <DropdownMenuItem>Off</DropdownMenuItem>
                                  <DropdownMenuItem>Warn</DropdownMenuItem>
                                  <DropdownMenuItem>Error</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="rules">
          <Card className="bg-card/40 border backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Rule Severities</CardTitle>
              <CardDescription className="text-muted-foreground">
                Configure severity level for each rule (off, warn, error)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground/80 mb-2">
                    No rules configured yet
                  </h3>
                  <p className="text-muted-foreground text-sm text-center max-w-md">
                    Rules define what checks are performed and their severity
                    levels.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border">
                      <TableHead className="text-muted-foreground">
                        Rule
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Category
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Description
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Severity
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id} className="border">
                        <TableCell className="font-mono text-sm text-foreground/90">
                          {rule.name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-muted-foreground border"
                          >
                            {rule.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {rule.description}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8">
                                {getSeverityBadge(rule.severity)}
                                <ChevronDown className="w-3 h-3 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-card border">
                              <DropdownMenuItem
                                onClick={() =>
                                  handleRuleSeverityChange(rule.id, "off")
                                }
                              >
                                <XCircle className="w-4 h-4 mr-2 text-muted-foreground" />{" "}
                                Off
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleRuleSeverityChange(rule.id, "warn")
                                }
                              >
                                <AlertTriangle className="w-4 h-4 mr-2 text-yellow-500" />{" "}
                                Warn
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleRuleSeverityChange(rule.id, "error")
                                }
                              >
                                <XCircle className="w-4 h-4 mr-2 text-red-500" />{" "}
                                Error
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allowlists">
          <Card className="bg-card/40 border backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Allowlists</CardTitle>
              <CardDescription className="text-muted-foreground">
                Trusted domains, endpoints, and packages that bypass certain
                checks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="border">
                      {newAllowlistType === "domain" && (
                        <Globe className="w-4 h-4 mr-2" />
                      )}
                      {newAllowlistType === "endpoint" && (
                        <Globe className="w-4 h-4 mr-2" />
                      )}
                      {newAllowlistType === "package" && (
                        <Package className="w-4 h-4 mr-2" />
                      )}
                      {newAllowlistType}
                      <ChevronDown className="w-4 h-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-card border">
                    <DropdownMenuItem
                      onClick={() => setNewAllowlistType("domain")}
                    >
                      <Globe className="w-4 h-4 mr-2" /> Domain
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setNewAllowlistType("endpoint")}
                    >
                      <Globe className="w-4 h-4 mr-2" /> Endpoint
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setNewAllowlistType("package")}
                    >
                      <Package className="w-4 h-4 mr-2" /> Package
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Input
                  placeholder="Enter value to allowlist..."
                  value={newAllowlistValue}
                  onChange={(e) => setNewAllowlistValue(e.target.value)}
                  className="flex-1 bg-card border"
                />
                <Button
                  onClick={handleAddAllowlist}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>

              {allowlist.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Globe className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground/80 mb-2">
                    No allowlist entries yet
                  </h3>
                  <p className="text-muted-foreground text-sm text-center max-w-md">
                    Add trusted domains, endpoints, or packages that should
                    bypass checks.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border">
                      <TableHead className="text-muted-foreground">
                        Type
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Value
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Reason
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Added By
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Date
                      </TableHead>
                      <TableHead className="text-muted-foreground"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allowlist.map((entry, i) => (
                      <TableRow key={i} className="border">
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-muted-foreground border capitalize"
                          >
                            {entry.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-foreground/90">
                          {entry.value}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {entry.reason || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {entry.addedBy}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {entry.addedAt}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300"
                            onClick={() => handleRemoveAllowlist(entry.value)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ignores">
          <Card className="bg-card/40 border backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Ignore Patterns</CardTitle>
              <CardDescription className="text-muted-foreground">
                Glob patterns for files that should be excluded from scanning
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ignoreGlobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FileCode className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground/80 mb-2">
                    No ignore patterns configured yet
                  </h3>
                  <p className="text-muted-foreground text-sm text-center max-w-md mb-4">
                    Add glob patterns for files that should be excluded from
                    scanning.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {ignoreGlobs.map((glob, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg bg-card/50 border"
                    >
                      <code className="font-mono text-sm text-foreground/80">
                        {glob}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => handleRemoveIgnoreGlob(glob)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-4">
                <Input
                  placeholder="Add glob pattern (e.g., **/*.mock.ts)"
                  className="bg-card border"
                  value={newIgnoreGlob}
                  onChange={(e) => setNewIgnoreGlob(e.target.value)}
                />
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={handleAddIgnoreGlob}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requirements">
          <Card className="bg-card/40 border backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Ship Requirements</CardTitle>
              <CardDescription className="text-muted-foreground">
                Required flows and checks that must pass for SHIP verdict
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-card/50 border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-medium text-foreground/90">
                      Environment Mode
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Which environment commands to use for verification
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="border">
                        next build + next start
                        <ChevronDown className="w-4 h-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-card border">
                      <DropdownMenuItem>next dev</DropdownMenuItem>
                      <DropdownMenuItem>
                        next build + next start
                      </DropdownMenuItem>
                      <DropdownMenuItem>Custom command</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-card/50 border">
                <p className="font-medium text-foreground/90 mb-3">
                  Required Flows
                </p>
                <div className="space-y-2">
                  {[
                    "Authentication Flow",
                    "Checkout Flow",
                    "User Profile Flow",
                  ].map((flow, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Switch defaultChecked={i < 2} />
                      <span className="text-sm text-foreground/80">{flow}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-card/50 border">
                <p className="font-medium text-foreground/90 mb-3">
                  Gate Requirements
                </p>
                <div className="space-y-2">
                  {[
                    "All MockProof checks must pass",
                    "Reality Mode verification required",
                    "No critical Airlock vulnerabilities",
                  ].map((req, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Switch defaultChecked />
                      <span className="text-sm text-foreground/80">{req}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <Card className="bg-card/40 border backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Policy Permissions</CardTitle>
              <CardDescription className="text-muted-foreground">
                Control who can modify policy settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  action: "Modify profiles",
                  roles: ["Admin", "Security Lead"],
                },
                {
                  action: "Change rule severities",
                  roles: ["Admin", "Security Lead", "Tech Lead"],
                },
                {
                  action: "Add to allowlist",
                  roles: ["Admin", "Security Lead"],
                },
                {
                  action: "Suppress findings",
                  roles: ["Admin", "Security Lead", "Developer"],
                },
                { action: "Override SHIP block", roles: ["Admin"] },
              ].map((perm, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 rounded-lg bg-card/50 border"
                >
                  <div className="flex items-center gap-3">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground/90">{perm.action}</span>
                  </div>
                  <div className="flex gap-2">
                    {perm.roles.map((role) => (
                      <Badge
                        key={role}
                        variant="outline"
                        className="text-muted-foreground border"
                      >
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
