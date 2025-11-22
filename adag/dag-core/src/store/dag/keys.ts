import { SimpleKey, NameVersionKey, type KeyKV } from "back-core";
import type { HashString } from "../../../dag-types/interface";

// ==================== CODE SOURCES ====================

export class CodeHashKey extends SimpleKey {
    readonly prefix = "code";

    constructor(hash: HashString) {
        super(hash);
    }
}

export class CodeSourceKey extends NameVersionKey {
    readonly prefix = "code_source";

    constructor(name: string, version: string) {
        super(name, version);
    }
}

// ==================== NODES ====================

export class NodeConfigKey extends SimpleKey {
    readonly prefix = "node_config";

    constructor(hash: HashString) {
        super(hash);
    }
}

export class NodeKey extends NameVersionKey {
    readonly prefix = "node";

    constructor(name: string, version: string) {
        super(name, version);
    }
}

// ==================== PROVIDERS ====================

export class ProviderKey extends SimpleKey {
    readonly prefix = "provider";

    constructor(name: string) {
        super(name);
    }
}

// ==================== WORKFLOWS ====================

export class WorkflowConfigKey extends SimpleKey {
    readonly prefix = "workflow_config";

    constructor(hash: HashString) {
        super(hash);
    }
}

export class WorkflowKey extends NameVersionKey {
    readonly prefix = "workflow";

    constructor(name: string, version: string) {
        super(name, version);
    }
}

// ==================== PARAMS ====================

export class ParamKey extends SimpleKey {
    readonly prefix = "param";

    constructor(name: string) {
        super(name);
    }
}

// ==================== WEBHOOKS ====================

export class WebhookKey extends NameVersionKey {
    readonly prefix = "webhook";

    constructor(name: string, version: string) {
        super(name, version);
    }
}
