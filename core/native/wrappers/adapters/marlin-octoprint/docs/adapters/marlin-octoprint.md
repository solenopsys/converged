# Marlin serial adapter

The Marlin adapter is the direct serial path from Converged to an FDM printer
running Marlin firmware. It opens the printer's serial port, sends G-code, and
tracks the protocol details that make a print stream reliable: line numbers,
checksums, `ok` replies, and resend requests.

The API covers job control, motion and homing, heaters, extrusion, SD-card
operations, emergency stop, and raw G-code. Firmware responses are parsed into
printer state: temperatures, coordinates, identity, SD progress, and print
status. This lets the equipment layer use a single state model while the
adapter continues to speak the firmware's serial protocol.

The name remains for compatibility with the surrounding API. The wrapper does
not run OctoPrint or call its HTTP API; it speaks directly to Marlin.
