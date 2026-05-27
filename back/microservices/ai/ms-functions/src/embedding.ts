import OpenAI from "openai";
import { createHash } from "crypto";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_MODEL_VERSION = "2024-01";
const EMBEDDING_DIMS = 1536;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    client = new OpenAI({ apiKey });
  }
  return client;
}

export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export function buildEmbeddingInput(brief: string, description: string): string {
  return `${brief}. ${description}`.trim();
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    encoding_format: "float",
  });
  return response.data[0].embedding;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export { EMBEDDING_MODEL, EMBEDDING_MODEL_VERSION, EMBEDDING_DIMS };
