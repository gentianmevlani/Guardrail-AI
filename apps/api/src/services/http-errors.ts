/**
 * Typed errors for mapping service results to HTTP responses
 */

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly body: Record<string, unknown>,
  ) {
    super(
      typeof body.error === "string"
        ? body.error
        : "Request failed",
    );
    this.name = "HttpError";
  }
}
