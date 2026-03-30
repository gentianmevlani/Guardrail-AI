#!/usr/bin/env node

/**
 * AI Behavior Learning CLI
 */

const { aiBehaviorLearner } = require('../src/lib/ai-behavior-learner');
const { cliUtils } = require('../src/lib/cli-utils');

async function main() {
  const command = process.argv[2];
  const agentId = process.argv[3] || 'default-agent';

  cliUtils.section('🤖 AI Behavior Learning');

  try {
    if (command === 'record') {
      const type = process.argv[4] || 'correction';
      const originalCode = process.argv[5] || '';
      const userChange = process.argv[6] || '';
      const context = process.argv[7] || '';

      await aiBehaviorLearner.recordEvent({
        agentId,
        type,
        originalCode,
        userChange,
        context,
        timestamp: new Date().toISOString(),
      });

      cliUtils.success('Learning event recorded!');
    } else if (command === 'show') {
      const behavior = aiBehaviorLearner.getBehavior(agentId);
      if (!behavior) {
        cliUtils.warning(`No behavior found for agent: ${agentId}`);
        return;
      }

      cliUtils.section(`Behavior Profile: ${behavior.agentName}`);
      console.log(`Agent ID: ${behavior.agentId}`);
      console.log(`\nPersonality:`);
      console.log(`  Creativity: ${(behavior.personality.creativity * 100).toFixed(0)}%`);
      console.log(`  Strictness: ${(behavior.personality.strictness * 100).toFixed(0)}%`);
      console.log(`  Verbosity: ${(behavior.personality.verbosity * 100).toFixed(0)}%`);

      console.log(`\nPerformance:`);
      console.log(`  Acceptance Rate: ${(behavior.performance.acceptanceRate * 100).toFixed(0)}%`);
      console.log(`  Correction Rate: ${(behavior.performance.correctionRate * 100).toFixed(0)}%`);
      console.log(`  Satisfaction: ${(behavior.performance.satisfactionScore * 100).toFixed(0)}%`);

      console.log(`\nLearned Rules: ${behavior.learnedRules.length}`);
      behavior.learnedRules.forEach((rule, i) => {
        console.log(`  ${i + 1}. ${rule.pattern} (${rule.action}, confidence: ${(rule.confidence * 100).toFixed(0)}%)`);
      });

      const recommendations = aiBehaviorLearner.getRecommendations(agentId);
      if (recommendations.length > 0) {
        cliUtils.section('Recommendations');
        recommendations.forEach((rec, i) => {
          console.log(`\n${i + 1}. ${rec.recommendation}`);
          console.log(`   Confidence: ${(rec.confidence * 100).toFixed(0)}%`);
          console.log(`   Impact: ${rec.impact}`);
        });
      }
    } else {
      cliUtils.error('Usage: ai-behavior [record|show] [agentId]');
      process.exit(1);
    }
  } catch (error) {
    cliUtils.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

