import type { CreateAction } from "front-core";
import { ensureTemporarySessionFx } from "../model";

export const ENSURE_TEMPORARY_SESSION = "auth.ensure-temporary-session";

export const createEnsureTemporarySessionAction: CreateAction<void> = () => ({
  id: ENSURE_TEMPORARY_SESSION,
  llm: {
    microfrontend: "auth-mf",
    brief: "llm.actions.auth_ensure_temporary_session.brief",
    description: "llm.actions.auth_ensure_temporary_session.description",
  },
  exposure: "llm",
  priority: "normal",
  invoke: () => ensureTemporarySessionFx(),
});
