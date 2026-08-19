function onIncomingCall(call, gateway) {
  if (call.caller.startsWith("+84")) {
    return gateway.ai({
      contextId: "club-voice",
      model: "gpt-realtime-2.1",
      voice: "marin",
      transcriptionModel: "gpt-transcribe",
      vadThreshold: 0.7,
      vadSilenceMs: 500,
      interruptResponse: true,
      ...gateway.transferToHuman("sip:sales@sip.example.com"),
    });
  }

  if (call.dialed === "18005550199") {
    return gateway.human("sip:reception@sip.example.com", {
      language: "en",
      transcriptionModel: "gpt-transcribe",
    });
  }

  return gateway.fromRoute(call);
}
