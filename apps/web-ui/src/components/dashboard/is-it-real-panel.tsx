"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Play, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useState } from "react";

interface ActionResult {
  action: string;
  isReal: boolean | null;
  details: string[];
  apiCalls: Array<{
    method: string;
    endpoint: string;
    status: number | null;
    hasData: boolean;
  }>;
  dbWrites: boolean;
  emailSent: boolean;
}

const predefinedActions = [
  { id: "save", label: "Save", icon: "💾" },
  { id: "submit", label: "Submit", icon: "📤" },
  { id: "checkout", label: "Checkout", icon: "🛒" },
  { id: "login", label: "Login", icon: "🔐" },
  { id: "delete", label: "Delete", icon: "🗑️" },
];

export function IsItRealPanel() {
  const [selectedAction, setSelectedAction] = useState("save");
  const [customAction, setCustomAction] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const handleAnalyze = async () => {
    const action = customAction || selectedAction;
    if (!action) return;

    setAnalyzing(true);
    setResult(null);

    // In production, this would call the backend API
    // For now, show a loading state
    await new Promise((r) => setTimeout(r, 1500));

    // Return a placeholder result until backend is connected
    const placeholderResult: ActionResult = {
      action: customAction || selectedAction,
      isReal: null,
      details: [
        "⚠️ Analysis not available",
        "⚠️ Backend connection required",
        "⚠️ Configure API endpoints",
      ],
      apiCalls: [],
      dbWrites: false,
      emailSent: false,
    };

    setResult(placeholderResult);
    setAnalyzing(false);
  };

  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Is It Real?</CardTitle>
        <p className="text-sm text-muted-foreground">
          Test if your UI components are connected to real APIs or just mock data
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <label className="text-sm font-medium text-foreground">
            Select Action to Test
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {predefinedActions.map((action) => (
              <Button
                key={action.id}
                variant={selectedAction === action.id ? "default" : "outline"}
                onClick={() => setSelectedAction(action.id)}
                className="justify-start"
              >
                <span className="mr-2">{action.icon}</span>
                {action.label}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Or enter custom action
            </label>
            <Input
              placeholder="e.g., Update Profile, Export Data..."
              value={customAction}
              onChange={(e) => setCustomAction(e.target.value)}
              className="bg-background border-border"
            />
          </div>
        </div>

        <Button
          onClick={handleAnalyze}
          disabled={analyzing || (!selectedAction && !customAction)}
          className="w-full"
        >
          {analyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Test Reality
            </>
          )}
        </Button>

        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-medium text-foreground">
                {result.action}
              </h3>
              {result.isReal === true && (
                <CheckCircle className="h-5 w-5 text-green-400" />
              )}
              {result.isReal === false && (
                <XCircle className="h-5 w-5 text-red-400" />
              )}
              {result.isReal === null && (
                <AlertCircle className="h-5 w-5 text-yellow-400" />
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Analysis</h4>
              <ul className="space-y-1">
                {result.details.map((detail, index) => (
                  <li key={index} className="text-sm text-foreground">
                    {detail}
                  </li>
                ))}
              </ul>
            </div>

            {result.apiCalls.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">API Calls</h4>
                <div className="space-y-1">
                  {result.apiCalls.map((call, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded"
                    >
                      <span className="font-mono text-foreground">
                        {call.method} {call.endpoint}
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          call.status === 200
                            ? "bg-green-500/20 text-green-400"
                            : call.status === null
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {call.status === 200
                          ? "Success"
                          : call.status === null
                          ? "Unknown"
                          : `Error ${call.status}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Database:</span>
                <span className={result.dbWrites ? "text-green-400" : "text-red-400"}>
                  {result.dbWrites ? "Writes detected" : "No writes"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Email:</span>
                <span className={result.emailSent ? "text-green-400" : "text-red-400"}>
                  {result.emailSent ? "Sent" : "Not sent"}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
