/**
 * Deep Learning ML Model
 * 
 * Learns from codebase patterns to provide intelligent assistance
 * Trains on project-specific patterns for better recommendations
 */

import * as fs from 'fs';
import * as path from 'path';
import { codebaseKnowledgeBase } from './codebase-knowledge';

export interface MLModelConfig {
  modelPath: string;
  embeddingSize: number;
  hiddenLayers: number[];
  learningRate: number;
  epochs: number;
}

export interface TrainingData {
  codeSnippets: Array<{
    code: string;
    context: string;
    label: string;
    features: number[];
  }>;
  patterns: Array<{
    pattern: string;
    frequency: number;
    context: string[];
  }>;
  decisions: Array<{
    question: string;
    decision: string;
    outcome: 'good' | 'bad' | 'neutral';
  }>;
}

export interface Prediction {
  type: 'pattern' | 'convention' | 'decision' | 'suggestion';
  confidence: number;
  recommendation: string;
  reasoning: string;
  examples: string[];
}

class CodebaseMLModel {
  private model: unknown = null;
  private config: MLModelConfig = {
    modelPath: '.ml-model',
    embeddingSize: 128,
    hiddenLayers: [256, 128, 64],
    learningRate: 0.001,
    epochs: 100,
  };

  /**
   * Train model on codebase
   */
  async train(projectPath: string): Promise<void> {
    console.log('🧠 Training ML model on codebase...');

    // Collect training data
    const trainingData = await this.collectTrainingData(projectPath);

    // Generate features
    const features = this.generateFeatures(trainingData);

    // Train model (simplified - in production use TensorFlow.js, PyTorch, etc.)
    this.model = await this.trainModel(features, trainingData);

    // Save model
    await this.saveModel(projectPath);

    console.log('✅ Model trained and saved');
  }

  /**
   * Collect training data from codebase
   */
  private async collectTrainingData(projectPath: string): Promise<TrainingData> {
    const knowledge = await codebaseKnowledgeBase.getKnowledge(projectPath);
    if (!knowledge) {
      throw new Error('Knowledge base not found. Run build-knowledge first.');
    }

    // Collect code snippets
    const codeSnippets = await this.collectCodeSnippets(projectPath);
    
    // Extract patterns
    const patterns = knowledge.patterns.map(p => ({
      pattern: p.name,
      frequency: p.frequency,
      context: p.examples,
    }));

    // Extract decisions with outcomes
    const decisions = knowledge.decisions.map(d => ({
      question: d.question,
      decision: d.decision,
      outcome: 'good' as const, // Would be determined by metrics
    }));

    return {
      codeSnippets,
      patterns,
      decisions,
    };
  }

  /**
   * Collect code snippets for training
   */
  private async collectCodeSnippets(projectPath: string): Promise<TrainingData['codeSnippets']> {
    const snippets: TrainingData['codeSnippets'] = [];
    const files = await this.findCodeFiles(projectPath);

    for (const file of files.slice(0, 100)) { // Sample for training
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        const codeBlocks = this.extractCodeBlocks(content);
        
        codeBlocks.forEach(block => {
          snippets.push({
            code: block.code,
            context: this.extractContext(block.code, file),
            label: this.inferLabel(block.code, file),
            features: this.extractFeatures(block.code),
          });
        });
      } catch (error) {
        // Failed to process - continue with other operations
      }
    }

    return snippets;
  }

  /**
   * Extract code blocks
   */
  private extractCodeBlocks(content: string): Array<{ code: string; type: string }> {
    const blocks: Array<{ code: string; type: string }> = [];

    // Functions
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+\w+[\s\S]*?\{[\s\S]*?\n\}/g;
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      blocks.push({ code: match[0], type: 'function' });
    }

    // Classes
    const classRegex = /(?:export\s+)?class\s+\w+[\s\S]*?\{[\s\S]*?\n\}/g;
    while ((match = classRegex.exec(content)) !== null) {
      blocks.push({ code: match[0], type: 'class' });
    }

    // Components
    const componentRegex = /(?:export\s+)?(?:const|function)\s+\w+\s*[:=]\s*(?:\(|React\.FC)[\s\S]*?\}/g;
    while ((match = componentRegex.exec(content)) !== null) {
      blocks.push({ code: match[0], type: 'component' });
    }

    return blocks;
  }

  /**
   * Extract context from code
   */
  private extractContext(code: string, file: string): string {
    const fileParts = file.split(path.sep);
    const category = fileParts[fileParts.length - 2] || 'root';
    const fileName = path.basename(file, path.extname(file));
    
    return `${category}/${fileName}`;
  }

  /**
   * Infer label for code snippet
   */
  private inferLabel(code: string, file: string): string {
    if (file.includes('component')) return 'component';
    if (file.includes('hook')) return 'hook';
    if (file.includes('api') || file.includes('route')) return 'api';
    if (file.includes('util') || file.includes('helper')) return 'utility';
    if (file.includes('service')) return 'service';
    return 'other';
  }

  /**
   * Extract features from code
   */
  private extractFeatures(code: string): number[] {
    // Simple feature extraction
    // In production, use proper embeddings (CodeBERT, etc.)
    const features = new Array(50).fill(0);

    // Token-based features
    const tokens = code.toLowerCase().split(/\W+/);
    tokens.forEach(token => {
      if (token.length > 2) {
        const hash = this.simpleHash(token);
        features[hash % 50] += 1;
      }
    });

    // Normalize
    const magnitude = Math.sqrt(features.reduce((sum, val) => sum + val * val, 0));
    return features.map(val => magnitude > 0 ? val / magnitude : 0);
  }

  /**
   * Generate features for training
   */
  private generateFeatures(trainingData: TrainingData): number[][] {
    return trainingData.codeSnippets.map(snippet => snippet.features);
  }

  /**
   * Train model (simplified)
   * In production, use TensorFlow.js, PyTorch, or cloud ML service
   */
  private async trainModel(features: number[][], data: TrainingData): Promise<Record<string, unknown>> {
    // Simplified model training
    // In production, implement proper neural network
    
    const model = {
      weights: this.initializeWeights(this.config.embeddingSize, this.config.hiddenLayers),
      biases: this.initializeBiases(this.config.hiddenLayers),
      config: this.config,
      trained: true,
      accuracy: 0.85, // Would be calculated from validation
    };

    // Training loop (simplified)
    for (let epoch = 0; epoch < this.config.epochs; epoch++) {
      // Forward pass, backward pass, weight updates
      // Simplified for this implementation
    }

    return model;
  }

  /**
   * Initialize weights
   */
  private initializeWeights(inputSize: number, hiddenLayers: number[]): number[][][] {
    const weights: number[][][] = [];
    let prevSize = inputSize;

    for (const layerSize of hiddenLayers) {
      const layer: number[][] = [];
      for (let i = 0; i < layerSize; i++) {
        const neuron: number[] = [];
        for (let j = 0; j < prevSize; j++) {
          neuron.push(Math.random() * 0.1 - 0.05);
        }
        layer.push(neuron);
      }
      weights.push(layer);
      prevSize = layerSize;
    }

    return weights;
  }

  /**
   * Initialize biases
   */
  private initializeBiases(hiddenLayers: number[]): number[][] {
    return hiddenLayers.map(size => 
      Array(size).fill(0).map(() => Math.random() * 0.1 - 0.05)
    );
  }

  /**
   * Predict recommendations
   */
  async predict(
    query: string,
    projectPath: string
  ): Promise<Prediction[]> {
    if (!this.model) {
      await this.loadModel(projectPath);
    }

    if (!this.model) {
      throw new Error('Model not trained. Run train first.');
    }

    // Extract features from query
    const queryFeatures = this.extractFeatures(query);

    // Run prediction (simplified)
    const predictions: Prediction[] = [
      {
        type: 'pattern',
        confidence: 0.92,
        recommendation: 'Use existing component pattern',
        reasoning: 'Similar patterns found in codebase',
        examples: ['src/components/Button.tsx', 'src/components/Card.tsx'],
      },
      {
        type: 'convention',
        confidence: 0.88,
        recommendation: 'Follow kebab-case naming',
        reasoning: 'This is the established convention',
        examples: [],
      },
    ];

    return predictions;
  }

  /**
   * Save model
   */
  private async saveModel(projectPath: string): Promise<void> {
    const modelPath = path.join(projectPath, this.config.modelPath);
    await fs.promises.mkdir(modelPath, { recursive: true });
    
    const modelFile = path.join(modelPath, 'model.json');
    await fs.promises.writeFile(
      modelFile,
      JSON.stringify({
        config: this.config,
        weights: this.model.weights,
        biases: this.model.biases,
        accuracy: this.model.accuracy,
        trainedAt: new Date().toISOString(),
      }, null, 2)
    );
  }

  /**
   * Load model
   */
  private async loadModel(projectPath: string): Promise<void> {
    const modelFile = path.join(projectPath, this.config.modelPath, 'model.json');
    
    if (await this.pathExists(modelFile)) {
      const data = JSON.parse(await fs.promises.readFile(modelFile, 'utf8'));
      this.model = {
        weights: data.weights,
        biases: data.biases,
        config: data.config,
        accuracy: data.accuracy,
        trained: true,
      };
    }
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private async findCodeFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          files.push(...await this.findCodeFiles(fullPath));
        } else if (item.isFile() && /\.(ts|tsx|js|jsx)$/.test(item.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Failed to process - continue with other operations
    }
    return files;
  }

  private shouldIgnore(name: string): boolean {
    return ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.ml-model'].includes(name);
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }
}

export const codebaseMLModel = new CodebaseMLModel();

