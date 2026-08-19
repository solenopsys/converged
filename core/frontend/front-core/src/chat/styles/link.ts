

const CHAT_STYLESHEET_URL = "/assets/chat.css";

export function mountLinkedChatStyles(): Promise<void> {
	const existing = document.head.querySelector(
		`link[rel="stylesheet"][href="${CHAT_STYLESHEET_URL}"]`,
	);
	if (existing) return Promise.resolve();

	return new Promise((resolve, reject) => {
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = CHAT_STYLESHEET_URL;
		link.onload = () => resolve();
		link.onerror = () =>
			reject(new Error(`[chat] failed to load ${CHAT_STYLESHEET_URL}`));
		document.head.appendChild(link);
	});
}
