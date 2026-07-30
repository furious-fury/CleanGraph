import { z } from "zod";

import {
  resolveCleanverseClientConfig,
  type CleanverseClientConfig,
  type ResolvedCleanverseClientConfig,
} from "./config.js";
import { encryptPayload } from "./crypto.js";
import {
  CleanverseBusinessError,
  CleanverseConfigurationError,
  CleanverseHttpError,
  CleanverseMalformedResponseError,
  CleanverseNetworkError,
  CleanverseTimeoutError,
} from "./errors.js";

const cleanverseEnvelopeSchema = z
  .object({
    code: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
    data: z.unknown().optional(),
  })
  .passthrough();

const requestIdSchema = z.string().uuid();
const absoluteUrlPattern = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

export type CleanverseResponse<T> = {
  requestId: string;
  data: T;
};

type BaseRequestOptions<T> = {
  path: string;
  dataSchema: z.ZodType<T>;
  requestId?: string;
};

type PlainRequestOptions<T> = BaseRequestOptions<T> & {
  method: "GET" | "POST";
  body?: unknown;
};

type EncryptedRequestOptions<T> = BaseRequestOptions<T> & {
  body: unknown;
};

type InternalRequestOptions<T> = BaseRequestOptions<T> & {
  method: "GET" | "POST";
  body?: unknown;
  encrypted: boolean;
};

export class CleanverseClient {
  readonly #config: ResolvedCleanverseClientConfig;

  constructor(config: CleanverseClientConfig) {
    this.#config = resolveCleanverseClientConfig(config);
  }

  protected requestPlain<T>(
    options: PlainRequestOptions<T>,
  ): Promise<CleanverseResponse<T>> {
    return this.#request({
      ...options,
      encrypted: false,
    });
  }

  protected requestEncrypted<T>(
    options: EncryptedRequestOptions<T>,
  ): Promise<CleanverseResponse<T>> {
    return this.#request({
      ...options,
      method: "POST",
      encrypted: true,
    });
  }

  async #request<T>(
    options: InternalRequestOptions<T>,
  ): Promise<CleanverseResponse<T>> {
    const path = this.#normalizePath(options.path);
    const requestId = this.#resolveRequestId(options.requestId);

    if (options.method === "GET" && options.body !== undefined) {
      throw new CleanverseConfigurationError(
        "A Cleanverse GET request must not include a body.",
      );
    }

    const headers = new Headers({
      Accept: "application/json",
      "api-id": this.#config.apiId,
      "X-Request-ID": requestId,
    });
    let serializedBody: string | undefined;

    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");

      if (options.encrypted) {
        serializedBody = JSON.stringify(
          encryptPayload(
            options.body,
            this.#config.aesKey,
            this.#config.aesAlgorithm,
          ),
        );
      } else {
        serializedBody = this.#serializePlainBody(options.body);
      }
    }

    const abortController = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      abortController.abort();
    }, this.#config.timeoutMs);

    try {
      let response: Response;

      try {
        response = await this.#config.fetch(
          this.#resolveEndpointUrl(path),
          {
            method: options.method,
            headers,
            signal: abortController.signal,
            ...(serializedBody === undefined ? {} : { body: serializedBody }),
          },
        );
      } catch {
        if (timedOut) {
          throw new CleanverseTimeoutError(requestId);
        }

        throw new CleanverseNetworkError(requestId);
      }

      if (!response.ok) {
        throw new CleanverseHttpError(requestId, response.status);
      }

      let rawEnvelope: unknown;

      try {
        rawEnvelope = await response.json();
      } catch {
        if (timedOut) {
          throw new CleanverseTimeoutError(requestId);
        }

        throw new CleanverseMalformedResponseError(requestId);
      }

      const envelopeResult = cleanverseEnvelopeSchema.safeParse(rawEnvelope);

      if (!envelopeResult.success) {
        throw new CleanverseMalformedResponseError(requestId);
      }

      if (envelopeResult.data.code !== "0000") {
        throw new CleanverseBusinessError(
          requestId,
          envelopeResult.data.code,
        );
      }

      const dataResult = options.dataSchema.safeParse(envelopeResult.data.data);

      if (!dataResult.success) {
        throw new CleanverseMalformedResponseError(requestId);
      }

      return {
        requestId,
        data: dataResult.data,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  #normalizePath(path: string): string {
    const normalizedPath = path.replace(/^\/+/, "");

    if (
      normalizedPath.length === 0 ||
      path.trim() !== path ||
      absoluteUrlPattern.test(normalizedPath) ||
      path.startsWith("//") ||
      path.includes("#") ||
      path.includes("\\")
    ) {
      throw new CleanverseConfigurationError(
        "The Cleanverse endpoint path must be relative.",
      );
    }

    let pathSegments: string[];

    try {
      pathSegments = normalizedPath
        .split(/[/?]/)
        .map((segment) => decodeURIComponent(segment));
    } catch {
      throw new CleanverseConfigurationError(
        "The Cleanverse endpoint path contains invalid encoding.",
      );
    }

    if (
      pathSegments.some(
        (segment) =>
          segment === "." ||
          segment === ".." ||
          segment.includes("/") ||
          segment.includes("\\"),
      )
    ) {
      throw new CleanverseConfigurationError(
        "The Cleanverse endpoint path must not contain traversal segments.",
      );
    }

    return normalizedPath;
  }

  #resolveEndpointUrl(path: string): string {
    const endpointUrl = new URL(`${this.#config.baseUrl}/${path}`);
    const baseUrl = new URL(`${this.#config.baseUrl}/`);

    if (
      endpointUrl.origin !== baseUrl.origin ||
      !endpointUrl.pathname.startsWith(baseUrl.pathname)
    ) {
      throw new CleanverseConfigurationError(
        "The Cleanverse endpoint path must remain under the configured base URL.",
      );
    }

    return endpointUrl.toString();
  }

  #resolveRequestId(requestId?: string): string {
    let resolvedRequestId: string;

    try {
      resolvedRequestId = requestId ?? this.#config.requestIdFactory();
    } catch {
      throw new CleanverseConfigurationError(
        "The Cleanverse request-ID factory failed.",
      );
    }

    if (!requestIdSchema.safeParse(resolvedRequestId).success) {
      throw new CleanverseConfigurationError(
        "The Cleanverse request ID must be a valid UUID.",
      );
    }

    return resolvedRequestId;
  }

  #serializePlainBody(body: unknown): string {
    try {
      const serializedBody = JSON.stringify(body);

      if (serializedBody === undefined) {
        throw new TypeError("Payload is not JSON serializable.");
      }

      return serializedBody;
    } catch {
      throw new CleanverseConfigurationError(
        "The Cleanverse payload could not be serialized.",
      );
    }
  }
}
