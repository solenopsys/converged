import { createEffect, createEvent, createStore, sample } from "effector";
import { useUnit } from "effector-preact";
import type React from "preact/compat";
import { useEffect } from "preact/compat";
import { Versions } from "../components/Versions";

interface Version {
	version: string;
}

interface CompProps {
	versionLoader?: (codeName: string) => Promise<Version[]>;
}

// Effector model
export const setCodeName = createEvent<string>();
export const loadVersions = createEvent<{
	codeName: string;
	versionLoader: (codeName: string) => Promise<Version[]>;
}>();

export const loadVersionsFx = createEffect<
	{ codeName: string; versionLoader: (codeName: string) => Promise<Version[]> },
	Version[]
>(async ({ codeName, versionLoader }) => {
	try {
		return await versionLoader(codeName);
	} catch (error) {
		console.error("Error fetching versions:", error);
		throw error;
	}
});

export const $versions = createStore<Version[]>([])
	.on(loadVersionsFx.doneData, (_, versions) => versions)
	.on(loadVersionsFx.fail, () => []);

export const $loading = createStore<boolean>(false)
	.on(loadVersionsFx, () => true)
	.on(loadVersionsFx.finally, () => false);

export const $codeName = createStore<string>("").on(
	setCodeName,
	(_, codeName) => codeName,
);

sample({
	clock: loadVersions,
	target: loadVersionsFx,
});

// Smart component
const VersionsView: React.FC<CompProps> = ({ versionLoader }) => {
	const versions = useUnit($versions);
	const loading = useUnit($loading);
	const codeName = useUnit($codeName);

	useEffect(() => {
		const currentCodeName = "bla";
		setCodeName(currentCodeName);
	}, []);

	useEffect(() => {
		if (!codeName || !versionLoader) return;

		loadVersions({ codeName, versionLoader });
	}, [codeName, versionLoader]);

	return <Versions versions={versions} loading={loading} codeName={codeName} />;
};

export default VersionsView;
