import type { Classifier } from './classifier.interface.js';
import type { ClassifierResult } from '../core/types.js';

/**
 * Placeholder HTTP/ONNX adapter — wire your inference endpoint here.
 */
export class HttpClassifier implements Classifier {
  readonly id: string;

  constructor(
    id: string,
    private readonly _endpoint: string
  ) {
    this.id = id;
  }

  async classify(_text: string): Promise<ClassifierResult[]> {
    void this._endpoint;
    return [];
  }
}
