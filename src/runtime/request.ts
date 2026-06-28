import { z, type ZodType } from "zod";
import { buildApiUrl, getConfiguredFetch } from "./config.js";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface RequestOptions<T> {
  method: HttpMethod;
  path: string;
  schema: ZodType<T>;
  query?: Record<string, string>;
  body?: unknown;
  form?: Record<string, string>;
  headers?: Record<string, string>;
}

const ErrorBodySchema = z.object({
  detail: z.unknown().optional()
}).passthrough();

function appendQuery(url: string, query?: Record<string, string>): string {
  if (!query) {
    return url;
  }
  const built = new URL(url);
  for (const [key, value] of Object.entries(query)) {
    built.searchParams.set(key, value);
  }
  return built.toString();
}

function buildBody(options: RequestOptions<unknown>): Pick<RequestInit, "body" | "headers"> {
  if (options.form) {
    const body = new URLSearchParams(options.form);
    return {
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...options.headers }
    };
  }
  if (options.body !== undefined) {
    return {
      body: JSON.stringify(options.body),
      headers: { "Content-Type": "application/json", ...options.headers }
    };
  }
  return { headers: options.headers };
}

export async function request<T>(options: RequestOptions<T>): Promise<T> {
  const url = appendQuery(buildApiUrl(options.path), options.query);
  const { body, headers } = buildBody(options as RequestOptions<unknown>);
  const response = await getConfiguredFetch()(url, {
    method: options.method,
    body,
    headers
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = ErrorBodySchema.safeParse(payload);
    const detail = parsed.success ? parsed.data.detail : undefined;
    throw new Error(typeof detail === "string" ? detail : `HTTP ${response.status}`);
  }

  return options.schema.parse(payload);
}
