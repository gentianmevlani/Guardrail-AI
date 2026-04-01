export interface AIVerificationResult {
  inferredIntent: string;
  actualBehavior: string;
  gaps: string[];
  suggestions: string[];
  confidence: number;
}

export class AIIntentVerifier {
  async verify(code: string, apiKey: string): Promise<AIVerificationResult> {
    const prompt = this.buildPrompt(code);

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are a code analysis expert specializing in detecting semantic gaps between what developers intend their code to do and what it actually does. 

Your task is to:
1. Infer what the developer likely intended based on naming, comments, and structure
2. Analyze what the code actually does
3. Identify any gaps or mismatches between intent and reality
4. Provide specific, actionable suggestions

Be concise and focus on real issues, not style preferences. Output JSON only.`,
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.3,
            response_format: { type: "json_object" },
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("No response from AI");
      }

      const result = JSON.parse(content);
      return {
        inferredIntent: result.inferredIntent || "Unable to determine intent",
        actualBehavior: result.actualBehavior || "Unable to analyze behavior",
        gaps: result.gaps || [],
        suggestions: result.suggestions || [],
        confidence: result.confidence || 0.5,
      };
    } catch (error: any) {
      console.error("AI verification error:", error);
      throw error;
    }
  }

  private buildPrompt(code: string): string {
    return `Analyze this code for semantic gaps between intent and behavior:

\`\`\`
${code}
\`\`\`

Respond with JSON in this format:
{
  "inferredIntent": "What the developer likely intended this code to do based on names, comments, structure",
  "actualBehavior": "What the code actually does when executed",
  "gaps": ["List of specific mismatches or issues", "Each gap should be a concrete problem"],
  "suggestions": ["Specific fix for gap 1", "Specific fix for gap 2"],
  "confidence": 0.85
}

Focus on:
- Naming vs behavior mismatches (e.g., "validateUser" that doesn't validate)
- Error handling gaps (catches that swallow errors)
- Async issues (missing awaits, race conditions)
- Edge case blindness (null/undefined, empty arrays)
- Return value inconsistencies
- Side effects not obvious from the name
- Security issues (unvalidated input, leaked secrets)

Only report real issues, not style preferences. If the code is fine, return empty gaps array.`;
  }

  async verifyWithContext(
    code: string,
    functionName: string,
    callers: string[],
    apiKey: string,
  ): Promise<AIVerificationResult> {
    const contextPrompt = `
Function: ${functionName}
Called by: ${callers.join(", ") || "Unknown"}

Code:
\`\`\`
${code}
\`\`\`

Analyze considering the calling context. Are callers using this correctly?`;

    return this.verify(contextPrompt, apiKey);
  }
}
