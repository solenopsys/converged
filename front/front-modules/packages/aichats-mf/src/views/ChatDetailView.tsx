import React, { useState } from 'react';
import { Send, User, Bot } from 'lucide-react';
import { mockChatStore } from './conf';
import { ChatDetail } from '../components/ChatDetail';
import { createChatStore } from 'front-chat-core';
import { useUnit } from 'effector-react';
import {aichatClient, threadsClient} from '../services';
import { ChatState,  ServiceType,Tool } from 'front-chat-core';
import { v4 as uuidv4 } from 'uuid';

 

const chatStore = createChatStore(aichatClient, threadsClient);


const uuid=uuidv4();

//chatStore.init(uuid, ServiceType.OPENAI,"gpt-3.5-turbo" );   // 'gpt-3.5-turbo'
chatStore.init(uuid, ServiceType.ANTHROPIC, 'claude-3-5-haiku-20241022'); 

const weatherTool:Tool={
    name: 'weather',
    description: 'Get the current weather',
    parameters: {
        type: 'object',
        properties: {
            city: {
                type: 'string',
                description: 'The city to get the weather for'
            }
        },
        required: ['city']
    },
    execute: async (args: any) => {
        console.log("ВЫЗОВ ФУНКЦИИ weather----------------------------", args);
        const city = args.city;
         
        return {city: city,temperature: 29,pressure: 1013,windSpeed: 5};
    }
};


chatStore.registerFunction('weather', weatherTool )
 

const ChatDetailView: React.FC = ( ) => {
  // const chatState = mockChatStore.$chat;
  // const send = mockChatStore.send;

  const { messages, isLoading, currentResponse }: ChatState = useUnit(chatStore.$chat);
 
  const handleSend = (inputValue:string): void => {
    console.log("Send", inputValue);
    if (!inputValue.trim() || isLoading) return;
    console.log("Send2", inputValue);
    chatStore.send(inputValue);
  
  };
  return (<div className="  h-screen">
   
    <ChatDetail  messages={messages} isLoading={isLoading} currentResponse={currentResponse} send={handleSend} />
    </div>);
};

export  {ChatDetailView};
