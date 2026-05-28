// Service Worker entry point — registers the message relay listener.

import { onMessage } from './message-handler';

chrome.runtime.onMessage.addListener(onMessage);
