import type { Entity } from "back-core";
import type { HashString, Workflow } from "../../../dag-types/interface";

// ==================== CODE SOURCES ====================

export interface CodeEntity extends Entity {
    code_hash: HashString;
    params: { name: string; type: string }[];
    extractKey(): { name: string; version: string };
}

export interface NodeConfigEntity extends Entity {
    config: any;
    codeName: string;
    codeVersion: string;
    extractKey(): HashString;
}

export interface ProviderEntity extends Entity {
    config: any;
    codeName: string;
    codeVersion: string;
    extractKey(): string;
}

export interface WorkflowConfigEntity extends Entity {
    workflow: Workflow;
    extractKey(): HashString;
}

export interface WorkflowRefEntity extends Entity {
    workflow_version_hash: HashString;
    extractKey(): { name: string; version: string };
}

export interface WebhookEntity extends Entity {
    url: string;
    method: string;
    workflow_id: string;
    options?: any;
    extractKey(): { name: string; version: string };
}
