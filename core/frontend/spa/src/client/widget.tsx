import { useUnit } from "effector-preact";
import { render } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { type Chat, type ChatConfig, initChat, Transcript } from "front-core/chat";
import { configFromEmbed } from "front-core/chat/config-embed";
import { mountInlineChatStyles } from "front-core/chat/styles-inline";
import {
	$draft,
	$panelOpen,
	draftChanged,
	draftCleared,
	panelClosed,
	panelOpened,
} from "front-core/shell/panel";
import { AttachButton, Composer, PanelToggle } from "front-core/ui";
import embedCss from "front-core/styles/embed.css";



function Widget({ chat, config }: { chat: Chat; config: ChatConfig }) {
	const open = useUnit($panelOpen);
	const draft = useUnit($draft);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		if (open) requestAnimationFrame(() => inputRef.current?.focus());
	}, [open]);

	const send = () => {
		const text = draft.trim();
		if (!text) return;
		draftCleared();
		panelOpened();
		if (inputRef.current) inputRef.current.style.height = "";
		chat.sendMessage(text);
	};

	if (!open) {
		return (
			<div class="embed-launcher">
				<PanelToggle open={false} onClick={panelOpened} />
			</div>
		);
	}

	return (
		<aside class="chat-panel" aria-label="Chat panel">
			<header class="panel-header">
				<span class="panel-label">
					hw<span>.</span>
				</span>
			</header>
			<Transcript />
			<Composer
				id="embed-message"
				draft={draft}
				inputRef={inputRef}
				callConfig={{ fujinWsUrl: config.fujinWsUrl, contextName: config.callContextName }}
				dictationConfig={{ fujinWsUrl: config.fujinWsUrl, language: config.language }}
				attach={({ onClick }) => <AttachButton onClick={onClick} />}
				action={<PanelToggle open onClick={panelClosed} />}
				onDraftChange={draftChanged}
				onFiles={chat.attachFiles}
				onSubmit={send}
			/>
		</aside>
	);
}

const script =
	document.currentScript instanceof HTMLScriptElement
		? document.currentScript
		: null;

async function mount() {
	const host =
		document.getElementById("aichat") ??
		document.body.appendChild(
			Object.assign(document.createElement("div"), { id: "aichat" }),
		);

	const shadow = host.attachShadow({ mode: "open" });
	const style = document.createElement("style");
	style.textContent = embedCss;
	shadow.appendChild(style);
	const container = shadow.appendChild(document.createElement("div"));

	const config = configFromEmbed(host, script);
	const chat = await initChat(config, () =>
		mountInlineChatStyles(shadow),
	);

	render(<Widget chat={chat} config={config} />, container);
}

void mount();
