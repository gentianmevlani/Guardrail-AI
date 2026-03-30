#!/usr/bin/env node

/**
 * Premium Features CLI
 * 
 * Manage premium features, licenses, and subscriptions
 */

const fs = require('fs');
const path = require('path');

const LICENSE_KEY_ENV = 'AI_GUARDRAILS_LICENSE_KEY';
const LICENSE_FILE = '.ai-guardrails-license';

function showPremiumFeatures() {
  console.log(`
🛡️ AI Agent Guardrails - Premium Features

📊 TIERS & PRICING:

┌─────────────┬──────────┬──────────────┬──────────────┐
│ Feature     │ Free     │ Starter      │ Professional │
├─────────────┼──────────┼──────────────┼──────────────┤
│ Basic Valid │ ✅       │ ✅           │ ✅           │
│ ESLint      │ ✅       │ ✅           │ ✅           │
│ TypeScript  │ ✅       │ ✅           │ ✅           │
│ API Valid   │ ❌       │ ✅           │ ✅           │
│ Mock Detect │ ❌       │ ✅           │ ✅           │
│ Health Score│ ❌       │ ❌           │ ✅           │
│ Analytics   │ ❌       │ ✅           │ ✅           │
│ Auto Reports│ ❌       │ ❌           │ ✅           │
│ Custom Rules│ ❌       │ ❌           │ ✅           │
│ CI/CD Integ │ ❌       │ ❌           │ ✅           │
│ Support     │ Community│ Email        │ Priority     │
├─────────────┼──────────┼──────────────┼──────────────┤
│ Price       │ Free     │ $29/mo       │ $99/mo       │
│ Projects    │ 1        │ 3            │ 10           │
│ Endpoints   │ 10       │ 50           │ 200          │
│ Validations │ 100/mo   │ 1,000/mo     │ 10,000/mo    │
└─────────────┴──────────┴──────────────┴──────────────┘

🚀 ENTERPRISE TIER:
- All Professional features
- Unlimited projects & endpoints
- Dedicated support
- SSO, Audit logs, Custom integrations
- On-premise deployment
- Custom pricing

💡 UPGRADE NOW:
Visit: https://ai-guardrails.com/pricing
Or contact: sales@ai-guardrails.com
`);
}

function checkLicense() {
  const licenseKey = process.env[LICENSE_KEY_ENV];
  const licenseFile = path.join(process.cwd(), LICENSE_FILE);

  if (licenseKey) {
    console.log('✅ License key found in environment variable');
    console.log(`   Tier: ${detectTier(licenseKey)}`);
    return licenseKey;
  }

  if (fs.existsSync(licenseFile)) {
    const key = fs.readFileSync(licenseFile, 'utf8').trim();
    console.log('✅ License key found in .ai-guardrails-license file');
    console.log(`   Tier: ${detectTier(key)}`);
    return key;
  }

  console.log('⚠️  No license key found. Using free tier.');
  console.log('   Set AI_GUARDRAILS_LICENSE_KEY environment variable');
  console.log('   Or create .ai-guardrails-license file');
  return null;
}

function detectTier(licenseKey) {
  if (!licenseKey) return 'free';
  const parts = licenseKey.split('-');
  if (parts.length < 1) return 'free';
  const tier = parts[0];
  return ['starter', 'professional', 'enterprise'].includes(tier) ? tier : 'free';
}

function setLicense(licenseKey) {
  const licenseFile = path.join(process.cwd(), LICENSE_FILE);
  fs.writeFileSync(licenseFile, licenseKey);
  console.log(`✅ License key saved to ${LICENSE_FILE}`);
  console.log(`   Tier: ${detectTier(licenseKey)}`);
  console.log('\n💡 Add .ai-guardrails-license to .gitignore to keep it private');
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'check':
      checkLicense();
      break;
    case 'set':
      if (args[1]) {
        setLicense(args[1]);
      } else {
        console.error('❌ Please provide a license key: premium set YOUR_LICENSE_KEY');
      }
      break;
    case 'features':
    case 'pricing':
      showPremiumFeatures();
      break;
    default:
      console.log('AI Agent Guardrails - Premium Features\n');
      console.log('Commands:');
      console.log('  premium check          - Check current license');
      console.log('  premium set <key>      - Set license key');
      console.log('  premium features        - Show features & pricing');
      console.log('  premium pricing        - Show pricing information\n');
      console.log('Environment:');
      console.log('  Set AI_GUARDRAILS_LICENSE_KEY to use license from env\n');
      checkLicense();
  }
}

main();

