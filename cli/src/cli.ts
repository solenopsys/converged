import { createDagServiceClient } from "./proxy";
import fs from "fs";

const prod = false;

const client = createDagServiceClient({ baseUrl: prod ? "https://console.4ir.club/" : "http://localhost:3001/" });

const commnds = [
    "code",
    "list",
    "status",
    "run",
    "node",
    "process",
    "workflow",
    "webhook"
]

const PARAM_SPLITTER = ',';

const command = process.argv[2];
const param = process.argv[3];

if (commnds.includes(command)) {

    if (command === "code") {
        const [name, fileName] = param.split(PARAM_SPLITTER);
        const bytes = fs.readFileSync(fileName);

        client.setCode(name, bytes.toString()).then(console.log);
    }

    if (command === "list") {
        client.codeList().then(console.log);
    }

    if (command === "status") {
        client.status().then(console.log);
    }

    if (command === "run") {
        const [hash, fileName] = param.split(PARAM_SPLITTER);
        const data = JSON.parse(fs.readFileSync(fileName).toString());

        client.runCode(hash, data).then(console.log);
    }

    if (command === "node") {
        const [codeNodeName, fileName] = param.split(PARAM_SPLITTER);
        const data = JSON.parse(fs.readFileSync(fileName).toString());
        client.createNode(codeNodeName, data).then(console.log);
    }

    if (command === "process") {
        if (param) {
            const [workflowId, metaFileName] = param.split(PARAM_SPLITTER);
            const meta = metaFileName ? JSON.parse(fs.readFileSync(metaFileName).toString()) : undefined;
            client.startProcess(workflowId, meta).then(console.log);
        } else {
            client.startProcess().then(console.log);
        }
    }

    if (command === "workflow") {
        const [name, fileName] = param.split(PARAM_SPLITTER);
        const data = JSON.parse(fs.readFileSync(fileName).toString());
        
        client.createWorkflow(
            name,
            data.nodes,
            data.links,
            data.description
        ).then(console.log);
    }

    if (command === "webhook") {
        const [name, url, method, workflowId, optionsFileName] = param.split(PARAM_SPLITTER);
        const options = optionsFileName ? JSON.parse(fs.readFileSync(optionsFileName).toString()) : undefined;
        
        client.createWebhook(name, url, method, workflowId, options).then(console.log);
    }

    // if (command === "create_type") {
    //     const jsonName = param;
    //     const conf=JSON.parse(fs.readFileSync(jsonName).toString())
    //     client.createNodeType("test",conf)
    // }
} else {
    console.log("Unknown command");
    process.exit(1);
}