chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'copyAsMarkdown',
    title: 'Copy as Markdown for AI',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'copyAsMarkdown') {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [
        'lib/turndown.js',
        'lib/turndown-plugin-gfm.js',
        'content.js'
      ]
    });
  }
});
