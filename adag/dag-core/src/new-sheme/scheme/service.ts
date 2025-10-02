

// code

import { HashString, KVDB } from "back-core";
import { CodeRepository, CodeKey, CodeSoruceRepository, CodeSourceKey, CodeSourceValue } from "./entities";
import { WorkflowRepository, WorkflowKey, WorkflowValue } from "./entities";
import { ProviderRepository, ProviderKey, ProviderValue } from "./entities";
import { NodeRepository, NodeKey, NodeValue } from "./entities";
import { ParamRepository, ParamKey, ParamValue } from "./entities";
import { WebhookRepository, WebhookKey, WebhookValue } from "./entities";
import { genHash } from "back-core";
import { extractCommentParam } from "back-core";
import { timeVersion } from "back-core";
import { WorkflowConfigRepository, WorkflowConfigKey, WorkflowConfigValue } from "./entities";
import { NodeConfigRepository, NodeConfigKey, NodeConfigValue } from "./entities";
import { preciseStringfy } from "back-core";

class SchemeService {
  public readonly codeRepo: CodeRepository;
  public readonly codeSourceRepo: CodeSoruceRepository;
  public readonly workflowRepo: WorkflowRepository;
  public readonly workflowConfigRepo: WorkflowConfigRepository;
  public readonly providerRepo: ProviderRepository;
  public readonly nodeRepo: NodeRepository;
  public readonly nodeConfigRepo: NodeConfigRepository;
  public readonly paramRepo: ParamRepository;
  public readonly webhookRepo: WebhookRepository;

  constructor(db: KVDB) {
    this.codeRepo = new CodeRepository(db);
    this.codeSourceRepo = new CodeSoruceRepository(db);
    this.workflowRepo = new WorkflowRepository(db);
    this.workflowConfigRepo = new WorkflowConfigRepository(db);
    this.providerRepo = new ProviderRepository(db);
    this.nodeRepo = new NodeRepository(db);
    this.nodeConfigRepo = new NodeConfigRepository(db);
    this.paramRepo = new ParamRepository(db);
    this.webhookRepo = new WebhookRepository(db);
  }

  saveCode(body: string) {
    const hashString = genHash(body);
    this.codeRepo.save(new CodeKey(hashString), body);
    return hashString;
  }

  getCode(hashString: HashString): string | undefined {
    return this.codeRepo.get(new CodeKey(hashString));
  }

  listCodeSoruce(): string[] {
    return this.codeSourceRepo.listKeys()
  }

  getCodeSource(name: string, version: string): { code_hash: string } | undefined {
    return this.codeSourceRepo.get(new CodeSourceKey(name, version));
  }


  createCodeSource(name: string, hash: HashString, code: string): { version: string, fields: { name: string, type: string }[] } {
    if (code == undefined) {
      throw new Error("Code not found");
    }
    const version = timeVersion();

    const constructorParams = extractCommentParam(code);
    const struct: CodeSourceValue = {
      code_hash: hash,
      params: constructorParams
    };
    this.codeSourceRepo.save(new CodeSourceKey(name, version), struct);
    return { version, fields: constructorParams };
  }


  getCodeSourceVersions(name: string): { versions: CodeSourceValue[] } {
    const versionKeys = this.codeSourceRepo.getVersions(name);
    return { versions: versionKeys };
  }

  listWorkflow(): string[] {
    return this.workflowRepo.listKeys()
  }


  getWorkflowVersions(name: string): string[] {
    return this.workflowRepo.getVersions(name);

  }

  createWorkflowConfig(hash: string, workflow: WorkflowConfigValue): void {
    this.workflowConfigRepo.save(new WorkflowConfigKey(hash), workflow);

  }

  getWorkflowConfig(hash: string): WorkflowConfigValue | undefined {
    return this.workflowConfigRepo.get(new WorkflowConfigKey(hash));
  }

  createWorkflow(name: string, version: string, workflowVersionHash: string): void {
    this.workflowRepo.save(new WorkflowKey(name, version), workflowVersionHash);
  }

  getWorkflowHash(name: string, version: string): HashString | undefined {
    return this.workflowRepo.get(new WorkflowKey(name, version));
  }

  createProvider(name: string, providerCodeName: string, config: any): { name: string } {
    const providerCodeVersion = this.codeSourceRepo.getLastVersion(providerCodeName);
    if (providerCodeVersion == undefined) {
      throw new Error("Provider code version not found");
    }
    const struct = {
      config: config,
      codeName: providerCodeName,
      codeVersion: providerCodeVersion
    };


    this.providerRepo.save(new ProviderKey(name), struct);
    return { name };
  }

  listProvider(): string[] {
    return this.providerRepo.listKeys();
  }

  getProvider(name: string): { hash: string, code: string, config: any } {
    const data: {
      config: any,
      codeName: string,
      codeVersion: string
    } | undefined = this.providerRepo.get(new ProviderKey(name));
    if (data == undefined) {
      throw new Error("Provider not found");
    }
    const codeSource = this.codeSourceRepo.get(new CodeSourceKey(data.codeName, data.codeVersion));
    if (codeSource == undefined) {
      throw new Error("Provider code version not found");
    }
    const code = this.codeRepo.get(new CodeKey(codeSource.code_hash));
    if (code == undefined) {
      throw new Error("Provider code not found");
    }
    return { hash: codeSource.code_hash, code, config: data.config };
  }

  providerExists(name: string): boolean {
    const exists = this.providerRepo.get(new ProviderKey(name));
    return exists !== undefined;
  }

  getNodeConfig(hashString: string): any {
    console.log("node", hashString);
    const data = this.nodeConfigRepo.get(new NodeConfigKey(hashString));
    return data;
  }

  getNode(nodeName: string): { config: any, codeName: string, codeVersion: string } | undefined {
    const lastVersion = this.nodeRepo.getLastVersion(nodeName);
    if (lastVersion == undefined) {
      throw new Error("Node not found");
    }

    return this.nodeConfigRepo.get(new NodeConfigKey(lastVersion));
  }

  getNodeByKey(key: string): { config: any, codeName: string, codeVersion: string } | undefined {
    return this.nodeConfigRepo.get(new NodeConfigKey(key));

  }

  listNodes(): string[] {
    return this.nodeRepo.listKeys();
  }

  createNodeConfig(nodeCodeName: string, config: any): { hash: HashString } {
    const nodeCodeVersion = this.codeSourceRepo.getLastVersion(nodeCodeName);
    if (nodeCodeVersion == undefined) {
      throw new Error("Node code version not found");
    }
    const struct = {
      config: config,
      codeName: nodeCodeName,
      codeVersion: nodeCodeVersion
    };
    const configString = preciseStringfy(struct);
    const hashString = genHash(configString) as HashString;

    if (nodeCodeVersion == undefined) {
      throw new Error("Node code version not found");
    }
    this.nodeConfigRepo.save(new NodeConfigKey(hashString), struct);
    return { hash: hashString };
  }

  createNode(nodeName: string, nodeConfigHash: HashString): string {
    const version = timeVersion();
    return this.nodeRepo.save(new NodeKey(nodeName, version), nodeConfigHash);
  }


  setParam(name: string, value: string): { replaced: boolean } {
    const exists = this.paramRepo.get(new ParamKey(name));
    this.paramRepo.save(new ParamKey(name), value);
    return { replaced: exists !== undefined };
  }

  getParam(name: string): { value: string } {
    return { value: this.paramRepo.get(new ParamKey(name)) ?? "" };
  }

  listParams(): { [name: string]: string } {
    return this.paramRepo.listKeys().reduce((acc, key) => { acc[key] = this.paramRepo.get(new ParamKey(key)); return acc; }, {});
  }

  createWebhook(name: string, version: string, url: string, method: string, workflowId: string, options?: any): void {
    this.webhookRepo.save(new WebhookKey(name, version), { url, method, workflow_id: workflowId, options });
  }

  getWebhook(name: string, version: string): any {
    return this.webhookRepo.get(new WebhookKey(name, version));
  }
}






