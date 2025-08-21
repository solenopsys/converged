
import {createHttpBackend} from "./proxy";
import { Elysia } from "elysia";

const SERVICES_PORT = Number(process.env.SERVICES_PORT) || 3001;
const app = new Elysia();
app.use(createHttpBackend());
app.listen(SERVICES_PORT, () => {
  console.log(`🚀 Services: http://localhost:${SERVICES_PORT}`);
});


