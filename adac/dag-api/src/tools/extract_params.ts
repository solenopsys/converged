export function extractConstructorParams(code: string): { name: string, type: string }[] {
    console.log(code);
    const newlineIndex = code.indexOf('\n');
    const firstLine = newlineIndex === -1 ? code : code.substring(0, newlineIndex);
    const json = firstLine.replace(/^\/\/\s*/, '');
    console.log(json);
    const obj=JSON.parse(json)
    const params= obj.map((param: any) => ({ name: param.name, type: param.type }))
    return params;
}