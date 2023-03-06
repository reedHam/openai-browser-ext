/**
 * Responsible for parsing youtube for specific data, e.g. urls, tags, comments, etc.
 */

import { sendMessage } from 'webext-bridge';
import { waitForElm } from '../lib/DOMesticated.js';
console.log('Script loaded');

waitForElm('#mw-content-text > div > p:not(.mw-empty-elt)').then(async (firstParagraph) => {
    console.log('first paragraph found', firstParagraph);
    const text = firstParagraph.innerText;
    console.log('text extracted', text);
    const summary = await sendMessage('summarize', { text });
    console.log('summary received', summary);
    const summaryParagraph = document.createElement('p');
    summaryParagraph.style.backgroundColor = `rgba(0, 0, 0, 0.25)`
    summaryParagraph.innerText = summary;
    firstParagraph.after(summaryParagraph);
 })


