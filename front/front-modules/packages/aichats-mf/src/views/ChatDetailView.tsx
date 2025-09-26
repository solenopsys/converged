import React, { useState } from 'react';
import { Send, User, Bot } from 'lucide-react';
import { mockChatStore } from './conf';
import { ChatDetail } from '../components/ChatDetail';
import { createChatStore } from 'front-chat-core';
import { useUnit } from 'effector-react';
import {aichatClient, threadsClient} from '../services';
import { ChatState,  ServiceType } from 'front-chat-core';
import { v4 as uuidv4 } from 'uuid';

 

const chatStore = createChatStore(aichatClient, threadsClient);


const uuid=uuidv4();

chatStore.init(uuid, ServiceType.OPENAI, 'gpt-3.5-turbo');

 

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
  return (<div>
   
    <ChatDetail messages={messages} isLoading={isLoading} currentResponse={currentResponse} send={handleSend} />
    </div>);
};

export  {ChatDetailView};
