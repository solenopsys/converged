# MTConnect CppAgent

This wrapper runs the MTConnect C++ Agent for Converged. The agent receives
signals from configured machine adapters and publishes them as an MTConnect
data stream. It gives CNC equipment, robots, sensors, and other shop-floor
devices a common model that the rest of the platform can consume.

The wrapper starts `cppagent` with an `agent.cfg`, waits until its HTTP endpoint
is ready, and stops the process when the service is released. Device XML
describes the equipment model; the agent configuration selects adapters,
ports, and runtime options. Clients read the resulting `/probe`, `/current`,
and `/sample` endpoints from the running agent.

The integration is deliberately process-based. It uses the agent's native
configuration and HTTP interface rather than embedding its C++ library in the
Zig runtime.
