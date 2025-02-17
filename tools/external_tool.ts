export type ImportConfig={package:string, external:Record<string,string>};

export async function externalsLoad(packagesFile: string, defaultExternal: Record<string, string> = {}) {
   
   const tsConfigJson = await Bun.file(packagesFile).json();

 
   const  packagesFromExternal: Record<string, string> = tsConfigJson.external || {};

   // Merge objects using spread operator
   const combinedExternal = { ...packagesFromExternal, ...defaultExternal };
   // Alternative way using Object.assign:
   // const combinedExternal = Object.assign({}, packagesFromExternal, defaultExternal);

  
   return { package: tsConfigJson.name, external: combinedExternal };
}