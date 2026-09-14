import { services } from "files-state";
import { createFilesServiceClient } from "g-files";
import { createStoreServiceClient } from "g-store";
import { createFrontNrpcClientConfig } from "signal-channel";

const filesClient = createFilesServiceClient(createFrontNrpcClientConfig());

/**
 * Hand `files-state` its two peers.
 *
 * Uploading and downloading are not written here and must not be: the chunking,
 * compression, pause/resume and save-dialog logic lives in `files-state` and is
 * the same code the chat has been using all along. What this surface was missing
 * was never the transport — it was the admin-side screens on top of it. So the
 * one thing to do here is register the clients the library asks for, exactly as
 * `RequestDetailView` does, and then call its events.
 *
 * The guard matters: whichever surface mounts first wins, and registering twice
 * would hand the library a second pair of clients mid-upload.
 */
if (typeof window !== "undefined" && !services.getFilesService()) {
	services.setFilesService(filesClient);
	services.setStoreService(
		createStoreServiceClient(createFrontNrpcClientConfig()),
	);
}

export const filesService = filesClient;
export default filesClient;
