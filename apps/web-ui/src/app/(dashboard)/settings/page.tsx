"use client";

import { GitHubIntegrationCard } from "@/components/dashboard/github-integration-card";
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  getScanPreferences,
  updateScanPreferences,
  getAppearancePreferences,
  updateAppearancePreferences,
} from "@/lib/api";
import { logger } from "@/lib/logger";
import {
  AlertTriangle,
  Bell,
  Palette,
  Shield,
  Trash2,
  Webhook,
  Lock,
  Loader2,
} from "lucide-react";
import { GitHubAppStatus } from "@/components/settings/github-app-status";
import { SecuritySettings } from "@/components/settings/security-settings";
import { WebhookConfiguration } from "@/components/settings/WebhookConfiguration";
import { SettingsSkeleton, WebhooksSkeleton, SecuritySkeleton } from "@/components/settings/settings-skeleton";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

// Form schemas
const notificationsSchema = z.object({
  emailNotifications: z.boolean(),
  inAppNotifications: z.boolean(),
  slackWebhook: z.string().url().optional().or(z.literal("")),
  weeklyDigest: z.boolean(),
  securityAlerts: z.boolean(),
  scanComplete: z.boolean(),
  teamInvites: z.boolean(),
});

const scanPreferencesSchema = z.object({
  scanDepth: z.enum(["quick", "standard", "deep"]),
  autoScan: z.boolean(),
  ignoredPaths: z.string(),
  severityThreshold: z.enum(["low", "medium", "high", "critical"]),
  parallelScans: z.boolean(),
  timeoutMinutes: z.number().min(1).max(60),
});

const appearanceSchema = z.object({
  theme: z.enum(["dark", "light", "system"]),
  compactMode: z.boolean(),
  sidebarCollapsed: z.boolean(),
  codeSyntaxHighlighting: z.boolean(),
  animationsEnabled: z.boolean(),
});

const webhooksSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()),
  secret: z.string(),
  active: z.boolean(),
});

// Force dynamic rendering
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingScan, setSavingScan] = useState(false);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const { toast } = useToast();

  // Notification form
  const notificationsForm = useForm<z.infer<typeof notificationsSchema>>({
    resolver: zodResolver(notificationsSchema),
    defaultValues: {
      emailNotifications: true,
      inAppNotifications: true,
      slackWebhook: "",
      weeklyDigest: true,
      securityAlerts: true,
      scanComplete: false,
      teamInvites: true,
    },
  });

  // Scan preferences form
  const scanForm = useForm<z.infer<typeof scanPreferencesSchema>>({
    resolver: zodResolver(scanPreferencesSchema),
    defaultValues: {
      scanDepth: "standard",
      autoScan: false,
      ignoredPaths: "*.log\nnode_modules/\n.env*\ncoverage/",
      severityThreshold: "medium",
      parallelScans: true,
      timeoutMinutes: 30,
    },
  });

  // Appearance form
  const appearanceForm = useForm<z.infer<typeof appearanceSchema>>({
    resolver: zodResolver(appearanceSchema),
    defaultValues: {
      theme: "dark",
      compactMode: false,
      sidebarCollapsed: false,
      codeSyntaxHighlighting: true,
      animationsEnabled: true,
    },
  });

  // Load preferences on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        setLoading(true);
        const [notifications, scanPrefs, appearance] = await Promise.all([
          getNotificationPreferences(),
          getScanPreferences(),
          getAppearancePreferences(),
        ]);

        notificationsForm.reset(notifications);
        scanForm.reset(scanPrefs);
        appearanceForm.reset(appearance);
      } catch (error) {
        logger.error("Failed to load preferences:", error);
        toast({
          title: "Error",
          description: "Failed to load settings. Using defaults.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
    loadPreferences();
  }, []);

  const onNotificationsSubmit = async (
    values: z.infer<typeof notificationsSchema>,
  ) => {
    setSavingNotifications(true);
    try {
      await updateNotificationPreferences(values);
      toast({
        title: "Notification settings updated",
        description: "Your notification preferences have been saved.",
      });
    } catch (error) {
      logger.error("Failed to update notifications:", error);
      toast({
        title: "Error",
        description: "Failed to save notification preferences.",
        variant: "destructive",
      });
    } finally {
      setSavingNotifications(false);
    }
  };

  const onScanSubmit = async (
    values: z.infer<typeof scanPreferencesSchema>,
  ) => {
    setSavingScan(true);
    try {
      await updateScanPreferences(values);
      toast({
        title: "Scan preferences updated",
        description: "Your scan settings have been saved.",
      });
    } catch (error) {
      logger.error("Failed to update scan preferences:", error);
      toast({
        title: "Error",
        description: "Failed to save scan preferences.",
        variant: "destructive",
      });
    } finally {
      setSavingScan(false);
    }
  };

  const onAppearanceSubmit = async (
    values: z.infer<typeof appearanceSchema>,
  ) => {
    setSavingAppearance(true);
    try {
      await updateAppearancePreferences(values);
      toast({
        title: "Appearance settings updated",
        description: "Your theme preferences have been saved.",
      });
    } catch (error) {
      logger.error("Failed to update appearance:", error);
      toast({
        title: "Error",
        description: "Failed to save appearance preferences.",
        variant: "destructive",
      });
    } finally {
      setSavingAppearance(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/delete-account`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to initiate account deletion");
      }

      toast({
        title: "Account deletion requested",
        description: "You'll receive an email to confirm account deletion.",
        variant: "destructive",
      });
      setShowDeleteAccount(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initiate account deletion. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDisconnectRepo = async (repoId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/repositories/${repoId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to disconnect repository");
      }

      toast({
        title: "Repository disconnected",
        description: "The repository has been removed from your account.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to disconnect repository. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteScanHistory = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/scan-history`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to delete scan history");
      }

      toast({
        title: "Scan history deleted",
        description: "All scan history has been permanently removed.",
        variant: "destructive",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete scan history. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/10">
              <Shield className="h-6 w-6 text-teal-400" />
            </div>
            Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your account and application preferences
          </p>
        </div>
      </div>

      <Tabs defaultValue="notifications" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 bg-card border-border">
          <TabsTrigger
            value="notifications"
            className="data-[state=active]:bg-muted"
          >
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="data-[state=active]:bg-muted"
          >
            <Lock className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger
            value="scanning"
            className="data-[state=active]:bg-muted"
          >
            <Shield className="w-4 h-4 mr-2" />
            Scanning
          </TabsTrigger>
          <TabsTrigger
            value="appearance"
            className="data-[state=active]:bg-muted"
          >
            <Palette className="w-4 h-4 mr-2" />
            Appearance
          </TabsTrigger>
          <TabsTrigger
            value="webhooks"
            className="data-[state=active]:bg-muted"
          >
            <Webhook className="w-4 h-4 mr-2" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="danger" className="data-[state=active]:bg-muted">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Danger Zone
          </TabsTrigger>
        </TabsList>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="bg-card border-border glass-card">
            <CardHeader>
              <CardTitle className="text-foreground">
                Notification Preferences
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Control how and when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...notificationsForm}>
                <form
                  onSubmit={notificationsForm.handleSubmit(
                    onNotificationsSubmit,
                  )}
                  className="space-y-6"
                >
                  <div className="grid gap-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base font-medium text-foreground">
                          Email Notifications
                        </FormLabel>
                        <FormDescription className="text-sm text-muted-foreground">
                          Receive notifications via email
                        </FormDescription>
                      </div>
                      <FormField
                        control={notificationsForm.control}
                        name="emailNotifications"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base font-medium text-foreground">
                          In-App Notifications
                        </FormLabel>
                        <FormDescription className="text-sm text-muted-foreground">
                          Show notifications in the application
                        </FormDescription>
                      </div>
                      <FormField
                        control={notificationsForm.control}
                        name="inAppNotifications"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={notificationsForm.control}
                      name="slackWebhook"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium text-foreground">
                            Slack Webhook URL
                          </FormLabel>
                          <FormDescription className="text-sm text-muted-foreground">
                            Send notifications to your Slack workspace
                          </FormDescription>
                          <FormControl>
                            <Input
                              placeholder="https://hooks.slack.com/services/..."
                              {...field}
                              className="bg-muted/50 border-border"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-foreground/80">
                        Notification Types
                      </h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm text-muted-foreground">
                            Weekly Digest
                          </Label>
                          <FormField
                            control={notificationsForm.control}
                            name="weeklyDigest"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-sm text-muted-foreground">
                            Security Alerts
                          </Label>
                          <FormField
                            control={notificationsForm.control}
                            name="securityAlerts"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-sm text-muted-foreground">
                            Scan Complete
                          </Label>
                          <FormField
                            control={notificationsForm.control}
                            name="scanComplete"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-sm text-muted-foreground">
                            Team Invites
                          </Label>
                          <FormField
                            control={notificationsForm.control}
                            name="teamInvites"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="bg-teal-600 hover:bg-teal-700"
                    disabled={savingNotifications}
                  >
                    {savingNotifications && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {savingNotifications ? "Saving..." : "Save Notification Settings"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <SecuritySettings />
        </TabsContent>

        {/* Scanning Tab */}
        <TabsContent value="scanning" className="space-y-6">
          <Card className="bg-card border-border glass-card">
            <CardHeader>
              <CardTitle className="text-foreground">
                Scan Preferences
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Configure how scans are performed and what they detect
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...scanForm}>
                <form
                  onSubmit={scanForm.handleSubmit(onScanSubmit)}
                  className="space-y-6"
                >
                  <div className="grid gap-6">
                    <FormField
                      control={scanForm.control}
                      name="scanDepth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium text-foreground">
                            Scan Depth
                          </FormLabel>
                          <FormDescription className="text-sm text-muted-foreground">
                            How thoroughly should we analyze your code
                          </FormDescription>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="bg-muted/50 border-border">
                                <SelectValue placeholder="Select scan depth" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="quick">
                                Quick - Surface level analysis
                              </SelectItem>
                              <SelectItem value="standard">
                                Standard - Balanced analysis
                              </SelectItem>
                              <SelectItem value="deep">
                                Deep - Comprehensive analysis
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base font-medium text-foreground">
                          Auto-Scan on Push
                        </FormLabel>
                        <FormDescription className="text-sm text-muted-foreground">
                          Automatically run scans when code is pushed
                        </FormDescription>
                      </div>
                      <FormField
                        control={scanForm.control}
                        name="autoScan"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={scanForm.control}
                      name="ignoredPaths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium text-foreground">
                            Ignored Paths
                          </FormLabel>
                          <FormDescription className="text-sm text-muted-foreground">
                            Files and directories to exclude from scans (one per
                            line)
                          </FormDescription>
                          <FormControl>
                            <Textarea
                              placeholder="*.log&#10;node_modules/&#10;.env*&#10;coverage/"
                              className="bg-card/50 border min-h-[100px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={scanForm.control}
                      name="severityThreshold"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium text-foreground">
                            Severity Threshold
                          </FormLabel>
                          <FormDescription className="text-sm text-muted-foreground">
                            Minimum severity level to report
                          </FormDescription>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="bg-muted/50 border-border">
                                <SelectValue placeholder="Select threshold" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">
                                Low - Report all issues
                              </SelectItem>
                              <SelectItem value="medium">
                                Medium - Report medium and above
                              </SelectItem>
                              <SelectItem value="high">
                                High - Report high and critical only
                              </SelectItem>
                              <SelectItem value="critical">
                                Critical - Report critical issues only
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base font-medium text-foreground">
                          Parallel Scans
                        </FormLabel>
                        <FormDescription className="text-sm text-muted-foreground">
                          Run multiple scans simultaneously for faster results
                        </FormDescription>
                      </div>
                      <FormField
                        control={scanForm.control}
                        name="parallelScans"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={scanForm.control}
                      name="timeoutMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium text-foreground">
                            Scan Timeout (minutes)
                          </FormLabel>
                          <FormDescription className="text-sm text-muted-foreground">
                            Maximum time a scan can run before timing out
                          </FormDescription>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="60"
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value))
                              }
                              className="bg-muted/50 border-border"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="bg-teal-600 hover:bg-teal-700"
                    disabled={savingScan}
                  >
                    {savingScan && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {savingScan ? "Saving..." : "Save Scan Settings"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <Card className="bg-card border-border glass-card">
            <CardHeader>
              <CardTitle className="text-foreground">
                Appearance Settings
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Customize the look and feel of the application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...appearanceForm}>
                <form
                  onSubmit={appearanceForm.handleSubmit(onAppearanceSubmit)}
                  className="space-y-6"
                >
                  <div className="grid gap-6">
                    <FormField
                      control={appearanceForm.control}
                      name="theme"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium text-foreground">
                            Theme
                          </FormLabel>
                          <FormDescription className="text-sm text-muted-foreground">
                            Choose your preferred color scheme
                          </FormDescription>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="bg-muted/50 border-border">
                                <SelectValue placeholder="Select theme" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="dark">Dark</SelectItem>
                              <SelectItem value="light">Light</SelectItem>
                              <SelectItem value="system">System</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base font-medium text-foreground">
                          Compact Mode
                        </FormLabel>
                        <FormDescription className="text-sm text-muted-foreground">
                          Use more compact layouts and spacing
                        </FormDescription>
                      </div>
                      <FormField
                        control={appearanceForm.control}
                        name="compactMode"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base font-medium text-foreground">
                          Sidebar Collapsed by Default
                        </FormLabel>
                        <FormDescription className="text-sm text-muted-foreground">
                          Keep the sidebar collapsed when you open the app
                        </FormDescription>
                      </div>
                      <FormField
                        control={appearanceForm.control}
                        name="sidebarCollapsed"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base font-medium text-foreground">
                          Code Syntax Highlighting
                        </FormLabel>
                        <FormDescription className="text-sm text-muted-foreground">
                          Enable syntax highlighting in code displays
                        </FormDescription>
                      </div>
                      <FormField
                        control={appearanceForm.control}
                        name="codeSyntaxHighlighting"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base font-medium text-foreground">
                          Animations
                        </FormLabel>
                        <FormDescription className="text-sm text-muted-foreground">
                          Enable UI animations and transitions
                        </FormDescription>
                      </div>
                      <FormField
                        control={appearanceForm.control}
                        name="animationsEnabled"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="bg-teal-600 hover:bg-teal-700"
                    disabled={savingAppearance}
                  >
                    {savingAppearance && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {savingAppearance ? "Saving..." : "Save Appearance Settings"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="space-y-6">
          <WebhookConfiguration />
        </TabsContent>

        {/* Danger Zone Tab */}
        <TabsContent value="danger" className="space-y-6">
          {/* GitHub App Status */}
          <GitHubAppStatus />

          {/* GitHub Integration */}
          <Card className="bg-card border-border glass-card">
            <CardHeader>
              <CardTitle className="text-foreground">
                GitHub Integration
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Manage your connected repositories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GitHubIntegrationCard
                variant="full"
                showRepos={true}
                maxRepos={10}
              />
            </CardContent>
          </Card>

          {/* Danger Zone Actions */}
          <Card className="bg-red-950/20 border-red-900/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Danger Zone
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Irreversible actions that affect your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border border-border rounded-lg p-4 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-foreground font-medium">
                      Delete Scan History
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete all historical scan data and reports
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteScanHistory}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete History
                  </Button>
                </div>
              </div>

              <div className="border border-border rounded-lg p-4 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-foreground font-medium">
                      Disconnect All Repositories
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Remove all repository connections and revoke access
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => handleDisconnectRepo("all")}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Disconnect All
                  </Button>
                </div>
              </div>

              <div className="border border-red-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-medium flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      Delete Account
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete your account and all associated data
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteAccount(true)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Delete Account
                  </Button>
                </div>
              </div>

              {showDeleteAccount && (
                <div className="border border-red-900/50 rounded-lg p-4 bg-red-950/30">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-white font-medium mb-2">
                        Confirm Account Deletion
                      </h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        This action cannot be undone. All your data will be
                        permanently deleted.
                      </p>
                      <div className="flex items-center gap-4">
                        <Button
                          variant="destructive"
                          onClick={handleDeleteAccount}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Yes, Delete My Account
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowDeleteAccount(false)}
                          className="border"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
