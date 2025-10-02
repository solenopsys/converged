


import {   BaseRepositoryKV, SimpleKey, HashString, NameVersionKey,PrefixedRepositoryKV,VersionsRepository } from "back-core";
 


// code
const CODE_PREFIX = "code";
class CodeKey extends SimpleKey {
    readonly prefix = CODE_PREFIX;
}
type CodeValue = string;
class CodeRepository extends BaseRepositoryKV<CodeKey, CodeValue> {
 }

export { CODE_PREFIX, CodeKey, CodeRepository, CodeValue }

// source code
const CODE_SOURCE_PREFIX = "code_source";
class CodeSourceKey extends NameVersionKey {
    readonly prefix = CODE_SOURCE_PREFIX;
}

type CodeSourceValue = {
    code_hash: HashString,
    params: { name: HashString, type: string }[]
}
class CodeSoruceRepository extends VersionsRepository<CodeSourceKey, CodeSourceValue> {
    getPrefix(): string[] {
        return [CODE_SOURCE_PREFIX];
    }
 }


export { CODE_SOURCE_PREFIX, CodeSourceKey, CodeSoruceRepository, CodeSourceValue }

// workflow config
const WORKFLOW_CONFIG_PREFIX = "workflow_config";

class WorkflowConfigKey extends SimpleKey {
    readonly prefix = WORKFLOW_CONFIG_PREFIX;
}
type WorkflowConfigValue =  {
    nodes: { [name: string]:  HashString }; 
    links: { from: string, to: string }[]; 
    description?: string
    aspects?: { [name: string]: any }
};

class WorkflowConfigRepository extends BaseRepositoryKV<WorkflowConfigKey, WorkflowConfigValue> { 
}

export { WORKFLOW_CONFIG_PREFIX, WorkflowConfigKey, WorkflowConfigRepository, WorkflowConfigValue } 
// workflow
const WORKFLOW_PREFIX = "workflow";
class WorkflowKey extends NameVersionKey {
    readonly prefix = WORKFLOW_PREFIX;
}
type WorkflowValue = HashString;
class WorkflowRepository extends VersionsRepository<WorkflowKey, WorkflowValue> { 
    getPrefix(): string[] {
        return [WORKFLOW_PREFIX];
    }
}


export { WORKFLOW_PREFIX, WorkflowKey, WorkflowRepository, WorkflowValue }

// provider 
const PROVIDER_PREFIX = "provider";
class ProviderKey extends SimpleKey {
    readonly prefix = PROVIDER_PREFIX;
}
type ProviderValue = {
    config: any,
    codeName: string,
    codeVersion: string
};

class ProviderRepository extends VersionsRepository<ProviderKey, ProviderValue> {
    getPrefix(): string[] {
        return [PROVIDER_PREFIX];
    }
 }

export { PROVIDER_PREFIX, ProviderKey, ProviderRepository, ProviderValue }
// node_config
const NODE_CONFIG_PREFIX = "node_config";
class NodeConfigKey extends SimpleKey {
    readonly prefix = NODE_CONFIG_PREFIX;
}
type NodeConfigValue = {
    config: any,
    codeName: string,
    codeVersion: string
};
class NodeConfigRepository extends BaseRepositoryKV<NodeConfigKey, NodeConfigValue> { }

export { NODE_CONFIG_PREFIX, NodeConfigKey, NodeConfigRepository, NodeConfigValue }
// node

const NODE_PREFIX = "node";
class NodeKey extends NameVersionKey {
    readonly prefix = NODE_PREFIX;
}
type NodeValue = HashString;
class NodeRepository extends VersionsRepository<NodeKey, NodeValue> { 
    getPrefix(): string[] {
        return [NODE_PREFIX];
    }
}

export { NODE_PREFIX, NodeKey, NodeRepository, NodeValue }

// param 

const PARAM_PREFIX = "param";
class ParamKey extends SimpleKey {
    readonly prefix = PARAM_PREFIX;
}
type ParamValue = string;
class ParamRepository extends PrefixedRepositoryKV<ParamKey, ParamValue> {
    getPrefix(): string[] {
        return [PARAM_PREFIX];
    }
 }

export { PARAM_PREFIX, ParamKey, ParamRepository, ParamValue }
// webhook

const WEBHOOK_PREFIX = "webhook";
class WebhookKey extends NameVersionKey {
    readonly prefix = WEBHOOK_PREFIX;
}
type WebhookValue = {
    url: string,
    method: string,
    workflow_id: string,
    options?: any
};
class WebhookRepository extends BaseRepositoryKV<WebhookKey, WebhookValue> { }

export { WEBHOOK_PREFIX, WebhookKey, WebhookRepository, WebhookValue }









