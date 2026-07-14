function onEvent(event) {
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
