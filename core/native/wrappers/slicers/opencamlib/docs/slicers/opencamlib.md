# OpenCAMLib

OpenCAMLib supplies the geometric part of the CNC toolpath flow in Converged.
It works from STL surface geometry and cutter parameters to calculate milling
paths and estimates. Where CuraEngine builds additive paths layer by layer,
OpenCAMLib models the cutter's contact with the workpiece for subtractive
operations.

The library implements drop-cutter, push-cutter, and waterline operations, and
supports cylindrical, ball, bull, cone, and composite cutters. The local
wrapper exposes the small C ABI needed by the existing STL milling-estimate
flow and builds the upstream C++ library as a native artifact.

OpenCAMLib produces toolpath geometry. Post-processing it into the command
dialect of a particular controller, then running it on a machine, belongs to
the CAM and equipment paths that follow.
