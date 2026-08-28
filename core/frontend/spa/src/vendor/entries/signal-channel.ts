/**
 * The cluster's WS transport. The socket singleton is the reason it must be a
 * shared file: a second instance would mean a second handshake and a second
 * request queue.
 */
export * from "signal-channel";
