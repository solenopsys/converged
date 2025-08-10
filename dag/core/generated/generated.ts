// Auto-generated backend configuration
import { createHttpBackend } from 'nrpc';
import serviceImpl from '../src/dag-service.ts';

const metadata = {
  "interfaceName": "DagService",
  "serviceName": "dag",
  "filePath": "/home/alexstorm/distrib/4ir/CONVERGED/public/dag/types/interface.ts",
  "methods": [
    {
      "name": "status",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    },
    {
      "name": "setCode",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "code",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    },
    {
      "name": "codeList",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    },
    {
      "name": "createNode",
      "parameters": [
        {
          "name": "nodeCode",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "config",
          "type": "any",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    },
    {
      "name": "runCode",
      "parameters": [
        {
          "name": "hash",
          "type": "HashString",
          "optional": false,
          "isArray": false
        },
        {
          "name": "params",
          "type": "any",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    },
    {
      "name": "startProcess",
      "parameters": [
        {
          "name": "workflowId",
          "type": "string",
          "optional": true,
          "isArray": false
        },
        {
          "name": "meta",
          "type": "any",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    },
    {
      "name": "createWorkflow",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "nodes",
          "type": "HashString",
          "optional": false,
          "isArray": true
        },
        {
          "name": "links",
          "type": "any",
          "optional": false,
          "isArray": true
        },
        {
          "name": "description",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    },
    {
      "name": "createWebhook",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "url",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "method",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "workflowId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "options",
          "type": "any",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    }
  ],
  "types": [
    {
      "name": "Hash",
      "definition": "Uint8Array[32]"
    },
    {
      "name": "HashString",
      "definition": "string"
    },
    {
      "name": "EntityType",
      "definition": "\"node\" | \"receipt\" | \"provider\""
    },
    {
      "name": "Node",
      "definition": "{\n    id: number;\n    name: string;\n    current_version: Uint8Array;\n}"
    },
    {
      "name": "NodeCode",
      "definition": "{\n    hash: Hash;\n    body: Uint8Array;\n    created_at: string;\n}"
    },
    {
      "name": "Base64",
      "definition": "{\n    base64: string;\n}"
    }
  ]
};

const config = {
  metadata,
  
  serviceImpl,
};

export default createHttpBackend(config);
