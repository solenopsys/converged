# Workflow Server

This is a powerful and flexible workflow automation server built with Bun, Elysia, and TypeScript. It allows you to define, manage, and execute complex workflows using a simple JSON-based schema. The server provides a RESTful API for interacting with workflows, webhooks, and processes.

## Features

*   **Workflow Management:** Create, update, delete, and retrieve workflows.
*   **Dynamic Execution:** Execute workflows with custom data.
*   **Extensible Node System:** Easily add new node types to perform custom actions.
*   **Webhooks:** Trigger workflows and receive notifications via webhooks.
*   **Process Tracking:** Monitor the status and context of running processes.
*   **Versioning:** Workflows are versioned, allowing you to roll back to previous versions.
*   **Swagger Documentation:** Interactive API documentation is available out of the box.

## Getting Started

### Prerequisites

*   [Bun](https://bun.sh/) installed on your system.

### Installation

1.  Clone the repository:

    ```bash
    git clone https://github.com/your-username/your-repo.git
    cd your-repo
    ```

2.  Install the dependencies:

    ```bash
    bun install
    ```

### Configuration

Create a `.env` file in the root of the project and add the following environment variables:

```
LEVEL_DB_PATH=temp/leveldb
SQLITE_PATH=temp/sqlite.db
DATABASE_URL=postgresql://postgres:123456@127.0.0.1:35432
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini
PORT=3000
```

### Running the Server

```bash
bun run dev
```

The server will start on `http://localhost:3000`.

## API Documentation

Interactive API documentation is available at `http://localhost:3000/docs`.

### Workflow API

#### `GET /api/workflows`

Retrieves all workflows.

**Example Response:**

```json
[
  {
    "id": "...",
    "name": "My Workflow",
    "before_id": null,
    "created_at": "...",
    "nodes": [...],
    "links": [...]
  }
]
```

#### `POST /api/workflows`

Creates a new workflow.

**Request Body:**

```json
{
  "name": "My New Workflow",
  "workflow": {
    "nodes": {
      "start": {
        "type": "start"
      },
      "log": {
        "type": "print",
        "params": {
          "message": "Hello, {{data.name}}!"
        }
      }
    },
    "connections": {
      "start": ["log"]
    }
  }
}
```

#### `GET /api/workflows/:id`

Retrieves a specific workflow by its ID.

#### `PUT /api/workflows/:id`

Updates a workflow. This creates a new version of the workflow.

#### `DELETE /api/workflows/:id`

Deletes a workflow and all its associated nodes and links.

#### `POST /api/workflows/:id/execute`

Executes a workflow.

**Request Body:**

```json
{
  "startNode": "start",
  "data": {
    "name": "World"
  }
}
```

### Webhook API

#### `POST /api/workflows/:id/webhooks`

Adds a webhook to a workflow.

**Request Body:**

```json
{
  "url": "https://example.com/my-webhook",
  "secret": "my-secret"
}
```

### Available Nodes

*   `start`: The entry point of a workflow.
*   `print`: Logs a message to the console.
*   `ai-request`: Makes a request to an AI model.
*   `sql-query`: Executes a SQL query.
*   `template`: Injects data into a template.
*   `random`: Generates a random string.
*   `mark`: A placeholder node.
*   `mock`: A mock node for testing.

## Building for Production

To build the project for production, run:

```bash
bun run bld
```

This will create a production-ready build in the `dist` directory.



bun bld
buildah bud  -t public.ecr.aws/i5x9u8b2/dag .
buildah push public.ecr.aws/i5x9u8b2/dag
