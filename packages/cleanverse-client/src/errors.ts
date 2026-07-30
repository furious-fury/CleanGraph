export type CleanverseErrorJson = {
  name: string;
  message: string;
  code: string;
  retryable: boolean;
  requestId?: string;
  status?: number;
  cleanverseCode?: string;
};

type CleanverseErrorOptions = {
  code: string;
  retryable: boolean;
  requestId?: string;
  status?: number;
  cleanverseCode?: string;
};

export class CleanverseError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly requestId: string | undefined;
  readonly status: number | undefined;
  readonly cleanverseCode: string | undefined;

  constructor(message: string, options: CleanverseErrorOptions) {
    super(message);
    this.name = new.target.name;
    this.code = options.code;
    this.retryable = options.retryable;
    this.requestId = options.requestId;
    this.status = options.status;
    this.cleanverseCode = options.cleanverseCode;
  }

  toJSON(): CleanverseErrorJson {
    const result: CleanverseErrorJson = {
      name: this.name,
      message: this.message,
      code: this.code,
      retryable: this.retryable,
    };

    if (this.requestId !== undefined) {
      result.requestId = this.requestId;
    }

    if (this.status !== undefined) {
      result.status = this.status;
    }

    if (this.cleanverseCode !== undefined) {
      result.cleanverseCode = this.cleanverseCode;
    }

    return result;
  }
}

export class CleanverseConfigurationError extends CleanverseError {
  constructor(message: string) {
    super(message, {
      code: "CLEANVERSE_CONFIGURATION_ERROR",
      retryable: false,
    });
  }
}

export class CleanverseTimeoutError extends CleanverseError {
  constructor(requestId: string) {
    super("The Cleanverse request timed out.", {
      code: "CLEANVERSE_TIMEOUT",
      retryable: true,
      requestId,
    });
  }
}

export class CleanverseNetworkError extends CleanverseError {
  constructor(requestId: string) {
    super("The Cleanverse request failed before receiving a response.", {
      code: "CLEANVERSE_NETWORK_ERROR",
      retryable: true,
      requestId,
    });
  }
}

export class CleanverseHttpError extends CleanverseError {
  constructor(requestId: string, status: number) {
    super("Cleanverse returned an unsuccessful HTTP response.", {
      code: "CLEANVERSE_HTTP_ERROR",
      retryable: status === 408 || status === 429 || status >= 500,
      requestId,
      status,
    });
  }
}

export class CleanverseMalformedResponseError extends CleanverseError {
  constructor(requestId: string) {
    super("Cleanverse returned an invalid response.", {
      code: "CLEANVERSE_MALFORMED_RESPONSE",
      retryable: false,
      requestId,
    });
  }
}

export class CleanverseBusinessError extends CleanverseError {
  constructor(requestId: string, cleanverseCode: string) {
    super("Cleanverse rejected the request.", {
      code: "CLEANVERSE_BUSINESS_ERROR",
      retryable: false,
      requestId,
      cleanverseCode,
    });
  }
}
