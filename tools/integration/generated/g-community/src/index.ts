// Auto-generated package
import { createHttpClient } from "nrpc";

export type SectionId = string;

export type TopicId = string;

export type ThreadId = string;

export type UserId = string;

export type ISODateString = string;

export type PaginatedResult = {
  items: T[];
  totalCount?: number;
};

export type ListParams = {
  offset: number;
  limit: number;
};

export type CommunitySection = {
  id: SectionId;
  parentId?: SectionId;
  slug: string;
  title: string;
  description?: string;
  sortOrder: number;
  isHidden: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type CommunitySectionInput = {
  id?: SectionId;
  parentId?: SectionId;
  slug: string;
  title: string;
  description?: string;
  sortOrder?: number;
  isHidden?: boolean;
};

export type CommunityTopic = {
  id: TopicId;
  sectionId: SectionId;
  threadId: ThreadId;
  title: string;
  createdBy: UserId;
  isPinned: boolean;
  isLocked: boolean;
  isArchived: boolean;
  lastActivityAt: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type CommunityTopicInput = {
  id?: TopicId;
  sectionId: SectionId;
  threadId: ThreadId;
  title: string;
  createdBy: UserId;
  isPinned?: boolean;
  isLocked?: boolean;
  isArchived?: boolean;
  lastActivityAt?: ISODateString;
};

export type SectionListParams = ListParams & {
  parentId?: SectionId;
  includeHidden?: boolean;
};

export type TopicListParams = ListParams & {
  sectionId?: SectionId;
  includeArchived?: boolean;
  query?: string;
};

export type SectionTreeNode = CommunitySection & {
  children: SectionTreeNode[];
};

export const metadata = {
  "interfaceName": "CommunityService",
  "serviceName": "community",
  "filePath": "../types/community.ts",
  "methods": [
    {
      "name": "saveSection",
      "parameters": [
        {
          "name": "input",
          "type": "CommunitySectionInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "SectionId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "readSection",
      "parameters": [
        {
          "name": "id",
          "type": "SectionId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteSection",
      "parameters": [
        {
          "name": "id",
          "type": "SectionId",
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
      "name": "listSections",
      "parameters": [
        {
          "name": "params",
          "type": "SectionListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "readSectionsTree",
      "parameters": [
        {
          "name": "rootId",
          "type": "SectionId",
          "optional": true,
          "isArray": false
        },
        {
          "name": "includeHidden",
          "type": "boolean",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "SectionTreeNode",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "saveTopic",
      "parameters": [
        {
          "name": "input",
          "type": "CommunityTopicInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "TopicId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "readTopic",
      "parameters": [
        {
          "name": "id",
          "type": "TopicId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteTopic",
      "parameters": [
        {
          "name": "id",
          "type": "TopicId",
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
      "name": "listTopics",
      "parameters": [
        {
          "name": "params",
          "type": "TopicListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "SectionId",
      "definition": "string"
    },
    {
      "name": "TopicId",
      "definition": "string"
    },
    {
      "name": "ThreadId",
      "definition": "string"
    },
    {
      "name": "UserId",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "definition": "string"
    },
    {
      "name": "PaginatedResult",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    },
    {
      "name": "ListParams",
      "definition": "{\n  offset: number;\n  limit: number;\n}"
    },
    {
      "name": "CommunitySection",
      "definition": "{\n  id: SectionId;\n  parentId?: SectionId;\n  slug: string;\n  title: string;\n  description?: string;\n  sortOrder: number;\n  isHidden: boolean;\n  createdAt: ISODateString;\n  updatedAt: ISODateString;\n}"
    },
    {
      "name": "CommunitySectionInput",
      "definition": "{\n  id?: SectionId;\n  parentId?: SectionId;\n  slug: string;\n  title: string;\n  description?: string;\n  sortOrder?: number;\n  isHidden?: boolean;\n}"
    },
    {
      "name": "CommunityTopic",
      "definition": "{\n  id: TopicId;\n  sectionId: SectionId;\n  threadId: ThreadId;\n  title: string;\n  createdBy: UserId;\n  isPinned: boolean;\n  isLocked: boolean;\n  isArchived: boolean;\n  lastActivityAt: ISODateString;\n  createdAt: ISODateString;\n  updatedAt: ISODateString;\n}"
    },
    {
      "name": "CommunityTopicInput",
      "definition": "{\n  id?: TopicId;\n  sectionId: SectionId;\n  threadId: ThreadId;\n  title: string;\n  createdBy: UserId;\n  isPinned?: boolean;\n  isLocked?: boolean;\n  isArchived?: boolean;\n  lastActivityAt?: ISODateString;\n}"
    },
    {
      "name": "SectionListParams",
      "definition": "ListParams & {\n  parentId?: SectionId;\n  includeHidden?: boolean;\n}"
    },
    {
      "name": "TopicListParams",
      "definition": "ListParams & {\n  sectionId?: SectionId;\n  includeArchived?: boolean;\n  query?: string;\n}"
    },
    {
      "name": "SectionTreeNode",
      "definition": "CommunitySection & {\n  children: SectionTreeNode[];\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface CommunityService {
  saveSection(input: CommunitySectionInput): Promise<SectionId>;
  readSection(id: SectionId): Promise<any>;
  deleteSection(id: SectionId): Promise<boolean>;
  listSections(params: SectionListParams): Promise<PaginatedResult>;
  readSectionsTree(rootId?: SectionId, includeHidden?: boolean): Promise<SectionTreeNode[]>;
  saveTopic(input: CommunityTopicInput): Promise<TopicId>;
  readTopic(id: TopicId): Promise<any>;
  deleteTopic(id: TopicId): Promise<boolean>;
  listTopics(params: TopicListParams): Promise<PaginatedResult>;
}

// Client interface
export interface CommunityServiceClient {
  saveSection(input: CommunitySectionInput): Promise<SectionId>;
  readSection(id: SectionId): Promise<any>;
  deleteSection(id: SectionId): Promise<boolean>;
  listSections(params: SectionListParams): Promise<PaginatedResult>;
  readSectionsTree(rootId?: SectionId, includeHidden?: boolean): Promise<SectionTreeNode[]>;
  saveTopic(input: CommunityTopicInput): Promise<TopicId>;
  readTopic(id: TopicId): Promise<any>;
  deleteTopic(id: TopicId): Promise<boolean>;
  listTopics(params: TopicListParams): Promise<PaginatedResult>;
}

// Factory function
export function createCommunityServiceClient(
  config?: { baseUrl?: string },
): CommunityServiceClient {
  return createHttpClient<CommunityServiceClient>(metadata, config);
}

// Ready-to-use client
export const communityClient = createCommunityServiceClient();
