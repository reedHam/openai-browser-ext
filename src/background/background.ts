/**
 * The background script for the extension is responsible for sending requests to the servers using fetch.
 */
// Inside background script
import { onMessage } from 'webext-bridge'  

onMessage('test', ({ data: { a, b } }) => {
    console.log(a, b);
    return { result: true };
});