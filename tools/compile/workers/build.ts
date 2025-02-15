
import { bindleLibrary } from "../pack_build.ts";

self.onmessage = async (event) => {
   console.log("WORKER MESSAGE", event.data);
   const { taskId, name, entryPoint, outPutPath,externals } = event.data;
   
   try {
       const result = await bindleLibrary(name,taskId, entryPoint, outPutPath,externals);

       
       self.postMessage({
           taskId,
           success: true,
           ...result
       });
   } catch (error) {
       self.postMessage({
           taskId,
           success: false,
           error: error.message
       });
   }
}