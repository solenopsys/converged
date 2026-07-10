declare module "*.scss" {
  const content: { [className: string]: string };
  export default content;
}

declare module "*?worker" {
  const WorkerFactory: {
    new (): Worker;
  };
  export default WorkerFactory;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    openAssistantSidebar?: (
      payload?:
        | {
            topic?: string;
            message?: string;
            send?: boolean;
          }
        | string,
    ) => void;
    openAiChatSidebar?: Window["openAssistantSidebar"];
  }
}

export {};
