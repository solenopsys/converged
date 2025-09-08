import * as fs from 'fs';
import * as path from 'path';
import { BaseCommandProcessor, type Handler } from '../base';
import { createDagServiceClient, type DagServiceClient } from './generated';
import YAML from 'yaml';

import type { Workflow } from '../../../../adag/dag-types/interface';


const truncateValues = (obj: Record<string, string>) =>
    Object.fromEntries(
        Object.entries(obj).map(([k, v]) =>
            [k, v.length > 6 ? v.slice(0, 3) + '...' + v.slice(-3) : v]
        )
    );


const handleList: Handler = async (client: DagServiceClient) => {
    const codeSource = await client.codeSourceList();
    const nodes = await client.nodeList();
    const providers = await client.providerList();
    const workflows = await client.workflowList();
    const params = await client.paramsList();

    console.log({
        code: codeSource.names,
        lambdas: nodes.names,
        providers: providers.names,
        workflows: workflows.names,
        params: truncateValues(params.params)
    });
};


const handleStatus: Handler = async (client) => {
    const result = await client.status();
    console.log(result);
};

const handleTest: Handler = async (client, paramSplitter, param) => {
    const [fileName] = param!.split(paramSplitter);
    console.log(fileName);
    const fileData = fs.readFileSync(fileName).toString();
    console.log(fileData);
    const conf = YAML.parse(fileData);
    console.log(conf);
    const result = await client.runLambda(conf.node, conf.data);
    console.log(result);
};



const runWorflow: Handler = async (client:DagServiceClient, paramSplitter, param) => {
    const workflowHash = param!.split(paramSplitter)[0];
    const eventName = param!.split(paramSplitter)[1];

    const result: { contextKey: string } = await client.createContext(workflowHash, {});
    console.log(result);
    for await (const event of client.workflowEvent(result.contextKey, eventName, true)) {
        console.log(event);
    } 
};



const handleWebhook: Handler = async (client, paramSplitter, param) => {
    const [name, url, method, workflowId, optionsFileName] = param!.split(paramSplitter);
    const options = optionsFileName ? JSON.parse(fs.readFileSync(optwoionsFileName).toString()) : undefined;

    const result = await client.createWebhook(name, url, method, workflowId, options);
    console.log(result);
};

const saveParam: Handler = async (client, paramSplitter, param) => {
    const [name, value] = param!.split(paramSplitter);
    const result = await client.setParam(name, value);
    console.log(result);
};

const getParam: Handler = async (client, paramSplitter, param) => {
    const [name] = param!.split(paramSplitter);
    const result = await client.getParam(name);
    console.log(result);
};




const handleApply: Handler = async (client: DagServiceClient, paramSplitter, param) => {
    const [fileName] = param!.split(paramSplitter);
    const data: { type: string } | any = YAML.parse(fs.readFileSync(fileName).toString());

    if (data.type === 'code') {
        const codeData: { name: string, code: string } = data;
        const name = codeData.name;
        const fileName = codeData.code;
        const bytes = fs.readFileSync(fileName);

        const result = await client.setCodeSource(name, bytes.toString());

        console.log(result);
    }

    if (data.type === 'provider') {

        const providerData: { name: string, edges: string, nodes: any } = data;
        const result = await client.createProvider(providerData.name, providerData.code, providerData.params);
        console.log(result);
    }

    if (data.type === 'node') {
        const nodeData: { codeSource: string, edges: string, nodes: any, name: string, params: any } = data;
        const result: { hash: HashString } = await client.createNodeConfig(nodeData.codeSource, nodeData.params);
        const key = await client.createNode(nodeData.name, result.hash);
        console.log(key);
    }


    if (data.type === 'workflow') {
        const fileParentPath = path.dirname(fileName);
        const workflowData: { name: string, nodes: any, edges: any, description: string, aspects: any } = data;

        for (const [key, value] of Object.entries(workflowData.nodes)) {
            const filePath = path.join(fileParentPath, value);
            console.log(filePath);
            const nodeData = YAML.parse(fs.readFileSync(filePath).toString());
            console.log(nodeData);
            const result = await client.createNode(nodeData.codeSource, nodeData);
            console.log("node result", result);

            workflowData.nodes[key] = result.key;

        }

        const workflow: Workflow = {
            nodes: workflowData.nodes,
            links: workflowData.edges,
            description: workflowData.description,
            aspects: workflowData.aspects
        };

        const result = await client.createWorkflow(workflowData.name, workflow);



        console.log(workflowData);
        console.log(result);
    }

};


class DagProcessor extends BaseCommandProcessor {
    protected initializeCommandMap(): Map<string, Handler> {
        return new Map([
            ['apply', handleApply],
            ['list', handleList],
            ['status', handleStatus],
            ['test', handleTest],


            ['run', runWorflow],
            ['webhook', handleWebhook],
            ['set', saveParam],
            ['get', getParam]
        ]);
    }
}


export default (prod: boolean) => {
    const client: DagServiceClient = createDagServiceClient({ baseUrl: prod ? "https://console.4ir.club/" : "http://localhost:3006/" });
    return new DagProcessor(client)
};