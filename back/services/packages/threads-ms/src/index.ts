

// services/MailingServiceImpl.ts
import type {ThreadsService  } from '../../../../../types/threads';
import {ULID,Message,StoreType,createStore,Store,MessageType} from "back-core";

 
class ThreadsServiceImpl implements ThreadsService {
    store:KVStore;
  

    constructor( ) {
      this.store=  createStore("threads-ms","threads",StoreType.KEY_VALUE)
    }

    async newThread(meta:{description:string,author:string}): Promise<ULID> {
        const threadId=ULID.create();
        this.store.set("thread:"+threadId+":meta",meta);
        return threadId;
    }

    async addItem(threadId: ULID, data: string,type:MessageType, beforeId?: ULID): Promise<Message> {
        const messageId=ULID.create();
        if(beforeId){
           this.store.set(messageId,beforeId);
        }
 
        this.store.set(messageId,{  
            type:MessageType.message,
            data
        });
        return {
            threadId,
            id: messageId,
            type:MessageType.message,
            data
        };
    }

    async moveHead(threadId: ULID, itemId: ULID): Promise<void> {
        const beforeN=this.store.get("thread:"+threadId+":head");
        // scan and replace
        const n=beforeN?beforeN+1:1;
        this.store.set("thread:"+threadId+":head:"+n,itemId);
    }


    async addText(threadId: ULID, text: string, beforeId?: ULID): Promise<Message> {
        return this.addItem(threadId,text,MessageType.message,beforeId);
    }

    async addLink(threadId: ULID, link: string, beforeId?: ULID): Promise<Message> {
        return this.addItem(threadId,link,MessageType.link,beforeId);
    }

    async readHead(threadId: ULID,headItemId: ULID, beforeCount: number): Promise<Message[]> {
        const messages:Message[]=[];
        let beforeId=headItemId;
        for(let i=0;i<beforeCount;i++){
            const messageId=this.store.get(beforeId);
            if(messageId){
                const message=this.store.get(threadId+":"+messageId);
                messages.push(message);
                beforeId=message.beforeId;
            }
        }
        return messages;
    }

    async readThree(threadId: ULID): Promise<Message[]> {
        return this.readRangeByPrefix(threadId);
    }

  

   
}

export default MailingServiceImpl;