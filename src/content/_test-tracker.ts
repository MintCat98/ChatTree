import { assignChatboxIds, detectBranch, buildTree, reloadFromNode } from './chatbox-tracker';

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