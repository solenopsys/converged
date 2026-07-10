import { v4 as uuidv4 } from "uuid";
import {
  createEffect,
  createEvent,
  createStore,
  sample,
  merge,
  type Subscription,
} from "effector";
import {
  createChatStore,
  type ChatState,
  addMessage,
  MessageType,
} from "assistant-state";
import type { ChatMessage } from "front-chat-core";
import { assistantClient, threadsClient } from "../services";
import { $files, uploadCompleted } from "files-state";

function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}

export type ChatUiState = {
  isOpen: boolean;
  isExpanded: boolean;
  messageStackWidth: number;
};

const initialState: ChatUiState = {
  isOpen: false,
  isExpanded: false,
  messageStackWidth: 280,
};

export const openChat = createEvent();
export const closeChat = createEvent();
export const toggleChat = createEvent();
export const setChatVisibility = createEvent<boolean>();
export const expandInputPanel = createEvent();
export const collapseInputPanel = createEvent();
export const toggleInputPanelExpanded = createEvent();
export const setInputPanelExpanded = createEvent<boolean>();
export const setMessageStackWidth = createEvent<number>();
export type AttachmentPreview = {
  id: string;
  name: string;
  size: number;
  href: string;
};

export const attachmentsSelected = createEvent<File[]>();
const attachmentsPrepared = createEvent<AttachmentPreview[]>();

export const $chatUi = createStore<ChatUiState>(initialState)
  .on(openChat, (state) => ({ ...state, isOpen: true, isExpanded: false }))
  .on(closeChat, (state) => ({ ...state, isOpen: false, isExpanded: false }))
  .on(toggleChat, (state) => ({
    ...state,
    isOpen: !state.isOpen,
    isExpanded: false,
  }))
  .on(setChatVisibility, (state, isOpen) => ({
    ...state,
    isOpen,
    isExpanded: false,
  }))
  .on(expandInputPanel, (state) =>
    state.isExpanded ? state : { ...state, isExpanded: true },
  )
  .on(collapseInputPanel, (state) =>
    state.isExpanded ? { ...state, isExpanded: false } : state,
  )
  .on(toggleInputPanelExpanded, (state) => ({
    ...state,
    isExpanded: !state.isExpanded,
  }))
  .on(setInputPanelExpanded, (state, isExpanded) =>
    state.isExpanded === isExpanded ? state : { ...state, isExpanded },
  )
  .on(setMessageStackWidth, (state, width) => {
    if (state.messageStackWidth === width) {
      return state;
    }

    return { ...state, messageStackWidth: width };
  });

export const userTextChanged = createEvent<string>();
export const resetUserText = createEvent();
export const sendMessageRequested = createEvent<string>();

export const $userText = createStore("")
  .on(userTextChanged, (_, text) => text)
  .reset(resetUserText);

const chatStateUpdated = createEvent<ChatState>();

export const $chatState = createStore<ChatState>({
  messages: [],
  isLoading: false,
  currentResponse: "",
}).on(chatStateUpdated, (_, state) => state);

type ChatStoreInstance = ReturnType<typeof createChatStore>;

let chatStoreInstance: ChatStoreInstance | null = null;
let chatSubscription: Subscription | null = null;

const initialiseChatFx = createEffect<void, ChatStoreInstance>(() => {
  if (chatStoreInstance) {
    return chatStoreInstance;
  }

  const store = createChatStore(assistantClient, threadsClient);
  const sessionId = uuidv4();
  store.init(sessionId);

  if (chatSubscription) {
    chatSubscription.unsubscribe();
  }

  chatSubscription = store.$chat.watch(chatStateUpdated);
  chatStateUpdated(store.$chat.getState());

  chatStoreInstance = store;
  return store;
});

const $chatStore = createStore<ChatStoreInstance | null>(null).on(
  initialiseChatFx.doneData,
  (_, store) => store,
);

sample({
  clock: merge([openChat, sendMessageRequested]),
  target: initialiseChatFx,
});

const sendMessageFx = createEffect<
  { store: ChatStoreInstance; message: string },
  void
>(async ({ store, message }) => {
  trackEvent("ai_chat_message_send", {
    message_length: message.length,
  });
  await store.send(message);
});

type FileLinkPayload = {
  fileId: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
};

const fileUploadMessagePrepared = createEvent<{
  message: ChatMessage;
  linkPayload: FileLinkPayload;
  threadId: string;
}>();

const saveFileLinkFx = createEffect<{
  threadId: string;
  linkPayload: FileLinkPayload;
}, void>(async ({ threadId, linkPayload }) => {
  await threadsClient.saveMessage({
    threadId,
    user: "user",
    type: MessageType.link,
    data: JSON.stringify(linkPayload),
  });
});

// Событие когда сессия готова (sessionId появился)
const sessionReady = createEvent<ChatStoreInstance>();

// Pending сообщение - ждёт пока сессия будет готова
const $pendingMessage = createStore<string | null>(null)
  .on(sendMessageRequested, (_, msg) => msg.trim() || null)
  .reset(sendMessageFx);

// Следим за состоянием чата и триггерим sessionReady когда sessionId появляется
sample({
  clock: $chatState,
  source: $chatStore,
  filter: (store, state) => Boolean(store) && Boolean(state.sessionId),
  fn: (store) => store as ChatStoreInstance,
  target: sessionReady,
});

// Отправляем сразу если store и sessionId уже есть
sample({
  clock: sendMessageRequested,
  source: { store: $chatStore, state: $chatState },
  filter: ({ store, state }, message) =>
    Boolean(store) && Boolean(state.sessionId) && message.trim().length > 0,
  fn: ({ store }, message) => ({
    store: store as ChatStoreInstance,
    message: message.trim(),
  }),
  target: sendMessageFx,
});

// Отправляем pending сообщение когда сессия готова
sample({
  clock: sessionReady,
  source: $pendingMessage,
  filter: (message): message is string => Boolean(message),
  fn: (message, store) => ({ store, message }),
  target: sendMessageFx,
});

sample({
  clock: merge([sendMessageFx.done, closeChat]),
  target: resetUserText,
});

sample({
  clock: uploadCompleted,
  source: { files: $files, state: $chatState },
  filter: ({ files, state }, fileId) => {
    const file = files.get(fileId);
    if (!file || !state.threadId) {
      return false;
    }
    return !state.messages.some((message) => message.fileData?.fileId === fileId);
  },
  fn: ({ files, state }, fileId) => {
    const file = files.get(fileId)!;
    const fileName = file.fileName || fileId;
    const linkPayload = {
      fileId,
      fileName,
      fileSize: file.fileSize,
      fileType: file.fileType,
    };

    const message: ChatMessage = {
      id: `file_${fileId}`,
      type: "user",
      content: `Файл загружен: ${fileName}`,
      timestamp: Date.now(),
      fileData: linkPayload,
    };

    return { message, linkPayload, threadId: state.threadId };
  },
  target: fileUploadMessagePrepared,
});

sample({
  clock: fileUploadMessagePrepared,
  fn: ({ message }) => message,
  target: addMessage,
});

sample({
  clock: fileUploadMessagePrepared,
  fn: ({ threadId, linkPayload }) => ({ threadId, linkPayload }),
  target: saveFileLinkFx,
});

sample({
  clock: attachmentsSelected,
  filter: (files) => files.length > 0,
  fn: (files) => {
    trackEvent("ai_chat_file_attach", {
      files_count: files.length,
      file_names: files.map((file) => file.name).join(", "),
    });
    return files.map((file, index) => {
      const id = `${Date.now()}-${index}`;
      const name = file.name || `Файл ${index + 1}`;
      const size = file.size || 0;
      return {
        id,
        name,
        size,
        href: `#attachment-${id}`,
      } as AttachmentPreview;
    });
  },
  target: attachmentsPrepared,
});

sample({
  clock: attachmentsPrepared,
  source: $chatState,
  fn: (state, attachments) => {
    const list = attachments
      .map((item) => `- [${item.name}](${item.href})`)
      .join("\n");

    const attachmentMessage: ChatMessage = {
      id: uuidv4(),
      type: "user",
      content: `**Прикрепленные файлы:**\n${list}`,
    };

    return {
      ...state,
      messages: [...state.messages, attachmentMessage],
    };
  },
  target: chatStateUpdated,
});
