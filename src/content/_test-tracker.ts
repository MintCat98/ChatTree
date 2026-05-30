import { assignChatboxIds, detectBranch, buildTree, reloadFromNode } from './chatbox-tracker';
//import { MessageType } from '@shared/message-types';
import { startObserving } from './observer';

/*
console.log('[test] assignChatboxIds:', assignChatboxIds());
console.log('[test] detectBranch:', detectBranch(document.body));
console.log('[test] buildTree:', buildTree([]));
console.log('[test] reloadFromNode:', reloadFromNode('node-1', []));

setTimeout(() => {
  console.log('[test] assignChatboxIds:', assignChatboxIds());
  console.log('[test] detectBranch:', detectBranch(document.body));
  console.log('[test] buildTree:', buildTree(assignChatboxIds()));
  console.log('[test] reloadFromNode:', reloadFromNode('node-1', []));
}, 3000);
*/

// Test for handleDOM
/*
setTimeout(() => {
  const nodes = assignChatboxIds();
  const tree = buildTree(nodes);

  chrome.runtime.sendMessage({
    type: MessageType.CHATBOX_ADDED,
    payload: { nodes, sessionId: tree.sessionId },
  });
  console.log('[test] sendMessage called:', { nodes, sessionId: tree.sessionId });
}, 6000);
*/

// test for startObserving()
//startObserving();
