# Microservices Group: data

## Purpose
Groups storage-facing and data-utility services for files, exports, compression, and generic service data. These services provide reusable data operations to other domains while isolating persistence and data-transfer concerns behind service APIs.

## Responsibility Boundary
Owns data service boundaries at service layer; does not own business validation rules for each domain.
