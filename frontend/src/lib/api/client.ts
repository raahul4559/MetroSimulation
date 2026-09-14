import { env } from "@/config/env";

export interface ProblemDetail {
  readonly type?: string;
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
  readonly instance?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: ProblemDetail | null
  ) {
    super(problem?.detail ?? `Request failed with status ${status}`);
    this.name = "ApiError";
  }
}

async function request<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(0, {
      title: "Network error",
      detail: `Could not reach the API at ${baseUrl}. Is the backend running?`,
    });
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new ApiError(response.status, problem);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function createApiClient(baseUrl: string) {
  return {
    get: <T>(path: string) => request<T>(baseUrl, path),
    post: <T>(path: string) => request<T>(baseUrl, path, { method: "POST" }),
  };
}

/** The simulation-clock API — `/api/v1/*`. */
export const apiClient = createApiClient(env.apiBaseUrl);

/** The metro network/routing graph API — `/api/metro/*`, a separate base path on the same backend. */
export const metroApiClient = createApiClient(env.metroApiBaseUrl);
