#!/usr/bin/env node

/**
 * Architect Agent
 * 
 * Intelligent orchestrator that analyzes your project and applies
 * templates in the correct order - no thinking required!
 */

const { architectAgent } = require('../src/lib/architect-agent');
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
║            🏗️  Architect Agent                               ║
║                                                              ║
║  Intelligent orchestrator that:                              ║
║  • Analyzes your project context                            ║
║  • Selects appropriate templates                            ║
║  • Applies them in correct order                            ║
║  • Handles all dependencies                                 ║
║  • No thinking required!                                    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  const projectPath = process.argv[2] || process.cwd();
  console.log(`Analyzing project: ${projectPath}\n`);

  try {
    console.log('🔍 Analyzing project context...\n');
    const analysis = await architectAgent.analyzeProject(projectPath);

    // Show context
    console.log('📊 PROJECT CONTEXT\n');
    console.log(`   Type: ${analysis.context.type}`);
    console.log(`   Framework: ${analysis.context.framework.join(', ') || 'None detected'}`);
    console.log(`   Stage: ${analysis.context.stage}`);
    console.log(`   Has Database: ${analysis.context.hasDatabase ? 'Yes' : 'No'}`);
    console.log(`   Has Auth: ${analysis.context.hasAuth ? 'Yes' : 'No'}`);
    console.log(`   Has API: ${analysis.context.hasAPI ? 'Yes' : 'No'}\n`);

    // Show recommendations
    console.log('💡 RECOMMENDATIONS\n');
    for (let i = 0; i < analysis.recommendations.length; i++) {
      const rec = analysis.recommendations[i];
      const icon = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🔵',
      }[rec.priority] || '⚪';

      console.log(`   ${i + 1}. ${icon} [${rec.priority.toUpperCase()}] ${rec.description}`);
      console.log(`      Action: ${rec.action} | Templates: ${rec.templates.length}`);
      if (rec.autoApply) {
        console.log(`      ✅ Will auto-apply`);
      }
      console.log('');
    }

    // Show plan
    console.log('📋 TEMPLATE PLAN\n');
    console.log(`   Total Templates: ${analysis.plan.templates.length}`);
    console.log(`   Estimated Time: ${analysis.plan.estimatedTime}\n`);

    if (analysis.plan.templates.length > 0) {
      console.log('   Templates to apply (in order):\n');
      for (let i = 0; i < analysis.plan.order.length; i++) {
        const templateId = analysis.plan.order[i];
        const template = analysis.plan.templates.find(t => t.id === templateId);
        if (template) {
          console.log(`   ${i + 1}. ${template.name} (${template.category})`);
          console.log(`      → ${template.targetPath}`);
          console.log(`      Reason: ${template.reason}`);
          if (template.dependencies.length > 0) {
            console.log(`      Depends on: ${template.dependencies.join(', ')}`);
          }
          console.log('');
        }
      }
    }

    // Ask to apply
    const shouldApply = await question('\n🚀 Apply templates automatically? (yes/no): ');
    
    if (shouldApply.toLowerCase() === 'yes') {
      console.log('\n🔧 Applying templates...\n');
      
      const criticalRecs = analysis.recommendations.filter(r => 
        r.priority === 'critical' || r.autoApply
      );
      const autoApply = criticalRecs.length > 0;

      const result = await architectAgent.applyTemplates(
        projectPath,
        analysis.plan,
        autoApply
      );

      if (result.applied.length > 0) {
        console.log('✅ Applied templates:\n');
        result.applied.forEach((id) => {
          const template = analysis.plan.templates.find(t => t.id === id);
          console.log(`   ✅ ${template?.name || id}`);
        });
        console.log('');
      }

      if (result.skipped.length > 0) {
        console.log('⏭️  Skipped (already exists or requires approval):\n');
        result.skipped.forEach((id) => {
          const template = analysis.plan.templates.find(t => t.id === id);
          console.log(`   ⏭️  ${template?.name || id}`);
        });
        console.log('');
      }

      if (result.errors.length > 0) {
        console.log('❌ Errors:\n');
        result.errors.forEach(({ template, error }) => {
          console.log(`   ❌ ${template}: ${error}`);
        });
        console.log('');
      }

      console.log('✅ Architect agent complete!\n');
      console.log('💡 Next steps:');
      console.log('   1. Review applied templates');
      console.log('   2. Customize as needed');
      console.log('   3. Run "npm run polish" to check for more improvements\n');
    } else {
      console.log('\n✅ Analysis complete. Run again with "yes" to apply templates.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  rl.close();
}

main();

