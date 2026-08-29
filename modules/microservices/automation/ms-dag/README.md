# ms-dag

## Purpose
Executes DAG-based automation pipelines and dependency-aware jobs.

## Responsibility Boundary
Owns workflow graph scheduling/execution; does not own domain-specific business rules inside downstream services.

## Active workflow catalogue

Ptah supplies the active Solution's `WORKFLOWS` descriptors through the
service environment. This service exposes that metadata to clients together
with execution and task state. It does not select Solutions, download workflow
source code, or cache registry objects.
