


export function loadClassByName(name: string) {
	const devMode=process.env.NODE_ENV !== "production";
	const NodeClass =  require(`../nodes/${fileName}.js`) 
    return NodeClass;
}