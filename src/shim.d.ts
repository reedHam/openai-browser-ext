import { ProtocolWithReturn } from 'webext-bridge';
import { ChatMessage } from './background/background.js';

declare module 'webext-bridge' {
  export interface ProtocolMap {
    set_key: ProtocolWithReturn<{ key: string }, boolean>
    create_chat_thread: ProtocolWithReturn<ChatMessage[], string>
    send_chat_message: ProtocolWithReturn<{ threadId: string, message: string }, ChatMessage[]>
  }
}