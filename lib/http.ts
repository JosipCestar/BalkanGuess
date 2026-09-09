export class HttpProblem extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpProblem";
  }
}

export async function readJsonBody<T>(request: Request, maxBytes = 2_048): Promise<T> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new HttpProblem(415, "Content-Type must be application/json.");

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new HttpProblem(413, "Request body is too large.");
  if (!request.body) throw new HttpProblem(400, "Request body is required.");

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new HttpProblem(413, "Request body is too large.");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpProblem(400, "Request body must contain valid JSON.");
  }
}
