# CuraEngine

CuraEngine prepares FDM and FFF jobs for Converged. Given a model and a printer
profile, it divides the geometry into layers, generates walls, infill, and
support paths, then writes the G-code a material-extrusion printer executes.
It is the slicer in the Cura ecosystem, used here without the desktop UI.

The native wrapper runs `CuraEngine slice` in an isolated temporary directory
and returns the generated G-code through its C ABI. Running the slicer out of
process contains its global state and failure paths, so one invalid model or
profile does not take down the processor that requested the slice.

The wrapper prepares a job; it does not send G-code to a printer. Dispatch and
execution are handled later by the appropriate equipment adapter.
