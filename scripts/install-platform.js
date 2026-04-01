#!/usr/bin/env node

/**
 * Install Platform Plugin
 * 
 * Installs guardrails as a plugin for Netlify, Supabase, Vercel, etc.
 */

const { platformPluginManager } = require('../src/lib/platform-plugins');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║         🔌 Platform Plugin Installer                        ║
║                                                              ║
║  Install guardrails as a plugin for your platform           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  const projectPath = process.argv[2] || process.cwd();
  const platformArg = process.argv[3];

  // Get available platforms
  const plugins = platformPluginManager.getPlugins();
  
  console.log('Available platforms:\n');
  plugins.forEach((plugin, i) => {
    console.log(`   ${i + 1}. ${plugin.name}`);
  });
  console.log('');

  let platform = platformArg;
  if (!platform) {
    // Auto-detect
    const detected = await platformPluginManager.detectPlatform(projectPath);
    if (detected.length > 0) {
      console.log(`🔍 Detected platforms: ${detected.join(', ')}\n`);
      platform = detected[0];
    } else {
      const answer = await question('Select platform (name or number): ');
      const num = parseInt(answer);
      if (!isNaN(num) && num > 0 && num <= plugins.length) {
        platform = plugins[num - 1].platform;
      } else {
        platform = answer.toLowerCase();
      }
    }
  }

  const plugin = platformPluginManager.getPlugin(platform);
  if (!plugin) {
    console.error(`❌ Platform not found: ${platform}`);
    console.log(`\nAvailable: ${plugins.map(p => p.platform).join(', ')}\n`);
    process.exit(1);
  }

  console.log(`Installing ${plugin.name} plugin...\n`);

  try {
    await plugin.install(projectPath);

    console.log(`✅ ${plugin.name} plugin installed!\n`);
    console.log('📋 Configuration files created:');
    plugin.config.files.forEach(file => {
      console.log(`   • ${file.path}`);
      console.log(`     ${file.description}`);
    });
    console.log('');

    if (plugin.config.envVars.length > 0) {
      console.log('🔑 Environment variables needed:');
      plugin.config.envVars.forEach(env => {
        console.log(`   • ${env}`);
      });
      console.log('');
    }

    if (Object.keys(plugin.config.scripts).length > 0) {
      console.log('📜 Scripts added:');
      Object.entries(plugin.config.scripts).forEach(([name, cmd]) => {
        console.log(`   • npm run ${name} → ${cmd}`);
      });
      console.log('');
    }

    console.log('💡 Next steps:');
    console.log(`   1. Configure environment variables`);
    console.log(`   2. Review ${plugin.config.files[0].path}`);
    console.log(`   3. Deploy to ${plugin.name}!\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  rl.close();
}

main();

