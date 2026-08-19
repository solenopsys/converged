import type { CreateAction } from "front-core";
import { ensureTemporarySessionFx } from "../model";

export const ENSURE_TEMPORARY_SESSION = "auth.ensure-temporary-session";

export const createEnsureTemporarySessionAction: CreateAction<void> = () => ({
  id: ENSURE_TEMPORARY_SESSION,
  description: "Ensure temporary auth session",
  invoke: () => ensureTemporarySessionFx(),
});
