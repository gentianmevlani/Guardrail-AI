"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Shield, Smartphone, Lock, AlertTriangle, Copy, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Image from "next/image";
import { logger } from "@/lib/logger";

// Form schemas
const verifyMfaSchema = z.object({
  token: z.string().length(6, "Verification code must be 6 digits"),
});

const disableMfaSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export function SecuritySettings() {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setupStep, setSetupStep] = useState<"initial" | "qr" | "backup">("initial");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const { toast } = useToast();

  const verifyForm = useForm<z.infer<typeof verifyMfaSchema>>({
    resolver: zodResolver(verifyMfaSchema),
    defaultValues: { token: "" },
  });

  const disableForm = useForm<z.infer<typeof disableMfaSchema>>({
    resolver: zodResolver(disableMfaSchema),
    defaultValues: { password: "" },
  });

  useEffect(() => {
    fetchMfaStatus();
  }, []);

  const fetchMfaStatus = async () => {
    try {
      const res = await fetch("/api/mfa/status");
      if (res.ok) {
        const data = await res.json();
        setMfaEnabled(data.data.enabled);
      }
    } catch (error) {
      logger.logUnknownError("Failed to fetch MFA status", error);
    } finally {
      setLoading(false);
    }
  };

  const startMfaSetup = async () => {
    try {
      const res = await fetch("/api/mfa/setup", { method: "POST" });
      const data = await res.json();
      
      if (res.ok) {
        setQrCodeUrl(data.data.qrCodeUrl);
        setSecret(data.data.secret);
        setBackupCodes(data.data.backupCodes);
        setSetupStep("qr");
        setShowSetupDialog(true);
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to start MFA setup",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start MFA setup",
        variant: "destructive",
      });
    }
  };

  const onVerifySubmit = async (values: z.infer<typeof verifyMfaSchema>) => {
    try {
      const res = await fetch("/api/mfa/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setMfaEnabled(true);
        setSetupStep("backup");
        toast({
          title: "MFA Enabled",
          description: "Multi-factor authentication has been successfully enabled.",
        });
      } else {
        toast({
          title: "Verification Failed",
          description: data.error || "Invalid verification code",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to verify MFA setup",
        variant: "destructive",
      });
    }
  };

  const onDisableSubmit = async (values: z.infer<typeof disableMfaSchema>) => {
    try {
      const res = await fetch("/api/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setMfaEnabled(false);
        setShowDisableDialog(false);
        disableForm.reset();
        toast({
          title: "MFA Disabled",
          description: "Multi-factor authentication has been disabled.",
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to disable MFA",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to disable MFA",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Copied to clipboard",
    });
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading security settings...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border glass-card">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5 text-teal-400" />
            Multi-Factor Authentication
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-card/50">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${mfaEnabled ? 'bg-green-500/10' : 'bg-muted'}`}>
                <Smartphone className={`h-6 w-6 ${mfaEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <h3 className="font-medium text-foreground">Authenticator App</h3>
                <p className="text-sm text-muted-foreground">
                  {mfaEnabled 
                    ? "Your account is protected with an authenticator app." 
                    : "Secure your account with Google Authenticator or Authy."}
                </p>
              </div>
            </div>
            
            {mfaEnabled ? (
              <Button 
                variant="outline" 
                className="border-red-900/50 hover:bg-red-900/20 text-red-500"
                onClick={() => setShowDisableDialog(true)}
              >
                Disable
              </Button>
            ) : (
              <Button 
                className="bg-teal-600 hover:bg-teal-700"
                onClick={startMfaSetup}
              >
                Enable MFA
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={(open) => {
        if (!open && setupStep === "backup") {
          setShowSetupDialog(false);
          setSetupStep("initial");
        } else if (!open && setupStep !== "backup") {
          // Prevent closing if in middle of setup unless explicit cancel? 
          // For UX, let them close, but warn maybe? sticking to simple for now.
          setShowSetupDialog(false);
          setSetupStep("initial");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          {setupStep === "qr" && (
            <>
              <DialogHeader>
                <DialogTitle>Set up Authenticator</DialogTitle>
                <DialogDescription>
                  Scan this QR code with your authenticator app (like Google Authenticator or Authy).
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center justify-center space-y-6 py-4">
                <div className="bg-white p-4 rounded-lg">
                  {qrCodeUrl && <Image src={qrCodeUrl} alt="MFA QR Code" width={192} height={192} />}
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">Can't scan?</p>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-2 py-1 rounded text-xs">{secret}</code>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(secret)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                <Form {...verifyForm}>
                  <form onSubmit={verifyForm.handleSubmit(onVerifySubmit)} className="w-full space-y-4">
                    <FormField
                      control={verifyForm.control}
                      name="token"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Verification Code</FormLabel>
                          <FormControl>
                            <Input placeholder="000000" {...field} className="text-center tracking-widest text-lg" maxLength={6} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700">Verify & Enable</Button>
                  </form>
                </Form>
              </div>
            </>
          )}

          {setupStep === "backup" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  MFA Enabled Successfully
                </DialogTitle>
                <DialogDescription>
                  Save these backup codes in a secure place. You can use them to access your account if you lose your device.
                </DialogDescription>
              </DialogHeader>
              <div className="bg-muted/50 p-4 rounded-lg border border-border">
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, i) => (
                    <code key={i} className="text-sm font-mono p-1">{code}</code>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button 
                  className="w-full" 
                  onClick={() => {
                    const text = backupCodes.join("\n");
                    copyToClipboard(text);
                  }}
                  variant="outline"
                >
                  <Copy className="mr-2 h-4 w-4" /> Copy All
                </Button>
                <Button className="w-full bg-teal-600 hover:bg-teal-700" onClick={() => setShowSetupDialog(false)}>
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Disable MFA?
            </DialogTitle>
            <DialogDescription>
              This will remove the extra layer of security from your account. You will need to re-enter your password to confirm.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...disableForm}>
            <form onSubmit={disableForm.handleSubmit(onDisableSubmit)} className="space-y-4">
              <FormField
                control={disableForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDisableDialog(false)}>Cancel</Button>
                <Button type="submit" variant="destructive">Disable MFA</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
