import workerSource from "virtual:store-worker";


export const createInlineStoreWorker = (): Worker => {
	const blob = new Blob([workerSource], { type: "text/javascript" });
	return new Worker(URL.createObjectURL(blob), { type: "module" });
};
