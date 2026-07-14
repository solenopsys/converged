// Default policy preserves the store-backed route. Override this file through
// LLM_GATE_POLICY_SCRIPT to assemble a tenant-specific call flow.
function onIncomingCall(call, gateway) {
  return gateway.fromRoute(call);
}
