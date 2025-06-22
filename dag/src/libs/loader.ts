


export function loadClassByName(name: string) {
	const devMode=process.env.NODE_ENV !== "production";
	const NodeClass = devMode ? require(`../nodes/${fileName}.ts`) : import(`./nodes/${fileName}.js`);
    return NodeClass;
}