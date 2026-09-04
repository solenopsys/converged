## The module registry

The registry is not a separate document and not a database. It is the source tree itself.

```text
modules/
├── microservices/<domain>/ms-<name>    a data domain and its API
├── surfaces/<domain>/sf-<name>   a screen mounted at runtime
├── workflows/wf-<name>                 a process for the DAG runtime
├── types/<domain>/                     NRPC contracts
└── solutions/                          which modules ship together
```

A module exists because its directory exists. It belongs to a domain because it sits in that domain's folder. It belongs to a solution because `solutions/solutions.json` names it. There is no fourth place where any of this has to be repeated — which is why the ecosystem page on the site is produced by walking the tree rather than by editing a list.

A module's purpose is taken from its `README.md`: the first paragraph under `## Purpose` (for surfaces, `## UI Purpose`) and the paragraph under the ownership-boundary heading. Those two paragraphs are the module's contract in plain language, and every module owes them.

A product layer on top of the base — `club`, for instance — is laid out the same way and may drop the domain level: its modules sit directly in `modules/microservices/ms-<name>`. The build understands both layouts.
