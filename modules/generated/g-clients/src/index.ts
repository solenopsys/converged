// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

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

export const metadata: ServiceMetadata = {
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

// Server interface (to be implemented in microservice)
export interface ClientsService {
  createClient(client: Client): Promise<Client>;
  getClient(id: string): Promise<Client | any>;
  listClients(): Promise<Client[]>;
  updateClient(id: string, name: string): Promise<Client | any>;
  deleteClient(id: string): Promise<boolean>;
  createContact(contact: Contact): Promise<Contact>;
  getContact(id: string): Promise<Contact | any>;
  listContacts(clientId: string): Promise<Contact[]>;
  updateContact(id: string, patch: Partial<Pick<Contact, "type" | "value">>): Promise<Contact | any>;
  deleteContact(id: string): Promise<boolean>;
}

// Client interface
export interface ClientsServiceClient {
  createClient(client: Client): Promise<Client>;
  getClient(id: string): Promise<Client | any>;
  listClients(): Promise<Client[]>;
  updateClient(id: string, name: string): Promise<Client | any>;
  deleteClient(id: string): Promise<boolean>;
  createContact(contact: Contact): Promise<Contact>;
  getContact(id: string): Promise<Contact | any>;
  listContacts(clientId: string): Promise<Contact[]>;
  updateContact(id: string, patch: Partial<Pick<Contact, "type" | "value">>): Promise<Contact | any>;
  deleteContact(id: string): Promise<boolean>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createClientsServiceClient(
  config: CrullerTransportClientConfig,
): ClientsServiceClient {
  return createCrullerTransportClient<ClientsServiceClient>(metadata, config);
}

export function createClientsServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): ClientsServiceClient {
  return createClientsServiceClient(config);
}
