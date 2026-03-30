"use client";
// guardrail-ignore-file: demo-mockup-contains-intentional-example-vulnerabilities

import styles from "./styles.module.css";

interface CodeMockupProps {
  variant: "clean" | "scanned";
}

interface CodeLineProps {
  lineNumber: number;
  code: string;
  vulnerability?: string | null;
}

function CodeLine({ lineNumber, code, vulnerability }: CodeLineProps) {
  if (!vulnerability) {
    return (
      <div className="flex py-0.5 hover:bg-slate-700/30 transition-colors">
        <span className="w-12 text-right pr-4 text-slate-500 select-none text-xs">
          {lineNumber}
        </span>
        <span className="text-slate-300 text-sm">{code}</span>
      </div>
    );
  }

  return (
    <div className="relative py-0.5 group">
      {/* Glow background */}
      <div className="absolute -inset-1 bg-red-500/20 rounded blur-sm" />
      <div className="absolute -inset-2 bg-red-500/10 rounded blur-md" />

      <div className={`relative flex ${styles.vulnerabilityGlow}`}>
        <span className="w-12 text-right pr-4 text-red-400/70 select-none text-xs">
          {lineNumber}
        </span>
        <span className="text-red-400 text-sm">{code}</span>
      </div>

      {/* Vulnerability label */}
      <span
        className="absolute right-4 top-1/2 -translate-y-1/2 
                   px-2 py-0.5 bg-red-500/20 border border-red-500/50 
                   rounded text-xs text-red-400 whitespace-nowrap
                   opacity-0 group-hover:opacity-100 transition-opacity
                   md:opacity-100"
      >
        ⚠️ {vulnerability}
      </span>
    </div>
  );
}

const codeLines = [
  { code: "import { db } from './database';", vulnerability: null },
  { code: "import express from 'express';", vulnerability: null },
  { code: "", vulnerability: null },
  { code: "const app = express();", vulnerability: null },
  { code: "", vulnerability: null },
  { code: "// API Configuration", vulnerability: null },
  {
    code: 'const API_KEY = "<hardcoded-secret-never-commit>";',
    vulnerability: "Hardcoded secret",
  },
  {
    code: 'const DB_PASSWORD = "admin123!";',
    vulnerability: "Hardcoded credential",
  },
  { code: "", vulnerability: null },
  { code: "app.get('/users/:id', async (req, res) => {", vulnerability: null },
  { code: "  const { id } = req.params;", vulnerability: null },
  {
    code: "  const query = `SELECT * FROM users WHERE id = ${id}`;",
    vulnerability: "SQL Injection",
  },
  { code: "  const user = await db.query(query);", vulnerability: null },
  { code: "  res.json(user);", vulnerability: null },
  { code: "});", vulnerability: null },
  { code: "", vulnerability: null },
  { code: "app.post('/data', (req, res) => {", vulnerability: null },
  {
    code: "  const data = JSON.parse(req.body.payload);",
    vulnerability: "Unsafe deserialization",
  },
  { code: "  processData(data);", vulnerability: null },
  { code: "});", vulnerability: null },
  { code: "", vulnerability: null },
  { code: "app.get('/file', (req, res) => {", vulnerability: null },
  { code: "  const path = req.query.path;", vulnerability: null },
  { code: "  res.sendFile(path);", vulnerability: "Path traversal" },
  { code: "});", vulnerability: null },
  { code: "", vulnerability: null },
  { code: "// TODO: Add authentication", vulnerability: "Missing auth" },
  { code: "app.listen(3000);", vulnerability: null },
];

export function CodeMockup({ variant }: CodeMockupProps) {
  const isScanned = variant === "scanned";

  return (
    <div
      className={`
        h-full w-full flex items-center justify-center p-4 md:p-8
        ${isScanned ? styles.scannedBackground : "bg-slate-900"}
      `}
    >
      {/* Scan grid overlay for scanned view */}
      {isScanned && (
        <div
          className={`absolute inset-0 ${styles.scanOverlay} pointer-events-none`}
        />
      )}

      <div
        className={`
          w-full max-w-4xl rounded-xl border 
          ${isScanned ? "border-cyan-500/30" : "border-slate-700"}
          ${styles.codeContainer} p-4 md:p-6 font-mono overflow-hidden
        `}
      >
        {/* Window header */}
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-700/50">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="text-slate-500 text-xs ml-2">server.js</span>
          {isScanned && (
            <span className="ml-auto text-cyan-400 text-xs flex items-center gap-1">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
              SCANNING...
            </span>
          )}
        </div>

        {/* Code content */}
        <div className="overflow-x-auto">
          {codeLines.map((line, index) => (
            <CodeLine
              key={index}
              lineNumber={index + 1}
              code={line.code}
              vulnerability={isScanned ? line.vulnerability : null}
            />
          ))}
        </div>

        {/* Scan results footer for scanned view */}
        {isScanned && (
          <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs">
              <span className="text-red-400">🔴 6 Critical Issues</span>
              <span className="text-yellow-400">🟡 2 Warnings</span>
            </div>
            <span className="text-cyan-400 text-xs">
              guardrail Security Scan
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
