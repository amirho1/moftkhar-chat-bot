import { setTimeout as delay } from "node:timers/promises";

/** A management-only client. Never import this into browser code. */
export class DocsGPTClient {
  constructor(
    readonly base: string,
    readonly token: string,
  ) {
    if (!token)
      throw new Error("DOCSGPT_MANAGEMENT_TOKEN is missing; run setup");
  }

  async request(
    method: string,
    path: string,
    body?: object | FormData,
    extra: Record<string, string> = {},
  ) {
    const form = body instanceof FormData;
    const response = await fetch(this.base.replace(/\/$/, "") + path, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(!form && body ? { "Content-Type": "application/json" } : {}),
        ...extra,
      },
      body: body ? (form ? body : JSON.stringify(body)) : undefined,
      redirect: "error",
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok)
      throw new Error(
        `DocsGPT ${method} ${path.split("?")[0]} returned HTTP ${response.status}; response body withheld`,
      );
    return response.json() as Promise<any>;
  }

  async wait(taskId: string, timeoutMs = 1200000) {
    if (!taskId) throw new Error("Ingest returned no task identifier");
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const result = await this.request(
        "GET",
        `/api/task_status?task_id=${encodeURIComponent(taskId)}`,
      );
      if (result.status === "SUCCESS") return;
      if (["FAILURE", "REVOKED"].includes(result.status))
        throw new Error("Indexing failed; inspect protected operator status");
      await delay(3000);
    }
    throw new Error("Indexing timed out; chat remains disabled");
  }
}
