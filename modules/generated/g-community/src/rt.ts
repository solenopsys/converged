// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type SectionId = string;

export type TopicId = string;

export type ThreadId = string;

export type UserId = string;

export type ISODateString = string;

export type PaginatedResult<T> = {
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
	filter?: FilterObject;
};

export type FilterObject = Record<string, unknown>;

export type SelectionFieldDescriptor = { id: string; label: string; valueType: "string" | "number" | "boolean" | "date" | "enum"; operators: string[] };

export type SelectionDescriptor = { objectType: string; title: string; fields: SelectionFieldDescriptor[]; filterExample?: FilterObject; revision?: string };

export type SelectionStats = { totalCount: number };

export type SectionTreeNode = CommunitySection & {
  children: SectionTreeNode[];
};

const metadata: ServiceMetadata = {
  "interfaceName": "CommunityService",
  "serviceName": "community",
  "filePath": "communications/community.ts",
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
      "returnType": "CommunitySection | any",
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
      "returnType": "PaginatedResult<CommunitySection>",
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
      "returnType": "CommunityTopic | any",
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
      "returnType": "PaginatedResult<CommunityTopic>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "describeSelection",
      "parameters": [
        {
          "name": "objectType",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "SelectionDescriptor",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "inspectTopics",
      "parameters": [
        {
          "name": "filter",
          "type": "FilterObject",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "SelectionStats",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "SectionId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "TopicId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ThreadId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "UserId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    },
    {
      "name": "ListParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n}"
    },
    {
      "name": "CommunitySection",
      "kind": "type",
      "definition": "{\n  id: SectionId;\n  parentId?: SectionId;\n  slug: string;\n  title: string;\n  description?: string;\n  sortOrder: number;\n  isHidden: boolean;\n  createdAt: ISODateString;\n  updatedAt: ISODateString;\n}"
    },
    {
      "name": "CommunitySectionInput",
      "kind": "type",
      "definition": "{\n  id?: SectionId;\n  parentId?: SectionId;\n  slug: string;\n  title: string;\n  description?: string;\n  sortOrder?: number;\n  isHidden?: boolean;\n}"
    },
    {
      "name": "CommunityTopic",
      "kind": "type",
      "definition": "{\n  id: TopicId;\n  sectionId: SectionId;\n  threadId: ThreadId;\n  title: string;\n  createdBy: UserId;\n  isPinned: boolean;\n  isLocked: boolean;\n  isArchived: boolean;\n  lastActivityAt: ISODateString;\n  createdAt: ISODateString;\n  updatedAt: ISODateString;\n}"
    },
    {
      "name": "CommunityTopicInput",
      "kind": "type",
      "definition": "{\n  id?: TopicId;\n  sectionId: SectionId;\n  threadId: ThreadId;\n  title: string;\n  createdBy: UserId;\n  isPinned?: boolean;\n  isLocked?: boolean;\n  isArchived?: boolean;\n  lastActivityAt?: ISODateString;\n}"
    },
    {
      "name": "SectionListParams",
      "kind": "type",
      "definition": "ListParams & {\n  parentId?: SectionId;\n  includeHidden?: boolean;\n}"
    },
    {
      "name": "TopicListParams",
      "kind": "type",
      "definition": "ListParams & {\n  sectionId?: SectionId;\n  includeArchived?: boolean;\n  query?: string;\n\tfilter?: FilterObject;\n}"
    },
    {
      "name": "FilterObject",
      "kind": "type",
      "definition": "Record<string, unknown>"
    },
    {
      "name": "SelectionFieldDescriptor",
      "kind": "type",
      "definition": "{ id: string; label: string; valueType: \"string\" | \"number\" | \"boolean\" | \"date\" | \"enum\"; operators: string[] }"
    },
    {
      "name": "SelectionDescriptor",
      "kind": "type",
      "definition": "{ objectType: string; title: string; fields: SelectionFieldDescriptor[]; filterExample?: FilterObject; revision?: string }"
    },
    {
      "name": "SelectionStats",
      "kind": "type",
      "definition": "{ totalCount: number }"
    },
    {
      "name": "SectionTreeNode",
      "kind": "type",
      "definition": "CommunitySection & {\n  children: SectionTreeNode[];\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface CommunityServiceRtClient {
  saveSection(input: CommunitySectionInput): SectionId;
  readSection(id: SectionId): CommunitySection | any;
  deleteSection(id: SectionId): boolean;
  listSections(params: SectionListParams): PaginatedResult<CommunitySection>;
  readSectionsTree(rootId?: SectionId, includeHidden?: boolean): SectionTreeNode[];
  saveTopic(input: CommunityTopicInput): TopicId;
  readTopic(id: TopicId): CommunityTopic | any;
  deleteTopic(id: TopicId): boolean;
  listTopics(params: TopicListParams): PaginatedResult<CommunityTopic>;
  describeSelection(objectType: string): SelectionDescriptor;
  inspectTopics(filter?: FilterObject): SelectionStats;
}

export function createCommunityServiceRtClient(): CommunityServiceRtClient {
  return createRtClient<CommunityServiceRtClient>(metadata);
}
