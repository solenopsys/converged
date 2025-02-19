



export async function convert(dirPath: string) {

}

async function convertJson(fileName: string) {

   const json =await Bun.file(fileName).json(fileName);
   console.log(json);
   
}

convertJson("./develop/bootstraps/test.data/layout-conf.json");