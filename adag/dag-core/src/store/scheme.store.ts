
import type { HashString, Workflow, CodeSource } from '../../../dag-types/interface';
import { genHash } from '../tools';
import { preciseStringfy } from '../tools';
import { timeVersion, extractCommentParam } from './utils/utils';
import { ProvidersStore } from 'dag-api';

import { LMWrapper } from './utils/lmwrapper';



const PROVIDER = "provider";
const PARAM = "param";
const WEBHOOK = "webhook";

import { EntityAcessor } from "./utils/accessor";


class CodeSourceAccessor extends EntityAcessor<SchemeStore>{ // code sources width constructor params and types
  readonly CODE = "code";
  readonly CODE_SOURCE = "code_source";


  saveCode(body: string) {
    const hashString = genHash(body);
    this.db.put([this.CODE, hashString], body);
    return hashString;
  }

  getCode(hashString: string): string {
    return this.db.get([this.CODE, hashString]);
  }

  listCodeSoruce(): string[] {
    return this.listKeys([this.CODE_SOURCE],1);
  }

  listCodeSoruceReach(): { id: string, name: string }[] {
    return this.listKeys([this.CODE_SOURCE],1).map((name)=>{return {id:name,name:name}});
  }


  getCodeSource(name: string, version: string): { code_hash: string } {
    return this.db.get([this.CODE_SOURCE, name, version]);
  }

  createCodeSource(name: string, hash: HashString): { version: string, fields: { name: string, type: string }[] } {
    const code = this.getCode(hash);
    if (code==undefined){
      throw new Error("Code not found");
    }

    const version = timeVersion();

    const constructorParams = extractCommentParam(code);
    const struct = {
      code_hash: hash,
      params: constructorParams
    };
    this.db.put([this.CODE_SOURCE, name, version], struct);
    return { version, fields: constructorParams };
  }

  getCodeSourceVersions(name: string): { versions: CodeSource[] } {
    const versions: CodeSource[] = [];
    const keys = this.db.getKeysWithPrefix([this.CODE_SOURCE, name]);
    for (const key of keys) {
      const version = key.split(":")[2];
      const codeHash = this.db.get([this.CODE_SOURCE, name, version]);
      versions.push({ name, version, hash: codeHash });
    }
    return { versions };
  }
}

class WorflowAccessor extends EntityAcessor<SchemeStore> {
  readonly WORKFLOW = "workflow";
  readonly WORKFLOW_CONFIG = "workflow_config";


  listWorkflowReach(): { id: string, name: string }[] {
    return this.listKeys([this.WORKFLOW],1).map((name)=>{return {id:name,name:name}});
  }

  listWorkflow(): string[] {
    return this.listKeys([this.WORKFLOW],1);
  }

  getWorkflowVersions(name: string): string[] {
    const keys = this.db.getKeysWithPrefix([this.WORKFLOW, name]);
    const versions: Set<string> = new Set();
    for (const key of keys) {
      const version = key.split(":")[2];
      versions.add(version);
    }
    return Array.from(versions);
  }

  // Методы для работы с workflow
  createWorkflowConfig(hash: string, workflow: Workflow): void {
    this.db.put([this.WORKFLOW_CONFIG, hash], workflow);
  }

  getWorkflowConfig(hash: string): Workflow {
    return this.db.get([this.WORKFLOW_CONFIG, hash]);
  }

  createWorkflow(name: string, version: string, workflowVersionHash: string): void {
    this.db.put([this.WORKFLOW, name, version], {
      workflow_version_hash: workflowVersionHash
    });
  }

  getWorkflowHash(name: string, version: string): HashString {
    return this.db.get([this.WORKFLOW, name, version]).workflow_version_hash;
  }

}

class ProviderAccessor extends EntityAcessor<SchemeStore>  implements ProvidersStore  {

  createProvider(name: string, providerCodeName: string, config: any): { name: string } {
    const providerCodeVersion = this.getLastVersion([this.store.code.CODE_SOURCE, providerCodeName]);
    const struct = {
      config: config,
      codeName: providerCodeName,
      codeVersion: providerCodeVersion
    };

    this.db.put([PROVIDER, name], struct);
    return { name };
  }
  listProvider(): string[] {
    return this.listKeys([PROVIDER],1);
  }

  getProvider(name: string): { hash: string, code: string, config: any } {
    const data: {
      config: any,
      codeName: string,
      codeVersion: string
    } = this.db.get([PROVIDER, name]);
    const { code_hash } = this.store.code.getCodeSource(data.codeName, data.codeVersion);
    const code = this.store.code.getCode(code_hash);
    return { hash: code_hash, code, config: data.config };
  }

  providerExists(name: string): boolean {
    const exists = this.db.get([PROVIDER, name]);
    return exists !== undefined;
  }

}

class NodeAccessor extends EntityAcessor<SchemeStore> {
  readonly NODE_CONFIG = "node_config";
  readonly NODE = "node";


  getNodeConfig(hashString: string): any {
    console.log("node", hashString);
    const data = this.db.get([this.NODE_CONFIG, hashString]);
    return data;
  }

  getNode(nodeName: string): string {
    const lastVersion = this.getLastVersion([this.NODE, nodeName]);
    const nodeConfigHash=this.db.get([this.NODE,nodeName,lastVersion]);
    return nodeConfigHash;
  }

  getNodeByKey(key: string): string { 
    const nodeConfigHash=this.db.get([key]);
    return nodeConfigHash;
  }


  listNodes(): string[] {
    return this.listKeys([this.NODE],1);
  }

  createNodeConfig(nodeCodeName: string, config: any): { hash: HashString } {
    const nodeCodeVersion = this.getLastVersion([this.store.code.CODE_SOURCE, nodeCodeName]);
    const struct = {
      config: config,
      codeName: nodeCodeName,
      codeVersion: nodeCodeVersion
    };
    const configString = preciseStringfy(struct);
    const hashString = genHash(configString) as HashString;

    this.db.put([this.NODE_CONFIG, hashString], struct);
    return { hash: hashString };
  }

  createNode(nodeName: string, nodeConfigHash: any): string {
    const version = timeVersion();
    const key = this.db.put([this.NODE, nodeName, version], nodeConfigHash);
    return key;
  }
}

class ParamAccessor extends EntityAcessor<SchemeStore> { // params 
  setParam(name: string, value: string): { replaced: boolean } {
    const exists = this.db.get([PARAM, name]);
    this.db.put([PARAM, name], value);
    return { replaced: exists !== undefined };
  }

  getParam(name: string): { value: string } {
    return this.db.get([PARAM, name]);
  }

  listParams(): {  [name: string]: string  } {
    return this.db.getVeluesRangeAsObjectWithPrefix(PARAM);
  }
}

class WebhookAccessor extends EntityAcessor<SchemeStore> {
  // Методы для работы с webhook
  createWebhook(name: string, version: string, url: string, method: string, workflowId: string, options?: any): void {
    this.db.put([WEBHOOK, name, version], {
      url,
      method,
      workflow_id: workflowId,
      options
    });
  }

  getWebhook(name: string, version: string): any {
    return this.db.get([WEBHOOK, name, version]);
  }

}


export class SchemeStore {
  private db: LMWrapper;
  public readonly code: CodeSourceAccessor;
  public readonly workflow: WorflowAccessor;
  public readonly provider: ProviderAccessor;
  public readonly node: NodeAccessor;
  public readonly param: ParamAccessor;
  public readonly webhook: WebhookAccessor;

  private constructor(dataDir: string) {
    this.db = new LMWrapper(dataDir, 'scheme');
    this.code = new CodeSourceAccessor(this.db, this);
    this.workflow = new WorflowAccessor(this.db, this);
    this.provider = new ProviderAccessor(this.db, this);
    this.node = new NodeAccessor(this.db, this);
    this.param = new ParamAccessor(this.db, this);
    this.webhook = new WebhookAccessor(this.db, this);
  }


  stats(): any {
    return this.db.getStats();
  }

  deinit() {
    this.db.close();
  }
}