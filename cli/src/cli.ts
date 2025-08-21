import { createDagServiceClient } from "./proxy";
import fs from "fs";
import createDag from "./processors/dag";

const prod = false;


const sections = [
    "dag", 
] 

const dagProcessor=createDag(prod);

const PARAM_SPLITTER = ',';

const section = process.argv[2];
const command = process.argv[3];
const param = process.argv[4];

if (sections.includes(section)) {
    dagProcessor.processCommand(command, param);
} else {
    console.log("Unknown command");
    process.exit(1);
}