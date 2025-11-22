# Converged

Converged is the open and free core of the Converged Platform, a project by [4ir.club](https://4ir.club).

## About

The 4ir.club project aims to create an open ecosystem for companies in the CNC machining and 3D printing sectors, uniting efforts to implement advanced IT and AI solutions to enhance production efficiency and increase profits.

Converged, as the core of this platform, provides the fundamental building blocks for this ecosystem. It is open source and free to use, embodying the mission of making Industry 4.0 technologies accessible to everyone.

## Directory Structure

-   `back`: Backend services and core logic.
-   `builders`: Scripts and tools for building the project.
-   `cli`: Command-line interface for interacting with the platform.
-   `dag`: Directed Acyclic Graph implementation for workflow management.
-   `front`: Frontend application and user interface components.
-   `nrpc`: Remote Procedure Call (RPC) framework.
-   `types`: Shared type definitions for the project.

 

podman build -f dag-core.Dockerfile -t dag-core .
podman build -f back-core.Dockerfile -t back-core .
podman build -f front-bootstrap.Dockerfile -t front-bootstrap .
