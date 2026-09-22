# UVtools direct adapter

The UVtools adapter prepares files for resin printers. It runs `UVtoolsCmd`
against sliced files, where it can inspect layers, validate a file, repair it,
convert between supported formats, extract thumbnails, and report file
properties or detected issues. That work happens before a file is handed to a
printer adapter.

The wrapper keeps UVtools as an external executable. Its API exposes the raw
argument path as well as named operations for conversion, inspection,
comparison, thumbnail extraction, and issue reporting. It returns the child
process's standard output, standard error, exit status, and adapter state to
the caller.

UVtools itself must be installed on the host. The wrapper supplies the process
boundary: command timeout, working directory, output limits, and result
capture.
