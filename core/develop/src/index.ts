import { buildAll } from "./builds/build-prod";
export function all(){
    let start = Bun.nanoseconds();

buildAll().then(() => {
	const end = Bun.nanoseconds();
	console.log("DONE ", (end - start) / 1000000000, "s");
});

}