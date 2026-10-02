// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export interface Client {
  id: string;
  name: string;
}

export interface Contact {
  id: string;
  clientId: string;
  type: string;
  value: string;
}

const metadata: ServiceMetadata = {
  "interfaceName": "ClientsService",
  "serviceName": "clients",
  "filePath": "business/clients.ts",
  "methods": [
    {
      "name": "createClient",
      "parameters": [
        {
          "name": "client",
          "type": "Client",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Client",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getClient",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Client | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listClients",
      "parameters": [],
      "returnType": "Client",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "updateClient",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Client | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteClient",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "boolean",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "createContact",
      "parameters": [
        {
          "name": "contact",
          "type": "Contact",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Contact",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getContact",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Contact | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listContacts",
      "parameters": [
        {
          "name": "clientId",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Contact",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "updateContact",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "patch",
          "type": "Partial<Pick<Contact, \"type\" | \"value\">>",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Contact | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteContact",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "boolean",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "Client",
      "definition": "",
      "kind": "interface",
      "properties": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ]
    },
    {
      "name": "Contact",
      "definition": "",
      "kind": "interface",
      "properties": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "clientId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "type",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "value",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ]
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface ClientsServiceRtClient {
  createClient(client: Client): Client;
  getClient(id: string): Client | any;
  listClients(): Client[];
  updateClient(id: string, name: string): Client | any;
  deleteClient(id: string): boolean;
  createContact(contact: Contact): Contact;
  getContact(id: string): Contact | any;
  listContacts(clientId: string): Contact[];
  updateContact(id: string, patch: Partial<Pick<Contact, "type" | "value">>): Contact | any;
  deleteContact(id: string): boolean;
}

export function createClientsServiceRtClient(): ClientsServiceRtClient {
  return createRtClient<ClientsServiceRtClient>(metadata);
}
