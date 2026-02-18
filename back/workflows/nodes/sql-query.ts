import { type INode, type Provider } from "../dag-api";
import { evaluateJsonPathString } from "back-core";
import { getProvidersPool } from "../providers";

function normalize(v: unknown) {
  if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  return v;
}

export default class SQLQueryNode implements INode {
  public scope!: string;

  constructor(
    public name: string,
    private query: string,
    private provider: string,
  ) {}

  private static readonly PARAM_RE = /:([\$.\w]+)/g;

  private static isCast(sql: string, matchIndex: number): boolean {
    if (matchIndex <= 0) return false;
    return sql.charCodeAt(matchIndex - 1) === 58; // Check for '::'
  }

  private static toJsonPath(token: string): string {
    if (token.startsWith("$")) return token;
    return token.startsWith("$.") ? token : `$.${token}`;
  }

  async execute(data: unknown): Promise<any> {
    const originalSql = this.query;

    // First pass: collect all non-cast parameters
    const tokens: string[] = [];
    const matches = Array.from(originalSql.matchAll(SQLQueryNode.PARAM_RE));

    for (const match of matches) {
      const matchIndex = match.index ?? -1;
      if (matchIndex >= 0 && !SQLQueryNode.isCast(originalSql, matchIndex)) {
        tokens.push(match[1]);
      }
    }

    // Create parameter mapping
    const indexMap = new Map<string, number>();
    const orderedUniqueTokens: string[] = [];
    for (const token of tokens) {
      if (!indexMap.has(token)) {
        indexMap.set(token, indexMap.size + 1);
        orderedUniqueTokens.push(token);
      }
    }

    // Evaluate parameters
    const jsonPaths = orderedUniqueTokens.map(SQLQueryNode.toJsonPath);
    const rawValues = await Promise.all(jsonPaths.map((jp) => evaluateJsonPathString(data, jp)));
    const paramValues = rawValues.map(normalize);

    // Replace parameters in SQL
    const sql = originalSql.replace(
      SQLQueryNode.PARAM_RE,
      (match, token: string, offset: number) => {
        if (SQLQueryNode.isCast(originalSql, offset)) {
          return match; // Keep cast expressions unchanged
        }
        const paramIndex = indexMap.get(token);
        return paramIndex ? `$${paramIndex}` : match;
      }
    );

    const realProvider: Provider = await getProvidersPool().getOrCreate(this.provider);
    return await realProvider.invoke("query", { sql, params: paramValues });
  }
}
