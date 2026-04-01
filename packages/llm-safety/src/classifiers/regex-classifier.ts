import type { Classifier } from './classifier.interface.js';
import type { ClassifierResult } from '../core/types.js';

export class RegexClassifier implements Classifier {
  readonly id: string;
  private readonly rules: { name: string; re: RegExp }[];

  constructor(id: string, rules: { name: string; re: RegExp }[]) {
    this.id = id;
    this.rules = rules;
  }

  async classify(text: string): Promise<ClassifierResult[]> {
    const out: ClassifierResult[] = [];
    for (const { name, re } of this.rules) {
      const m = re.exec(text);
      if (m?.index !== undefined) {
        out.push({
          label: name,
          score: 1,
          span: { start: m.index, end: m.index + m[0].length },
        });
      }
    }
    return out;
  }
}
