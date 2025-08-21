import { createDagServiceClient } from "./generated";

async function check(){
    const dagClient = createDagServiceClient({baseUrl: 'http://localhost:3001'});
    const res = await dagClient.status();
    console.log(res);

    const res2 = await dagClient.codeList();
    console.log(res2);
}

check();
