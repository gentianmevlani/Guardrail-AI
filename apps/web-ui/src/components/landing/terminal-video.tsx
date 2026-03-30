"use client";

export function TerminalVideo() {
  return (
    <div className="w-full max-w-5xl mx-auto relative">
      {/* Glow effect behind terminal - optimized: static blur, GPU-accelerated pulse */}
      <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 rounded-2xl blur-2xl glow-pulse-optimized" />
      <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 rounded-xl blur-xl opacity-70" />

      <div className="relative bg-[#0d1117] rounded-xl border border-gray-800 overflow-hidden shadow-2xl shadow-cyan-500/20">
        {/* Animated border glow */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 opacity-50 blur-sm pointer-events-none" />

        {/* Terminal header */}
        <div className="relative flex items-center gap-2 px-4 py-3 bg-[#161b22] border-b border-gray-800">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57] shadow-[0_0_8px_rgba(255,95,87,0.5)]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e] shadow-[0_0_8px_rgba(254,188,46,0.5)]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840] shadow-[0_0_8px_rgba(40,200,64,0.5)]" />
          </div>
          <span className="text-xs text-gray-500 ml-2 font-mono flex items-center gap-2">
            guardrail scan
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
              <span className="text-green-500 text-[10px]">running</span>
            </span>
          </span>
        </div>

        {/* Terminal content - GIF */}
        <div className="relative overflow-hidden bg-black">
          <img
            src="/terminal-demo.gif"
            alt="guardrail CLI demo"
            className="w-full h-auto"
            loading="lazy"
          />
        </div>

        {/* Footer */}
        <div className="relative px-4 py-2 bg-[#161b22] border-t border-gray-800 flex items-center justify-between">
          <span className="text-[10px] text-gray-600 font-mono">v1.0.0</span>
          <span className="text-[10px] text-gray-600 font-mono flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.8)]" />
            secure
          </span>
        </div>
      </div>

      {/* Caption */}
      <p className="text-center text-xs text-gray-500 mt-4 italic relative z-10">
        Real-time security scanning in your terminal
      </p>
    </div>
  );
}
