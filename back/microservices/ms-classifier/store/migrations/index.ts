import { type SqlStore } from "back-core";
import CreateNodes from "./createNodes";

export default (store: SqlStore) => [new CreateNodes(store)];
