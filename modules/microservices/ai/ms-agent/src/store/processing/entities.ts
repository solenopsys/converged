export interface LoopStateData {
  sessionId: string;
  iteration: number;
  status: "running" | "idle";
  updatedAt: number;
}
