 
import type { HashString, Workflow, CodeSource } from '../../../types/interface';
import { genHash } from '../tools';
import { preciseStringfy } from '../tools';
import { timeVersion,extractCommentParam } from './utils/utils';

import { LMWrapper } from './utils/lmwrapper';

const CODE = "code";
const CODE_SOURCE = "code_source";
const WORKFLOW = "workflow";
const WORKFLOW_CONFIG = "workflow_config";
const PROVIDER = "provider";
const NODE = "node";
const PARAM = "param";
const WEBHOOK = "webhook";


export class SchemeStore  { 
  private dag: LMWrapper;

  private constructor(dataDir:string) {
    this.dag = new LMWrapper(dataDir, 'dag');
  }
 
  saveCode(body: string) {
    const hashString = genHash(body);
    this.dag.put([CODE, hashString], body);
    return hashString;
  }

  listCodeSoruce(): string[] {
    const keys = this.dag.getKeysWithPrefix([CODE_SOURCE]);
    const names: Set<string> = new Set();
    for (const key of keys) {
      const name = key.split(":")[1];
      names.add(name);
    }
    return Array.from(names);
  }

  listCodeSoruceReach(): { id: string, name: string }[] {
    const keys = this.dag.getKeysWithPrefix([CODE_SOURCE]);
    const names: Set<{ id: string, name: string }> = new Set();
    for (const key of keys) {
      const name = key.split(":")[1];
      names.add({ id: name, name: name });
    }
    return Array.from(names);
  }

  listWorkflowReach(): { id: string, name: string }[] {
    const keys = this.dag.getKeysWithPrefix([WORKFLOW]);
    const names: Set<{ id: string, name: string }> = new Set();
    for (const key of keys) {
      const name = key.split(":")[1];
      names.add({ id: name, name: name });
    }
    return Array.from(names);
  }

  listWorkflow(): string[] {
    const keys = this.dag.getKeysWithPrefix([WORKFLOW]);
    const names: Set<string> = new Set();
    for (const key of keys) {
      const name = key.split(":")[1];
      names.add(name);
    }
    return Array.from(names);
  }

  getWorkflowVersions(name: string): string[] {
    const keys = this.dag.getKeysWithPrefix([WORKFLOW, name]);
    const versions: Set<string> = new Set();
    for (const key of keys) {
      const version = key.split(":")[2];
      versions.add(version);
    }
    return Array.from(versions);
  }

  listProvider(): string[] {
    const keys = this.dag.getKeysWithPrefix([PROVIDER]);
    const names: Set<string> = new Set();
    for (const key of keys) {
      const name = key.split(":")[1];
      names.add(name);
    }
    return Array.from(names);
  }

  stats(): any {
    return this.dag.getStats();
  }

  getCode(hashString: string): string {
    return this.dag.get([CODE, hashString]);
  }

  getCodeSource(name: string, version: string): { code_hash: string } {
    return this.dag.get([CODE_SOURCE, name, version]);
  }

  getNode(hashString: string): any {
    console.log("node", hashString);
    const data = this.dag.get([NODE, hashString]);
    return data;
  }

  createCodeSource(name: string, hash: HashString): Promise<{ version: string, fields: { name: string, type: string }[] }> {
    const code = this.getCode(hash);
   
    const version=timeVersion();

    const constructorParams = extractCommentParam(code);
    const struct = {
      code_hash: hash,
      params: constructorParams
    };
    this.dag.put([CODE_SOURCE, name, version], struct);
    return { version, fields: constructorParams };
  }

  getCodeSourceVersions(name: string): { versions: CodeSource[] } {
    const versions: CodeSource[] = [];
    const keys = this.dag.getKeysWithPrefix([CODE_SOURCE, name]);
    for (const key of keys) {
      const version = key.split(":")[2];
      const codeHash = this.dag.get([CODE_SOURCE, name, version]);
      versions.push({ name, version, codeHash });
    }
    return { versions };
  }

  getLastVersion(prefixArray: string[]) {
    const keys = this.dag.getKeysWithPrefix(prefixArray);
    const lastKey = keys[keys.length - 1];
    const version = lastKey.split(":")[2];
    return version;
  }

  setParam(name: string, value: string): Promise<{ replaced: boolean }> {
    const exists = this.dag.get([PARAM, name]);
    this.dag.put([PARAM, name], value);
    return Promise.resolve({ replaced: exists !== undefined });
  }

  getParam(name: string): Promise<{ value: string }> {
    return this.dag.get([PARAM, name]);
  }

  createNode(nodeCodeName: string, config: any): Promise<{ hash: HashString }> {
    const nodeCodeVersion = this.getLastVersion([CODE_SOURCE, nodeCodeName]);
    const struct = {
      config: config,
      codeName: nodeCodeName,
      codeVersion: nodeCodeVersion
    };
    const configString = preciseStringfy(struct);
    const hashString = genHash(configString);

    this.dag.put([NODE, hashString], struct);
    return { hash: hashString };
  }

  createProvider(name: string, providerCodeName: string, config: any): Promise<{ hash: HashString }> {
    const providerCodeVersion = this.getLastVersion([CODE_SOURCE, providerCodeName]);
    const struct = {
      config: config,
      codeName: providerCodeName,
      codeVersion: providerCodeVersion
    };

    this.dag.put([PROVIDER, name], struct);
    return { name };
  }

  getProvider(name: string): Promise<{ hash: string, code: string, config: any }> {
    const data: {
      config: any,
      codeName: string,
      codeVersion: string
    } = this.dag.get([PROVIDER, name]);
    const { code_hash } = this.getCodeSource(data.codeName, data.codeVersion);
    const code = this.getCode(code_hash);
    return { hash: code_hash, code, config: data.config };
  }

  providerExists(name: string): Promise<boolean> {
    const exists = this.dag.get([PROVIDER, name]);
    return Promise.resolve(exists !== undefined);
  }

  // Методы для работы с workflow
  createWorkflowConfig(hash: string, workflow: Workflow): void {
    this.dag.put([WORKFLOW_CONFIG, hash], workflow);
  }

  getWorkflowConfig(hash: string): Workflow {
    return this.dag.get([WORKFLOW_CONFIG, hash]);
  }

  createWorkflow(name: string, version: string, workflowVersionHash: string): void {
    this.dag.put([WORKFLOW, name, version], {
      workflow_version_hash: workflowVersionHash
    });
  }

  getWorkflowHash(name: string, version: string): HashString {
    return this.dag.get([WORKFLOW, name, version]).workflow_version_hash;
  }

  // Методы для работы с webhook
  createWebhook(name: string, version: string, url: string, method: string, workflowId: string, options?: any): void {
    this.dag.put([WEBHOOK, name, version], {
      url,
      method,
      workflow_id: workflowId,
      options
    });
  }

  getWebhook(name: string, version: string): any {
    return this.dag.get([WEBHOOK, name, version]);
  }

  deinit() {
    this.dag.close();
  }
}