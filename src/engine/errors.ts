/** Carries an HTTP status + machine-readable code up to the API error handler. */
export class GameError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GameError";
  }
}
