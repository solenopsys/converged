

export const PACKAGE = "package.json";

export const CORE_LIBS = [
	"@solenopsys/converged-reactive",
	"@solenopsys/converged-renderer",
	"@solenopsys/converged-router",
	"@solenopsys/converged-style",
];

export const DEFAULT_EXTERNAL = [...CORE_LIBS];

const local=false
export const REMOTE_HOST =local? "http://localhost:7777" :"http://solenopsys.org";
export const REMOTE_HOST_PINNING = "http://pinning.solenopsys.org";

export const REMOTE_PREFEIX = "https://zero.node.solenopsys.org/ipfs/";

export const PRO_DIST = "distp";


export const IPFS_HOST = "ipfs-api.solenopsys.org";
export const IPFS_PORT = 80;