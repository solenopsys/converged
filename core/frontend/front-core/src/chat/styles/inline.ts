import chatCss from "../chat.css";
import panelCss from "../../styles/panel.css";
import tokensCss from "../../styles/tokens.css";



export function mountInlineChatStyles(root: ShadowRoot): Promise<void> {
	const style = document.createElement("style");
	style.textContent = [tokensCss, panelCss, chatCss].join("\n");
	root.appendChild(style);
	return Promise.resolve();
}
