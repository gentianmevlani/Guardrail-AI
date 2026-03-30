"use client";

import { LocalScanner } from "@/components/scanner";

export default function ScanPage() {
  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Upload & Scan</h1>
        <p className="text-slate-400">
          Scan your local files for security issues, mock data, and code quality problems.
          All scanning happens in your browser - your code never leaves your device.
        </p>
      </div>

      <LocalScanner />

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
          <h3 className="font-semibold text-white mb-2">🔒 Privacy First</h3>
          <p className="text-sm text-slate-400">
            Client-side scanning means your code stays on your machine. No uploads unless you explicitly request a deep scan.
          </p>
        </div>
        <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
          <h3 className="font-semibold text-white mb-2">⚡ Fast Analysis</h3>
          <p className="text-sm text-slate-400">
            Web Workers ensure the UI stays responsive while scanning. Process 50+ files in seconds.
          </p>
        </div>
        <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
          <h3 className="font-semibold text-white mb-2">🔧 Auto-Fix</h3>
          <p className="text-sm text-slate-400">
            Many issues can be automatically fixed. Preview changes before applying and download fixed files.
          </p>
        </div>
      </div>

      <div className="mt-8 bg-slate-800/30 rounded-lg p-6 border border-slate-700/50">
        <h3 className="font-semibold text-white mb-4">What We Detect</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <h4 className="text-cyan-400 font-medium mb-2">Mock Data</h4>
            <ul className="text-slate-400 space-y-1">
              <li>• Lorem ipsum text</li>
              <li>• Test email addresses</li>
              <li>• Fake phone numbers</li>
              <li>• Placeholder names</li>
            </ul>
          </div>
          <div>
            <h4 className="text-cyan-400 font-medium mb-2">Placeholder APIs</h4>
            <ul className="text-slate-400 space-y-1">
              <li>• Localhost URLs</li>
              <li>• Example.com links</li>
              <li>• Test API endpoints</li>
              <li>• Mock services</li>
            </ul>
          </div>
          <div>
            <h4 className="text-cyan-400 font-medium mb-2">Hardcoded Secrets</h4>
            <ul className="text-slate-400 space-y-1">
              <li>• API keys</li>
              <li>• AWS credentials</li>
              <li>• Database URIs</li>
              <li>• Private keys</li>
            </ul>
          </div>
          <div>
            <h4 className="text-cyan-400 font-medium mb-2">Debug Code</h4>
            <ul className="text-slate-400 space-y-1">
              <li>• console.log statements</li>
              <li>• debugger keywords</li>
              <li>• alert() calls</li>
              <li>• Python print()</li>
            </ul>
          </div>
          <div>
            <h4 className="text-cyan-400 font-medium mb-2">TODO/FIXME</h4>
            <ul className="text-slate-400 space-y-1">
              <li>• TODO comments</li>
              <li>• FIXME markers</li>
              <li>• HACK notes</li>
              <li>• BUG annotations</li>
            </ul>
          </div>
          <div>
            <h4 className="text-cyan-400 font-medium mb-2">Supported Files</h4>
            <ul className="text-slate-400 space-y-1">
              <li>• .js, .jsx, .ts, .tsx</li>
              <li>• .py (Python)</li>
              <li>• .json, .env</li>
              <li>• .yaml, .yml</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
