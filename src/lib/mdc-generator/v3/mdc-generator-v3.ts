/**
 * MDC Generator v3
 * 
 * Surgical, change-aware, evidence-backed context pack system:
 * - Change-aware (git-diff driven) + dependency closure
 * - Lane-based packs (CLI/MCP vs Dashboard) with minimal-but-sufficient context
 * - Evidence ladder baked in (lexical → structural → runtime witness where available)
 * - Receipt-first output (paths, symbols, contracts) to prevent hallucinations
 * - Deterministic output + stable schemas
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as ts from 'typescript';
import { ChangeAwareSelector, ChangedFile, DependencyClosure } from './change-aware-selector';
import { LaneRouter, Lane } from './lane-router';
import { TruthIndexExtractor, TruthIndex } from './truth-index-extractor';
import { getInvariantsForLane, CriticalInvariant } from './critical-invariants';
import { RealityScanIntegration } from './reality-scan-integration';
import { DeterministicPackGenerator, PackContent, PackMetadata } from './deterministic-pack-generator';

export interface MDCGeneratorV3Options {
  projectPath: string;
  outputDir?: string;
  baseRef?: string;
  includeStaged?: boolean;
  includeUnstaged?: boolean;
  runRealityScan?: boolean;
  realityScanLayers?: {
    lexical?: boolean;
    structural?: boolean;
    runtime?: boolean;
  };
}

export interface MDCGeneratorV3Result {
  packs: Array<{
    lane: Lane;
    fileName: string;
    filePath: string;
    metadata: PackMetadata;
  }>;
  realityScanResult?: {
    verdict: string;
    findings: number;
    blockers: number;
  };
  duration: number;
}

export class MDCGeneratorV3 {
  private options: Required<Omit<MDCGeneratorV3Options, 'baseRef' | 'realityScanLayers'>> & {
    baseRef?: string;
    realityScanLayers?: {
      lexical?: boolean;
      structural?: boolean;
      runtime?: boolean;
    };
  };
  private program: ts.Program | null = null;
  private checker: ts.TypeChecker | null = null;

  constructor(options: MDCGeneratorV3Options) {
    this.options = {
      projectPath: options.projectPath,
      outputDir: options.outputDir || join(options.projectPath, '.guardrail', 'mdc-v3'),
      baseRef: options.baseRef,
      includeStaged: options.includeStaged ?? true,
      includeUnstaged: options.includeUnstaged ?? true,
      runRealityScan: options.runRealityScan ?? true,
      realityScanLayers: options.realityScanLayers,
    };
  }

  /**
   * Initialize TypeScript compiler
   */
  private async initializeTypeScript(): Promise<void> {
    try {
      const tsConfigPath = ts.findConfigFile(
        this.options.projectPath,
        ts.sys.fileExists,
        'tsconfig.json'
      );

      if (!tsConfigPath) {
        console.log('   ⚠️  No tsconfig.json found - skipping AST parsing');
        return;
      }

      const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
      const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        this.options.projectPath
      );

      this.program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
      this.checker = this.program.getTypeChecker();
    } catch (error) {
      console.log('   ⚠️  Failed to initialize TypeScript - using regex fallback');
    }
  }

  /**
   * Generate all packs
   */
  async generate(): Promise<MDCGeneratorV3Result> {
    const startTime = Date.now();
    console.log('🚀 MDC Generator v3 Starting...');
    console.log(`📁 Project: ${this.options.projectPath}`);
    console.log(`📤 Output: ${this.options.outputDir}\n`);

    // Initialize TypeScript if available
    await this.initializeTypeScript();

    // Step 1: Change-aware selection
    console.log('🔍 Step 1: Change-aware selection...');
    const selector = new ChangeAwareSelector({
      projectPath: this.options.projectPath,
      baseRef: this.options.baseRef,
      includeStaged: this.options.includeStaged,
      includeUnstaged: this.options.includeUnstaged,
      program: this.program || undefined,
      checker: this.checker || undefined,
    });

    const changedFiles = await selector.getChangedFiles();
    console.log(`   ✅ Found ${changedFiles.length} changed files`);

    const dependencyClosure = await selector.computeDependencyClosure(changedFiles);
    console.log(`   ✅ Dependency closure: ${dependencyClosure.dependentFiles.length} dependent files`);
    console.log('');

    // Step 2: Lane routing
    console.log('🛣️  Step 2: Lane routing...');
    const router = new LaneRouter(this.options.projectPath);
    const allFiles = [
      ...changedFiles.map(f => f.relativePath),
      ...dependencyClosure.dependentFiles,
    ];
    const grouped = router.groupByLane(allFiles);
    console.log(`   ✅ CLI/MCP: ${grouped['cli-mcp'].length} files`);
    console.log(`   ✅ Dashboard: ${grouped['dashboard'].length} files`);
    console.log(`   ✅ Shared: ${grouped['shared'].length} files`);
    console.log('');

    // Step 3: Truth index extraction
    console.log('📚 Step 3: Truth index extraction...');
    const truthExtractor = new TruthIndexExtractor({
      projectPath: this.options.projectPath,
      program: this.program || undefined,
      checker: this.checker || undefined,
    });
    const truthIndex = await truthExtractor.extract();
    console.log(`   ✅ Commands: ${truthIndex.commands.length}`);
    console.log(`   ✅ Tools: ${truthIndex.tools.length}`);
    console.log(`   ✅ Routes: ${truthIndex.routes.length}`);
    console.log(`   ✅ Env Vars: ${truthIndex.envVars.length}`);
    console.log(`   ✅ DB Models: ${truthIndex.dbModels.length}`);
    console.log('');

    // Step 4: Reality scan (if enabled)
    let realityIntegration: RealityScanIntegration | null = null;
    if (this.options.runRealityScan) {
      console.log('🔬 Step 4: Reality scan...');
      try {
        const { RealityScanIntegrator } = await import('./reality-scan-integration');
        realityIntegration = await RealityScanIntegrator.scanAndExtractHotspots({
          projectPath: this.options.projectPath,
          changedFiles,
          layers: this.options.realityScanLayers,
        });
        console.log(`   ✅ Verdict: ${realityIntegration.scanResult.verdict}`);
        console.log(`   ✅ Findings: ${realityIntegration.scanResult.findings.length}`);
        console.log(`   ✅ Blockers: ${realityIntegration.scanResult.blockers.length}`);
        console.log(`   ✅ Hotspots: ${realityIntegration.hotspots.length}`);
      } catch (error) {
        console.log(`   ⚠️  Reality scan failed: ${error}`);
      }
      console.log('');
    }

    // Step 5: Generate packs
    console.log('📦 Step 5: Generating packs...');
    const packGenerator = new DeterministicPackGenerator(this.options.projectPath);
    const packs: MDCGeneratorV3Result['packs'] = [];

    // Generate pack for each lane
    const lanes: Lane[] = ['cli-mcp', 'dashboard', 'shared'];
    for (const lane of lanes) {
      const filesInLane = grouped[lane];
      if (filesInLane.length === 0 && lane !== 'shared') {
        // Skip empty lanes (except shared which might be needed)
        continue;
      }

      const invariants = getInvariantsForLane(lane);
      const gitCommit = packGenerator.getGitCommit();
      const gitBranch = packGenerator.getGitBranch();

      const metadata: PackMetadata = {
        version: '3.0.0',
        timestamp: new Date().toISOString(),
        gitCommit,
        gitBranch,
        lane,
        filesIncluded: filesInLane.length,
        symbolsIncluded: dependencyClosure.relatedSymbols.length,
      };

      const packContent: PackContent = {
        metadata,
        changedFiles: changedFiles
          .filter(f => filesInLane.includes(f.relativePath))
          .map(f => ({
            path: f.relativePath,
            status: f.status,
            summary: `Changed in ${f.status}`,
          })),
        dependencyClosure: {
          changedFiles: changedFiles.filter(f => filesInLane.includes(f.relativePath)).length,
          dependentFiles: dependencyClosure.dependentFiles.filter(f => filesInLane.includes(f)).length,
          relatedSymbols: dependencyClosure.relatedSymbols.filter(s => 
            filesInLane.includes(s.file)
          ).length,
        },
        truthIndex: this.filterTruthIndexForLane(truthIndex, lane),
        criticalInvariants: invariants,
        realityHotspots: realityIntegration?.hotspots.filter(h => 
          filesInLane.some(f => h.file.includes(f))
        ),
      };

      const packContentStr = packGenerator.generatePack(lane, packContent);
      const fileName = router.getPackName(lane);
      const filePath = join(this.options.outputDir, fileName);

      // Ensure output directory exists
      mkdirSync(this.options.outputDir, { recursive: true });

      // Write pack
      writeFileSync(filePath, packContentStr, 'utf8');

      packs.push({
        lane,
        fileName,
        filePath,
        metadata,
      });

      console.log(`   ✅ Generated: ${fileName}`);
    }

    console.log('');

    const duration = Date.now() - startTime;
    console.log('✨ MDC Generation v3 Complete!');
    console.log(`📊 Generated ${packs.length} pack(s)`);
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`📁 Output directory: ${this.options.outputDir}\n`);

    return {
      packs,
      realityScanResult: realityIntegration ? {
        verdict: realityIntegration.scanResult.verdict,
        findings: realityIntegration.scanResult.findings.length,
        blockers: realityIntegration.scanResult.blockers.length,
      } : undefined,
      duration,
    };
  }

  /**
   * Filter truth index for a specific lane
   */
  private filterTruthIndexForLane(index: TruthIndex, lane: Lane): TruthIndex {
    // For now, return full index (could be optimized to filter by file paths)
    return index;
  }
}
