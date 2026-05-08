// Track whether we should open Gemini after conversion
let pendingGemini = false;

// ── Context menus ──────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'copyAsMarkdown',
    title: 'Copy as Markdown for AI',
    contexts: ['selection']
  });
  chrome.contextMenus.create({
    id: 'copyAsMarkdownAndGemini',
    title: 'Copy as Markdown & Open in Gemini',
    contexts: ['selection']
  });
});

// ── Context menu click handler ─────────────────────────────────
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'copyAsMarkdown') {
    pendingGemini = false;
    injectConversionScripts(tab.id);
  } else if (info.menuItemId === 'copyAsMarkdownAndGemini') {
    pendingGemini = true;
    injectConversionScripts(tab.id);
  }
});

function injectConversionScripts(tabId) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: [
      'lib/turndown.js',
      'lib/turndown-plugin-gfm.js',
      'content.js'
    ]
  });
}

// ── Receive markdown from content script ───────────────────────
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'markdown-converted' && pendingGemini) {
    pendingGemini = false;
    openAndFillGemini(message.text);
  }
});

// ── Open Gemini and auto-fill ──────────────────────────────────
function openAndFillGemini(markdown) {
  chrome.tabs.create({ url: 'https://gemini.google.com/app' }, (tab) => {
    // Wait for the Gemini tab to finish loading, then inject fill script
    function onUpdated(tabId, changeInfo) {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        injectFillScript(tabId, markdown);
      }
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

function injectFillScript(tabId, markdown) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: fillGeminiInput,
    args: [markdown]
  }).catch((err) => {
    console.error('Failed to inject fill script into Gemini:', err);
  });
}

/**
 * Injected into the Gemini tab to find the input area and paste the markdown.
 * Tries multiple strategies since Gemini's DOM may change over time.
 */
function fillGeminiInput(markdown) {
  // Small delay to let Gemini's SPA finish rendering
  setTimeout(() => {
    // Strategy 1: contenteditable div (most common for rich-text inputs)
    const editableDivs = document.querySelectorAll('div[contenteditable="true"]');
    for (const div of editableDivs) {
      // Skip if hidden, tiny (toolbar buttons), or inside a sidebar
      if (div.offsetParent === null && div.clientHeight === 0) continue;
      if (div.closest('[role="navigation"], [role="complementary"]')) continue;

      // Found the main input — focus and fill
      div.focus();
      div.textContent = markdown;

      // Dispatch input event so Gemini's framework detects the change
      div.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
      div.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    // Strategy 2: fallback — look for a visible textarea
    const textareas = document.querySelectorAll('textarea');
    for (const ta of textareas) {
      if (ta.offsetParent === null || ta.offsetParent === undefined) continue;
      ta.focus();
      ta.value = markdown;
      ta.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    // Strategy 3: last resort — try the shadow DOM of rich-textarea
    const richTextareas = document.querySelectorAll('rich-textarea');
    for (const rt of richTextareas) {
      if (rt.shadowRoot) {
        const editable = rt.shadowRoot.querySelector('div[contenteditable="true"]');
        if (editable) {
          editable.focus();
          editable.textContent = markdown;
          editable.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
          return;
        }
      }
    }

    console.warn('mogu-md: Could not find Gemini input field');
  }, 1500);
}
