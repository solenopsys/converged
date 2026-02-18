import { addMessage, createChatStore } from "assistant-state";
import type { ExecutableTool } from "assistant-state";
import { ServiceType } from "assistant-state";
import { v4 as uuidv4 } from "uuid";

import { assistantClient, threadsClient } from "./services";
import { chatSendRequested, chatInitRequested, registry } from "front-core";
import { $files, uploadCompleted } from "files-state";
import { MessageType } from "integration/types/threads";

// AI-доступные команды (только меню и навигация)
const AI_COMMANDS: Record<string, string> = {
  // Requests
  "requests.show": "Открыть панель заявок",
  // Threads
  "threads.show": "Открыть диалоги/треды",
  // Layouts
  "dashboard.mount": "Открыть дашборд",
  // Logs
  "logs.show": "Показать горячие логи",
  "logs.show.cold": "Показать холодные логи",
  // Telemetry
  "telemetry.show": "Показать горячую телеметрию",
  "telemetry.show.cold": "Показать холодную телеметрию",
  // Dumps
  "dumps.list.show": "Показать список дампов",
  "dumps.storages.show": "Показать статистику хранилищ",
  // DAG
  "show_workflows_list": "Показать список воркфлоу",
  "show_workflows_statistic": "Показать статистику воркфлоу",
  "show_nodes_list": "Показать список нод",
  "show_providers_list": "Показать список провайдеров",
  "show_code_source_list": "Показать список источников кода",
  // AI Chats
  "chats.show_list": "Показать список чатов",
  "chats.show_contexts_list": "Показать список контекстов",
  "chats.show_commands_list": "Показать список команд",
};

const chatStore = createChatStore(assistantClient, threadsClient);
const chatThreadId = uuidv4();

// Флаг для ленивой инициализации
let isInitialized = false;

const ensureInitialized = () => {
  if (!isInitialized) {
    console.log("[Chat] Initializing chat session on first use");
    chatStore.init(chatThreadId, ServiceType.OPENAI, "gpt-4o-mini");
    isInitialized = true;
  }
};

// Подписываемся на событие инициализации из front-core
chatInitRequested.watch(() => {
  console.log("[Chat] Chat initialization requested via event");
  ensureInitialized();
});

// Экспортируем функцию для явной инициализации
export const initializeChat = () => {
  ensureInitialized();
};

const weatherTool: ExecutableTool = {
  name: "weather",
  description: "Get the current weather",
  parameters: {
    type: "object",
    properties: {
      city: {
        type: "string",
        description: "The city to get the weather for",
      },
    },
    required: ["city"],
  },
  execute: async (args: { city: string }) => {
    const city = args.city;
    return { city, temperature: 29, pressure: 1013, windSpeed: 5 };
  },
};

// Tool для получения списка доступных команд (только AI-доступные)
const getCommandsTool: ExecutableTool = {
  name: "getCommands",
  description: "Get available UI navigation commands",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  execute: async () => {
    return Object.entries(AI_COMMANDS).map(([id, desc]) => ({ id, desc }));
  },
};

// Tool для выполнения команды (только из AI_COMMANDS whitelist)
const execCommandTool: ExecutableTool = {
  name: "execCommand",
  description: "Execute UI navigation command by id",
  parameters: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "Command id from getCommands",
      },
    },
    required: ["id"],
  },
  execute: async (args: { id: string } | string) => {
    console.log("[execCommand] Raw args:", args, typeof args);

    // Парсим аргументы - могут прийти как объект или как строка JSON
    let commandId: string | undefined;
    if (typeof args === "string") {
      try {
        const parsed = JSON.parse(args);
        commandId = parsed.id;
      } catch {
        commandId = args;
      }
    } else {
      commandId = args?.id;
    }

    console.log("[execCommand] Parsed commandId:", commandId);
    console.log("[execCommand] Registered commands:", registry.getAllIds());

    // Проверяем что команда указана
    if (!commandId) {
      addMessage({
        id: `cmd_err_${Date.now()}`,
        type: "assistant",
        content: `⚠️ Не указан id команды`,
        timestamp: Date.now(),
      });
      return { ok: false, error: "Command id not provided" };
    }

    // Проверяем что команда в whitelist
    if (!AI_COMMANDS[commandId]) {
      addMessage({
        id: `cmd_err_${Date.now()}`,
        type: "assistant",
        content: `⚠️ Команда \`${commandId}\` недоступна`,
        timestamp: Date.now(),
      });
      return { ok: false, error: "Command not allowed" };
    }

    const cmd = registry.get(commandId);
    if (!cmd) {
      console.log("[execCommand] Command not found in registry:", commandId);
      addMessage({
        id: `cmd_err_${Date.now()}`,
        type: "assistant",
        content: `⚠️ Команда \`${commandId}\` не зарегистрирована`,
        timestamp: Date.now(),
      });
      return { ok: false, error: "Command not registered" };
    }

    try {
      registry.run(commandId, {});
      addMessage({
        id: `cmd_${Date.now()}`,
        type: "assistant",
        content: `✅ ${AI_COMMANDS[commandId]}`,
        timestamp: Date.now(),
      });
      return { ok: true };
    } catch (e) {
      addMessage({
        id: `cmd_err_${Date.now()}`,
        type: "assistant",
        content: `❌ Ошибка: ${AI_COMMANDS[commandId]}`,
        timestamp: Date.now(),
      });
      return { ok: false, error: e instanceof Error ? e.message : "Error" };
    }
  },
};

chatStore.registerFunction("weather", weatherTool);
chatStore.registerFunction("getCommands", getCommandsTool);
chatStore.registerFunction("execCommand", execCommandTool);

chatSendRequested.watch((message) => {
  ensureInitialized(); // Инициализируем чат только при первой отправке сообщения
  chatStore.send(message);
});

uploadCompleted.watch((fileId) => {
  const fileState = $files.getState().get(fileId);
  if (!fileState) return;

  const chatMessage = {
    id: `file_${fileId}`,
    type: "user" as const,
    content: `Файл загружен: ${fileState.fileName}`,
    timestamp: Date.now(),
    fileData: {
      fileId,
      fileName: fileState.fileName,
      fileSize: fileState.fileSize,
      fileType: fileState.fileType,
    },
  };

  addMessage(chatMessage);

  threadsClient.saveMessage({
    threadId: chatThreadId,
    user: "user",
    type: MessageType.link,
    data: JSON.stringify({
      fileId,
      fileName: fileState.fileName,
      fileSize: fileState.fileSize,
      fileType: fileState.fileType,
    }),
  });
});

export { chatStore, chatThreadId };
