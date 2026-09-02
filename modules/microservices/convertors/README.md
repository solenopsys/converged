# Microservices Group: convertors

## Purpose
Groups backend services and components that transform models and data formats between internal and external representations. This keeps conversion rules reusable and prevents format-specific concerns from leaking into the services that create or consume domain data.

## Responsibility Boundary
Owns conversion-domain service partitioning; does not own source data creation workflows.
