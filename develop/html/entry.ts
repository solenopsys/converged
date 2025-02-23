 
import $, { store } from "@solenopsys/converged-reactive";
import { createContext, loadModule ,type MicroFronted} from "@solenopsys/converged-renderer";


const entry:ConfigEntry=JSON.parse(
    `$TEMPLATE_ENTRY`
)
type ConfigEntry={
	layout:MicroFronted
	routes:any
	state:any;
}

console.log("ENTRY", entry);
	 
const mod = await loadModule(entry.layout.module._uri);

 
mod.createLayout("layout", loadModule, entry.layout.data);