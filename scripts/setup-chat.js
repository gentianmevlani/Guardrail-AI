#!/usr/bin/env node

/**
 * Conversational Setup
 * 
 * Just talk to guardrail AI and it sets everything up automatically
 */

const { autoSetup } = require('../src/lib/auto-setup');
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
║         🤖 guardrail AI - Conversational Setup               ║
║                                                              ║
║  Just talk to me and I'll set everything up!                ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  console.log('👋 Hi! I\'m guardrail AI.\n');
  console.log('I can help you set up everything automatically.\n');
  console.log('You don\'t need to know about MCPs, CLIs, or integrations -');
  console.log('just tell me what you want to do and I\'ll handle it!\n');

  // Ask what they want to do
  console.log('What would you like to do?\n');
  console.log('1. Set up guardrail AI for my project');
  console.log('2. I want to build an AI app');
  console.log('3. I want to analyze my codebase');
  console.log('4. Just help me get started\n');

  const choice = await question('Your choice (1-4, or just describe what you want): ');

  const projectPath = process.argv[2] || process.cwd();

  if (choice === '1' || choice.toLowerCase().includes('setup') || choice.toLowerCase().includes('set up')) {
    await runAutoSetup(projectPath);
  } else if (choice === '2' || choice.toLowerCase().includes('build') || choice.toLowerCase().includes('app')) {
    await handleBuildApp();
  } else if (choice === '3' || choice.toLowerCase().includes('analyze')) {
    await handleAnalyze(projectPath);
  } else {
    // Try to understand what they want
    await handleNaturalLanguage(choice, projectPath);
  }

  rl.close();
}

async function runAutoSetup(projectPath) {
  console.log('\n🚀 Perfect! Let me set everything up for you automatically...\n');
  
  try {
    const result = await autoSetup.setupFromConversation(projectPath);
    
    if (result.success) {
      console.log('\n🎉 All done! Here\'s what I set up:\n');
      result.steps.forEach((step, i) => {
        const icon = step.status === 'completed' ? '✅' : step.status === 'skipped' ? '⏭️' : '❌';
        console.log(`   ${icon} ${step.step}: ${step.message}`);
      });
      
      if (result.nextSteps.length > 0) {
        console.log('\n📋 Next steps:\n');
        result.nextSteps.forEach((step, i) => {
          console.log(`   ${i + 1}. ${step}`);
        });
      }
      
      console.log('\n💡 You\'re all set! Try asking your AI assistant about your project now.\n');
    } else {
      console.log('\n⚠️  Setup completed with some issues. Check the steps above.\n');
    }
  } catch (error) {
    console.error('\n❌ Oops! Something went wrong:', error.message);
    console.log('\n💡 Try running: guardrail setup\n');
  }
}

async function handleBuildApp() {
  console.log('\n🎨 Great! Let\'s build an AI app together!\n');
  console.log('Tell me what you want your app to do:\n');
  console.log('Example: "I want an app that monitors tweets and sends me alerts"\n');
  
  const description = await question('Describe your app: ');
  
  if (!description.trim()) {
    console.log('\n❌ No description provided. Run "guardrail design" to try again.\n');
    return;
  }
  
  console.log('\n🔨 Building your app...\n');
  console.log('This would use the AI Co-Architect to design your app.');
  console.log('Run "guardrail design" for the full experience!\n');
}

async function handleAnalyze(projectPath) {
  console.log('\n📊 Analyzing your project...\n');
  
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const { stdout } = await execAsync('npm run architect -- --analyze-only', {
      cwd: projectPath,
    });
    
    console.log(stdout);
    console.log('\n✅ Analysis complete!\n');
  } catch (error) {
    console.log('⚠️  Analysis encountered some issues. Run "guardrail analyze" for details.\n');
  }
}

async function handleNaturalLanguage(input, projectPath) {
  const lower = input.toLowerCase();
  
  if (lower.includes('setup') || lower.includes('install') || lower.includes('configure')) {
    await runAutoSetup(projectPath);
  } else if (lower.includes('analyze') || lower.includes('check') || lower.includes('review')) {
    await handleAnalyze(projectPath);
  } else if (lower.includes('build') || lower.includes('create') || lower.includes('make')) {
    await handleBuildApp();
  } else {
    console.log('\n🤔 I\'m not sure what you mean. Let me set up guardrail AI for you instead!\n');
    await runAutoSetup(projectPath);
  }
}

main();

