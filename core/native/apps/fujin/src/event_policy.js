/**
 * Deployment-editable routing rules for the events Fujin fans out.
 *
 * `onEvent` sees each frame just before delivery and returns what should
 * actually be sent — or `null` to drop it. This is where a deployment
 * suppresses noise, raises a level or enriches a message without rebuilding the
 * router. Point FUJIN_EVENT_POLICY at another file to replace it wholesale.
 *
 * Two shapes arrive here:
 *   - `push`: a user notification from the `pushrouter` service, already
 *     addressed and validated. Return it as-is to deliver it unchanged.
 *   - `user_event`: the older fire-and-forget control event.
 */
function onEvent(event) {
  if (event.type === "push") {
    // Progress chatter is worth showing at the ends, not every percent: a
    // printer reporting continuously would otherwise bury everything else.
    const progress = event.payload && event.payload.progress;
    if (typeof progress === "number" && progress > 0 && progress < 100) {
      return null;
    }
    return event;
  }

  if (event.type === "user_event") {
    return {
      type: "signal",
      name: event.name || "user_event",
      payload: event.payload || null,
      source: "qjs"
    };
  }

  return event;
}
