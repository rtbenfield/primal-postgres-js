type LogMetadata = Record<string, unknown>;

/**
 * Abstract logger interface that allows consumers to bring their own logging
 * implementation.
 */
export interface Logger {
  assert(assertion: boolean, message: string, metadata?: LogMetadata): void;
  debug(message: string, metadata?: LogMetadata): void;
  error(message: string, reason: unknown, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
}

type LogLevel = "debug" | "info" | "warn" | "error" | "none";

export class ConsoleLogger implements Logger {
  readonly #level;

  constructor(level: LogLevel = "info") {
    this.#level = mapLevelToNumber(level);
  }

  assert(assertion: boolean, message: string, metadata?: LogMetadata): void {
    // treat assertion violations as warning level
    if (this.#level <= 2) {
      console.assert(assertion, message, metadata);
    }
  }

  debug(message: string, metadata?: LogMetadata): void {
    if (this.#level <= 0) {
      console.debug(message, metadata);
    }
  }

  error(message: string, reason: unknown, metadata?: LogMetadata): void {
    if (this.#level <= 3) {
      console.error(message, reason, metadata);
    }
  }

  info(message: string, metadata?: LogMetadata): void {
    if (this.#level <= 1) {
      console.info(message, metadata);
    }
  }

  warn(message: string, metadata?: LogMetadata): void {
    if (this.#level <= 2) {
      console.warn(message, metadata);
    }
  }
}

function mapLevelToNumber(level: LogLevel) {
  switch (level) {
    case "debug":
      return 0;
    case "info":
      return 1;
    case "warn":
      return 2;
    case "error":
      return 3;
    case "none":
      return 4;
  }
}
