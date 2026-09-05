import type { Position } from "orchestrator";

// Where the user is standing, as a value anything may read.
//
// The shell owns the state and the chat needs to read it, but the shell already
// imports the chat, so a direct import would close a cycle. Same shape as
// `select/runtime.ts`: the owner installs a reader, everyone else asks.

export type SubtabChoice = { key: string; title: string; pressed: boolean };

export type WorkspaceReader = {
	position(): Position | undefined;
	subtabs(surface: string): SubtabChoice[];
};

let reader: WorkspaceReader | undefined;

export function setWorkspaceReader(next: WorkspaceReader | undefined): void {
	reader = next;
}

export function workspacePosition(): Position | undefined {
	return reader?.position();
}

export function workspaceSubtabs(surface: string): SubtabChoice[] {
	return reader?.subtabs(surface) ?? [];
}
