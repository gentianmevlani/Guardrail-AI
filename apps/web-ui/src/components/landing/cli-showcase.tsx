'use client';

import { useState, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Shield, Lock, FileCheck, AlertTriangle, Terminal, ChevronRight } from 'lucide-react';
import { STRIPE_LIVE_PREFIX } from 'guardrail-security/secrets/stripe-placeholder-prefix';

function TerminalWindow({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5, delay }}
      className="bg-[#0d1117] rounded-xl border border-gray-800 overflow-hidden shadow-2xl"
    >
      <div className="flex items-center gap-2 px-4 py-3 bg-[#161b22] border-b border-gray-800">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-xs text-gray-500 ml-2 font-mono">{title}</span>
      </div>
      
      <div className="p-4 font-mono text-[11px] leading-relaxed overflow-x-auto">
        {children}
      </div>
    </motion.div>
  );
}

const Line = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`${className}`}>{children}</div>
);

const Cyan = ({ children }: { children: React.ReactNode }) => <span className="text-cyan-400">{children}</span>;
const Green = ({ children }: { children: React.ReactNode }) => <span className="text-green-400">{children}</span>;
const Yellow = ({ children }: { children: React.ReactNode }) => <span className="text-yellow-400">{children}</span>;
const Red = ({ children }: { children: React.ReactNode }) => <span className="text-red-400">{children}</span>;
const Gray = ({ children }: { children: React.ReactNode }) => <span className="text-gray-500">{children}</span>;
const White = ({ children }: { children: React.ReactNode }) => <span className="text-white font-semibold">{children}</span>;
const Blue = ({ children }: { children: React.ReactNode }) => <span className="text-blue-400">{children}</span>;

function SecurityScanOutput() {
  return (
    <TerminalWindow title="Terminal — guardrail scan" delay={0}>
      <div>
        <Cyan>┌─────────────────────────────────────────────────────────────┐</Cyan>
      </div>
      <div><Cyan>│</Cyan>                    <White>SECURITY SCAN</White>                           <Cyan>│</Cyan></div>
      <div><Cyan>└─────────────────────────────────────────────────────────────┘</Cyan></div>
      
      <div className="mt-3 space-y-1">
        <Line><Gray>  Project:</Gray>    my-app</Line>
        <Line><Gray>  Path:</Gray>       /home/user/projects/my-app</Line>
        <Line><Gray>  Scan Type:</Gray>  all</Line>
      </div>
      
      <div className="mt-3 space-y-1">
        <Line><Green>✓</Green> Analyzed 847 files</Line>
        <Line><Green>✓</Green> Secret scan complete</Line>
        <Line><Green>✓</Green> Dependency check complete</Line>
        <Line><Green>✓</Green> Compliance check complete</Line>
      </div>
      
      <div className="mt-4">
        <Cyan>┌─────────────────────────────────────────────────────────────┐</Cyan>
      </div>
      <div><Cyan>│</Cyan>                    <White>SCAN RESULTS</White>                            <Cyan>│</Cyan></div>
      <div><Cyan>└─────────────────────────────────────────────────────────────┘</Cyan></div>
      
      <div className="mt-3 space-y-1">
        <Line><Gray>  Files scanned:</Gray>  847</Line>
        <Line><Gray>  Duration:</Gray>       3.2s</Line>
        <Line><Gray>  Total issues:</Gray>   4</Line>
      </div>
      
      <div className="mt-3 space-y-1">
        <Line>  <span className="bg-red-600 text-white px-1 text-[10px]"> CRITICAL </span>   0</Line>
        <Line>  <Red>HIGH</Red>        1 <Red>██████████</Red></Line>
        <Line>  <Yellow>MEDIUM</Yellow>      2 <Yellow>████████████████████</Yellow></Line>
        <Line>  <Blue>LOW</Blue>         1 <Blue>██████████</Blue></Line>
      </div>
      
      <div className="mt-4">
        <Cyan>  FINDINGS:</Cyan>
      </div>
      
      <div className="mt-2 space-y-3">
        <div>
          <Line>  <Red>HIGH</Red> Potential API key detected</Line>
          <Line>  <Gray>├─</Gray> <Blue>File:</Blue> src/config/api.ts:24</Line>
          <Line>  <Gray>├─</Gray> <Blue>Category:</Blue> Hardcoded Secrets</Line>
          <Line>  <Gray>└─</Gray> <Blue>Fix:</Blue> Use environment variables</Line>
        </div>
        
        <div>
          <Line>  <Yellow>MEDIUM</Yellow> axios@0.21.1 has known vulnerabilities</Line>
          <Line>  <Gray>├─</Gray> <Blue>CVE:</Blue> CVE-2021-3749</Line>
          <Line>  <Gray>└─</Gray> <Blue>Fix:</Blue> Upgrade to axios@1.6.0</Line>
        </div>
      </div>
      
      <div className="mt-4">
        <Line>  <Yellow>⚠</Yellow> <White>Action required:</White> Address 1 high-priority issue.</Line>
      </div>
    </TerminalWindow>
  );
}

function ComplianceOutput() {
  return (
    <TerminalWindow title="Terminal — guardrail scan:compliance" delay={0.15}>
      <div>
        <Cyan>📋 SOC2 COMPLIANCE ASSESSMENT</Cyan>
      </div>
      
      <div className="mt-3">
        <Line><Green>✓</Green> SOC2 assessment complete</Line>
      </div>
      
      <div className="mt-3">
        <Line>  <White>Overall Score:</White> <Green>78%</Green></Line>
      </div>
      
      <div className="mt-3">
        <Cyan>  CATEGORIES:</Cyan>
      </div>
      
      <div className="mt-2 space-y-1">
        <Line>  <Green>✓</Green> Access Control         <Green>85%</Green> (10/12 checks)</Line>
        <Line>  <Green>✓</Green> Data Encryption        <Green>92%</Green> (7/8 checks)</Line>
        <Line>  <Yellow>⚠</Yellow> Audit Logging          <Yellow>65%</Yellow> (6/10 checks)</Line>
        <Line>  <Yellow>⚠</Yellow> Incident Response      <Yellow>70%</Yellow> (4/6 checks)</Line>
        <Line>  <Green>✓</Green> Vendor Management      <Green>80%</Green> (4/5 checks)</Line>
      </div>
      
      <div className="mt-4">
        <Cyan>  FINDINGS:</Cyan>
      </div>
      
      <div className="mt-2 space-y-3">
        <div>
          <Line>  <Yellow>⚠</Yellow> Authentication events not logged to SIEM</Line>
          <Line>  <Gray>├─</Gray> <Blue>Control:</Blue> CC6.1</Line>
          <Line>  <Gray>├─</Gray> <Blue>Category:</Blue> Audit Logging</Line>
          <Line>  <Gray>└─</Gray> <Blue>Recommendation:</Blue> Implement centralized logging</Line>
        </div>
      </div>
      
      <div className="mt-4">
        <Gray>  Run</Gray> <White>guardrail scan:compliance --framework gdpr</White> <Gray>for other frameworks.</Gray>
      </div>
    </TerminalWindow>
  );
}

function SecretsOutput() {
  return (
    <TerminalWindow title="Terminal — guardrail scan:secrets" delay={0.3}>
      <div>
        <Cyan>🔐 SECRET DETECTION SCAN</Cyan>
      </div>
      
      <div className="mt-3">
        <Line><Green>✓</Green> Secret scan complete</Line>
      </div>
      
      <div className="mt-2">
        <Line>  <Blue>Patterns checked:</Blue> API Keys, AWS Credentials, Private Keys, JWT Tokens</Line>
      </div>
      
      <div className="mt-3">
        <Line>  <Yellow>⚠</Yellow> <White>2 potential secrets found:</White></Line>
      </div>
      
      <div className="mt-3 space-y-3">
        <div>
          <Line>  <Red>HIGH</Red> Generic API Key</Line>
          <Line>  <Gray>├─</Gray> <Blue>File:</Blue> src/services/payment.ts:42</Line>
          <Line>  <Gray>├─</Gray> <Blue>Entropy:</Blue> 4.8</Line>
          <Line>  <Gray>└─</Gray> <Blue>Match:</Blue> {STRIPE_LIVE_PREFIX}****************************</Line>
        </div>
        
        <div>
          <Line>  <Yellow>MEDIUM</Yellow> JWT Secret</Line>
          <Line>  <Gray>├─</Gray> <Blue>File:</Blue> .env.example:5</Line>
          <Line>  <Gray>├─</Gray> <Blue>Entropy:</Blue> 3.2</Line>
          <Line>  <Gray>└─</Gray> <Blue>Match:</Blue> your-jwt-secret-here</Line>
        </div>
      </div>
    </TerminalWindow>
  );
}

function VulnerabilityOutput() {
  return (
    <TerminalWindow title="Terminal — guardrail scan:vulnerabilities" delay={0.45}>
      <div>
        <Cyan>🛡️ VULNERABILITY SCAN</Cyan>
      </div>
      
      <div className="mt-3">
        <Line><Green>✓</Green> Vulnerability scan complete</Line>
      </div>
      
      <div className="mt-2">
        <Line>  <Blue>Packages scanned:</Blue> 847</Line>
      </div>
      
      <div className="mt-3 space-y-1">
        <Line>  <span className="bg-red-600 text-white px-1 text-[10px]"> CRITICAL </span>   0</Line>
        <Line>  <Red>HIGH</Red>        1</Line>
        <Line>  <Yellow>MEDIUM</Yellow>      2</Line>
        <Line>  <Blue>LOW</Blue>         0</Line>
      </div>
      
      <div className="mt-4">
        <Cyan>  VULNERABILITIES:</Cyan>
      </div>
      
      <div className="mt-2 space-y-3">
        <div>
          <Line>  <Red>HIGH</Red> lodash@4.17.19</Line>
          <Line>  <Gray>├─</Gray> <Blue>CVE:</Blue> CVE-2021-23337</Line>
          <Line>  <Gray>├─</Gray> <Blue>Title:</Blue> Command Injection</Line>
          <Line>  <Gray>└─</Gray> <Blue>Fix:</Blue> Upgrade to 4.17.21</Line>
        </div>
        
        <div>
          <Line>  <Yellow>MEDIUM</Yellow> minimist@1.2.5</Line>
          <Line>  <Gray>├─</Gray> <Blue>CVE:</Blue> CVE-2021-44906</Line>
          <Line>  <Gray>├─</Gray> <Blue>Title:</Blue> Prototype Pollution</Line>
          <Line>  <Gray>└─</Gray> <Blue>Fix:</Blue> Upgrade to 1.2.6</Line>
        </div>
        
        <div>
          <Line>  <Yellow>MEDIUM</Yellow> node-fetch@2.6.1</Line>
          <Line>  <Gray>├─</Gray> <Blue>CVE:</Blue> CVE-2022-0235</Line>
          <Line>  <Gray>├─</Gray> <Blue>Title:</Blue> Exposure of Sensitive Information</Line>
          <Line>  <Gray>└─</Gray> <Blue>Fix:</Blue> Upgrade to 2.6.7</Line>
        </div>
      </div>
    </TerminalWindow>
  );
}

const features = [
  {
    id: 'security',
    title: 'Security Scanning',
    description: 'Comprehensive security analysis of your entire codebase with actionable fixes.',
    icon: Shield,
  },
  {
    id: 'compliance',
    title: 'Compliance Checks',
    description: 'Automated SOC2, GDPR, HIPAA, and PCI-DSS compliance assessments.',
    icon: FileCheck,
  },
  {
    id: 'secrets',
    title: 'Secret Detection',
    description: 'Find hardcoded API keys, credentials, and sensitive data before they leak.',
    icon: Lock,
  },
  {
    id: 'vulnerabilities',
    title: 'Vulnerability Scan',
    description: 'Detect known CVEs in your dependencies with remediation guidance.',
    icon: AlertTriangle,
  },
];

export function CLIShowcase() {
  const [activeFeature, setActiveFeature] = useState('security');
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });

  const renderTerminal = () => {
    switch (activeFeature) {
      case 'security':
        return <SecurityScanOutput key="security" />;
      case 'compliance':
        return <ComplianceOutput key="compliance" />;
      case 'secrets':
        return <SecretsOutput key="secrets" />;
      case 'vulnerabilities':
        return <VulnerabilityOutput key="vulnerabilities" />;
      default:
        return <SecurityScanOutput key="security" />;
    }
  };

  return (
    <section ref={sectionRef} className="px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
      <div className="container mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm text-blue-300 mb-6 bg-blue-500/10 border border-blue-500/20">
            <Terminal className="h-4 w-4" />
            CLI Features
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold mb-4">
            Powerful security scanning
            <br />
            <span className="text-blue-400">
              right from your terminal.
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Run comprehensive security scans, detect vulnerabilities, and ensure compliance — all with a single command.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-4 space-y-3"
          >
            {features.map((feature) => {
              const Icon = feature.icon;
              const isActive = activeFeature === feature.id;
              
              return (
                <button
                  key={feature.id}
                  onClick={() => setActiveFeature(feature.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-300 ${
                    isActive
                      ? 'bg-white/5 border-blue-500/50 shadow-lg shadow-blue-500/10'
                      : 'bg-white/[0.02] border-gray-800 hover:border-gray-700 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${
                      isActive ? 'bg-blue-500/20' : 'bg-white/5'
                    }`}>
                      <Icon className={`h-5 w-5 ${
                        isActive ? 'text-blue-400' : 'text-gray-400'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className={`font-semibold ${isActive ? 'text-white' : 'text-gray-300'}`}>
                          {feature.title}
                        </h3>
                        <ChevronRight className={`h-4 w-4 transition-transform ${
                          isActive ? 'text-blue-400 rotate-90' : 'text-gray-600'
                        }`} />
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{feature.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="lg:col-span-8"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeFeature}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {renderTerminal()}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
