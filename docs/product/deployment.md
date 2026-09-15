## Deployment

Converged supports several deployment scenarios — from compact edge devices and local servers to cloud infrastructure serving many independent companies. The base platform runs on **k3s**, a lightweight Kubernetes distribution suitable for microcomputers, local infrastructure, and cloud clusters.

There are three main deployment profiles:

* **Mono** — UI, Services, storage, and cache run in a compact configuration on a single machine. It is well suited for **microcomputers such as Raspberry Pi and Orange Pi**, edge devices, small local servers, development, prototypes, and demos.
* **Multi** — the system is distributed across multiple machines in a Kubernetes cluster. UI, groups of Services, storage, and cache can be deployed and scaled independently. This profile is suitable for production environments where additional capacity, fault tolerance, and more precise resource control are required.
* **Cloud** — multiple companies operate within the **same Kubernetes cluster** using a multi-tenant architecture. Each **tenant** has an isolated environment with its own data, configuration, and resources, while the underlying cluster infrastructure is shared. This allows many companies to be served efficiently without requiring a separate cluster for each customer.

All three profiles use the same codebase. Only the deployment topology and configuration change. A system can therefore start as a compact Mono installation on a microcomputer, move to a Multi cluster as requirements grow, or run as a Cloud service shared by many independent companies.

In a **self-hosted** deployment, the company controls the installation, networking, backups, updates, and physical location of its data. This is suitable for organizations that need full control over their infrastructure.

In **Cloud**, the infrastructure is operated centrally. Multiple companies share the same cluster while remaining isolated at the tenant level, including their data, configuration, and allocated resources.

A **hybrid** deployment is also possible: sensitive data and equipment can remain local, while the cloud is used for updates, external access, distributed teams, or selected AI capabilities.

The key principle is that **Converged does not lock the platform into a single deployment model**. The same system can run on a small microcomputer, across a multi-machine cluster, or as a multi-tenant Cloud service.
