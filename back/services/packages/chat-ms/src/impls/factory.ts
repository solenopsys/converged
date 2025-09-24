

import { ConversationFactory } from "../types";
import { ServiceType } from "../types";
import { LogFunction } from "../types";
import { AiConversation } from "../types";
import { OpenAIConversation } from "./openai";

// Простая фабрика
export class SimpleConversationFactory implements ConversationFactory {
    private apiKeys: Map<ServiceType, string> = new Map();
    
    constructor(config: { openaiApiKey?: string; anthropicApiKey?: string } = {}) {
        if (config.openaiApiKey) {
            this.apiKeys.set(ServiceType.OPENAI, config.openaiApiKey);
        }
        if (config.anthropicApiKey) {
            this.apiKeys.set(ServiceType.ANTHROPIC, config.anthropicApiKey);
        }
    }
    
    create(serviceType: ServiceType, model: string, log: LogFunction): AiConversation {
        const apiKey = this.apiKeys.get(serviceType);
        if (!apiKey) {
            throw new Error(`No API key configured for service: ${serviceType}`);
        }
        
        switch (serviceType) {
            case ServiceType.OPENAI:
                return new OpenAIConversation(model, apiKey, log);
            
            case ServiceType.ANTHROPIC:
                throw new Error("Anthropic not implemented yet");
            
            default:
                throw new Error(`Unsupported service type: ${serviceType}`);
        }
    }
}