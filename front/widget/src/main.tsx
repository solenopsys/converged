import { render } from "preact";
import Widget from "./widget/widget.tsx";
import { initFilesState } from "./shared/files-state/init.ts";
import {
  openChat,
  sendMessageRequested,
  userTextChanged,
} from "./widget/chatUi";
// @ts-ignore
import { allStyles } from "__styles_registry__";

initFilesState();

const currentScript =
  document.currentScript instanceof HTMLScriptElement
    ? document.currentScript
    : null;

const host =
  document.getElementById("aichat") ??
  document.getElementById("assistant") ??
  (() => {
    const element = document.createElement("div");
    element.id = "aichat";
    document.body.appendChild(element);
    return element;
  })();

if (currentScript) {
  for (const key of ["context", "title", "description", "think"]) {
    const value = currentScript.dataset[key];
    if (value && !host.dataset[key]) {
      host.dataset[key] = value;
    }
  }
}

// Создаем Shadow DOM
const shadowRoot = host.attachShadow({ mode: "open" });

// Добавляем стили в Shadow DOM
const styleEl = document.createElement("style");
styleEl.textContent = allStyles
  .map((style) => (typeof style === "string" ? style : style.__css))
  .join("\n");
shadowRoot.appendChild(styleEl);

// Создаем контейнер
const container = document.createElement("div");
shadowRoot.appendChild(container);

// Данные из атрибутов
const contextLink = host.dataset.context;
const title = host.dataset.title;
const description = host.dataset.description;
const think = host.dataset.think;

type ChatOpenPayload =
  | string
  | {
      topic?: string;
      message?: string;
      send?: boolean;
      source?: string;
    };

function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}

const openChatWithPayload = (payload?: ChatOpenPayload) => {
  const data =
    typeof payload === "string" ? { message: payload } : (payload ?? {});
  const message = data.message ?? data.topic ?? "";
  const shouldSend = Boolean(data.send);
  const source = data.source ?? "external";

  trackEvent("ai_chat_open", {
    source,
    has_message: Boolean(message),
  });

  openChat();

  if (message) {
    userTextChanged(message);
    if (shouldSend) {
      sendMessageRequested(message);
    }
  }
};

window.openAssistantSidebar = openChatWithPayload;
window.openAiChatSidebar = openChatWithPayload;
window.addEventListener("openAssistant", (event) => {
  const detail = (event as CustomEvent).detail;
  openChatWithPayload(detail);
});
window.addEventListener("openAiChat", (event) => {
  const detail = (event as CustomEvent).detail;
  openChatWithPayload(detail);
});

// Рендерим
render(<Widget />, container);
