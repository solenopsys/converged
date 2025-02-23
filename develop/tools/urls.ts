export function wrapTarget(target: string) {
	return `/dht/${target}`;
}

export function wrapUri(hash: string) {
	return {_uri:wrapTarget(hash)} ;
}

