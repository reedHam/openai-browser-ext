import { onMessage } from 'webext-bridge';
import { type CreateChatCompletionResponse, Configuration, OpenAIApi } from 'openai';
import { LowSync } from 'lowdb';
import { LocalStorage } from 'lowdb/browser';
import lodash, { uniqueId } from 'lodash';

class LowWithLodash<T> extends LowSync<T> {
  chain: lodash.ExpChain<this['data']> = lodash.chain(this).get('data')
}

export type ChatMessage = {
    role: 'system' | 'assistant' | 'user',
    content: string,
};

export class ChatMessageThread extends Array<ChatMessage> {
    constructor(existingThread?: ChatMessageThread | ChatMessage[]) {
        super();
        if (existingThread) {
            this.push(...existingThread);
        }
    }

    public pushSystemMessage(message: string) {
        this.push({
            role: 'system',
            content: message,
        });
    }

    public pushAssistantMessage(message: string) {
        this.push({
            role: 'assistant',
            content: message,
        });
    }

    public pushUserMessage(message: string) {
        this.push({
            role: 'user',
            content: message,
        });
    }
}


type ChatThreads = Record<string, ChatMessageThread>;

class OpenAI {
    private static instance: OpenAI;
    public api!: OpenAIApi;
    private chatThreadDB!: LowWithLodash<ChatThreads>;

    private static CHAT_MODEL = 'gpt-3.5-turbo';

    public constructor() {
        if (OpenAI.instance) {
            return OpenAI.instance;
        }

        this.chatThreadDB = new LowWithLodash(new LocalStorage('chat_threads'));
        this.chatThreadDB.read();
        if (this.chatThreadDB.data == null) {
            this.chatThreadDB.data = {};
            this.chatThreadDB.write();
        }

        const key = localStorage.getItem('key');
        if (!key) {
            throw new Error('No API key found');
        }
        const config = new Configuration({ apiKey: key });
        this.api = new OpenAIApi(config);

        OpenAI.instance = this;
    }

    public writeChatThread(chatThread: ChatMessageThread, threadID?: string,): string {
        if (!threadID) {
            threadID = lodash.uniqueId();
        }
        
        this.chatThreadDB.read();
        if (this.chatThreadDB.data == null) {
            this.chatThreadDB.data = {};
        }

        this.chatThreadDB.data[threadID] = chatThread;
        this.chatThreadDB.write();
        return threadID;
    }

    private async sendChatCompletionRequest(chatThread: ChatMessageThread): Promise<CreateChatCompletionResponse> {
        const res = await this.api.createChatCompletion({
            model: OpenAI.CHAT_MODEL,
            messages: chatThread,
        });
        return res.data;
    }

    public async sendChatMessage(threadId: string, message: string): Promise<ChatMessageThread> {
        const chatThread = new ChatMessageThread(this.chatThreadDB.chain.get(threadId).value());
        if (!chatThread) {
            throw new Error('Invalid thread ID');
        }

        chatThread.pushUserMessage(message);

        const response = await this.sendChatCompletionRequest(chatThread);

        for (const choice of response.choices) {
            if (choice.message) {
                chatThread.push({
                    role: choice.message.role,
                    content: choice.message.content,
                });
                break;
            }
        }

        this.writeChatThread(chatThread, threadId);
        return chatThread;
    }

    public async summarize(text: string): Promise<string> {
        const chatMessageThread = new ChatMessageThread([
            {
                role: 'system',
                content: 'You are a tool that summarizes text. The outputs you provide are as short and concise as possible without leaving and important information out.',
            },
            {
                role: 'user',
                content: `Summarize this text: ${text}`
            }
        ]);

        const res = await this.sendChatCompletionRequest(chatMessageThread);
        
        const finalChoice = res.choices.pop();
        if (!finalChoice || !finalChoice.message || finalChoice.message.role !== 'assistant' || !finalChoice.message.content) {
            throw new Error('No choices returned');
        }

        console.log(finalChoice.message.content);
        return finalChoice.message.content;
    }
}

onMessage('set_key', ({ data: { key } }) => {
    try {
        localStorage.setItem('key', key);
        openai = new OpenAI();
    } catch (e) {
        return false;
    }
    return true;
});


onMessage('create_chat_thread', ({ data }) => {
    return openai.writeChatThread(new ChatMessageThread(data));
});

onMessage('send_chat_message', ({ data: { threadId, message } }) => {
    return openai.sendChatMessage(threadId, message);
});

onMessage('summarize', ({ data: { text } }) => {
    return openai.summarize(text);
});


var openai = new OpenAI();

