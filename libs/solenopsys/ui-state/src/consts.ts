import $, { store } from "@solenopsys/converged-reactive";
import { createContext, loadModule } from "@solenopsys/converged-renderer";



 
export let UiContext



type ConfigEntry={
	module:string;
	state:any;
}

export async function init(entry: ConfigEntry) {
	const moduleName = entry.module;
	const mod = await loadModule(moduleName);
	const uiState = store(entry.state);
	UiContext = createContext<any>(uiState);
	
	mod.createLayout("layout", loadModule, entry.state);
//	await load("@solenopsys/mf-landing");
}