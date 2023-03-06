import { Component, For } from 'solid-js';
import { createSignal } from 'solid-js';
import { sendMessage } from 'webext-bridge';
import { ChatMessage } from '../background/background.js';

import styles from './App.module.css';

const App: Component = () => {
  const [systemMessage, setSystemMessage] = createSignal('');
  const [userMessage, setUserMessage] = createSignal('');
  const [messageThread, setMessageThread] = createSignal<ChatMessage[]>([]);
  const [threadID, setThreadID] = createSignal('');

  sendMessage('set_key', { key: "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" });

  return (
    <div class={styles.App}>
      <div>
        <input onchange={(e) => {
          if (e.target instanceof HTMLInputElement) {
            setSystemMessage(e.target.value);
          }
        }} placeholder='System Prompt' />
        <input onchange={(e) => {
          if (e.target instanceof HTMLInputElement) {
            setUserMessage(e.target.value);
          }
        }} placeholder='User Prompt' />

        <button onclick={async () => {
          if (!threadID()) {
            let newThreadID = await sendMessage('create_chat_thread', [
              {
                role: 'system',
                content: systemMessage()
              }
            ]);
            setThreadID(newThreadID);
          }

          const response = await sendMessage('send_chat_message', {
            threadId: threadID(),
            message: userMessage()
          });

          setMessageThread(response);
        }}>Send</button>
      </div>
      <div style={
        {
          display: "grid",
          "grid-template-columns": "1fr 1fr"
        }
      }>
        <For each={messageThread()} >
          {(message) => { 
            return (
              <>
                <div>{message.role}</div>
                <div>{message.content}</div>
              </>
            )
          }}
        </For>
      </div>
    </div>
  );
};

export default App;
