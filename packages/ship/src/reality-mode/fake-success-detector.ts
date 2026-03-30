import { ReplayStep, FakeSuccessResult } from "./types";

export class FakeSuccessDetector {
  /**
   * Analyze a replay to find "Fake Success" patterns
   * i.e., User clicked "Save" -> UI showed success -> No backend write happened
   */
  detect(replay: ReplayStep[]): FakeSuccessResult[] {
    const results: FakeSuccessResult[] = [];
    const saveActionPatterns = [
      /save/i,
      /update/i,
      /create/i,
      /submit/i,
      /confirm/i,
      /send/i,
      /pay/i,
    ];

    // Iterate through replay to find "Write" actions
    for (let i = 0; i < replay.length; i++) {
      const step = replay[i];
      if (!step || step.type !== "action" || !step.data?.selector) continue;

      const selector = step.data.selector;
      const isWriteAction = saveActionPatterns.some((p) => p.test(selector));

      if (isWriteAction) {
        // Look ahead for network activity (next 5 seconds or until next action)
        const subsequentSteps = this.getSubsequentSteps(replay, i, 5000);
        const writeRequests = subsequentSteps.filter(
          (s) =>
            s.type === "request" &&
            ["POST", "PUT", "PATCH", "DELETE"].includes(s.data.method),
        );

        if (writeRequests.length === 0) {
          // No write request found!
          // But maybe it's a client-side only app?
          // Or maybe the request happened but we missed it?
          // Or maybe it's "Fake Success".

          results.push({
            isFake: true,
            score: 0,
            evidence: [
              `Clicked "${selector}" but no POST/PUT/PATCH/DELETE request followed.`,
            ],
            actionStep: step,
          });
        } else {
          // Write request found. Check if it looked real.
          // (TrafficClassifier handles the quality of the request/response)
          results.push({
            isFake: false,
            score: 100,
            evidence: [
              `Clicked "${selector}" triggered ${writeRequests.length} write request(s).`,
            ],
            actionStep: step,
          });
        }
      }
    }

    return results;
  }

  private getSubsequentSteps(
    replay: ReplayStep[],
    startIndex: number,
    timeWindow: number,
  ): ReplayStep[] {
    const steps: ReplayStep[] = [];
    const startStep = replay[startIndex];
    if (!startStep) return steps;

    const startTime = startStep.timestamp;

    for (let i = startIndex + 1; i < replay.length; i++) {
      const step = replay[i];
      if (!step) break;
      if (step.timestamp - startStep.timestamp > timeWindow) break;
      steps.push(step);
    }

    return steps;
  }
}
