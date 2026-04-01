import type { ClassifierResult } from '../core/types.js';

export interface Classifier {
  readonly id: string;
  classify(text: string): Promise<ClassifierResult[]>;
}
