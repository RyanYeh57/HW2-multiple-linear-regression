// User-facing error: the message is shown on the page as-is.
export class AnalysisError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AnalysisError';
  }
}
