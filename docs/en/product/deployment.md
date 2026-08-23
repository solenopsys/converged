## Deployment

Converged supports several installation scenarios: from a small workshop to a production deployment in a company’s infrastructure. The base platform runs on **k3s**, a lightweight Kubernetes distribution suitable for edge devices, local servers, and cloud environments.

There are two main profiles:

- **Mono** — UI, Runtime, microservices, storage, and cache are packed compactly. This mode is for development, prototypes, demos, and small installations where simple startup matters most.
- **Multi** — UI, Runtime groups, domain groups of microservices, storage, and cache are separated. This is the standard production profile when isolation, scaling, and more precise load control are needed.

Both profiles use the same code. Only the container topology and configuration differ. A company can start with a compact installation and later move the same system into more serious infrastructure without rewriting the product.

In self-hosted scenarios, the client controls installation, networking, backups, updates, and the physical location of data. This fits companies with internal security requirements or a desire to keep production fully on their side. The cloud delivery removes operational work: the platform is deployed and updated by the service team, while the client receives a ready working environment.

A hybrid option is also possible: sensitive data and equipment stay local, while the cloud is used for updates, external access, coordination of distributed teams, or selected AI functions. The key principle is not to lock the client into a single delivery model.
