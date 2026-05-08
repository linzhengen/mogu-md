(function () {
  'use strict';

  // ── 1. Get selection ────────────────────────────────────────────
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    showToast('No text selected', 'error');
    return;
  }

  const range = selection.getRangeAt(0);
  const fragment = range.cloneContents();

  if (!fragment.hasChildNodes()) {
    showToast('Selection is empty', 'error');
    return;
  }

  // ── 2. Process the fragment (all operations on the clone, never on live DOM) ──
  removeNoise(fragment);
  resolveRelativeUrls(fragment);
  normalizeTables(fragment);

  // ── 3. Convert to Markdown ─────────────────────────────────────
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-'
  });

  turndownService.use(turndownPluginGfm.gfm);

  // Custom rule: ensure tables have blank lines around them for readability
  turndownService.addRule('tableSpacing', {
    filter: ['table'],
    replacement: function (content) {
      return '\n\n' + content.trim() + '\n\n';
    }
  });

  let markdown = turndownService.turndown(fragment);

  // Clean up excessive blank lines (more than 3 -> 3)
  markdown = markdown.replace(/\n{4,}/g, '\n\n\n');

  // ── 4. Prepend metadata ────────────────────────────────────────
  const metadata = buildMetadata();
  markdown = metadata + markdown.trim();

  // ── 5. Copy to clipboard ───────────────────────────────────────
  navigator.clipboard.writeText(markdown).then(function () {
    showToast('Markdown copied to clipboard', 'success');
    // Notify background — it will open Gemini if the user chose the Gemini menu item
    try {
      chrome.runtime.sendMessage({ type: 'markdown-converted', text: markdown });
    } catch (e) { /* background may not be listening */ }
  }).catch(function (err) {
    console.error('Clipboard write failed:', err);
    showToast('Failed to copy to clipboard', 'error');
  });

  // ── Helper functions ───────────────────────────────────────────

  /**
   * Remove noise elements from the cloned fragment:
   * scripts, styles, hidden elements, interactive widgets, empty wrappers
   */
  function removeNoise(root) {
    // Remove <script>, <style>, <noscript>
    removeElements(root, 'script, style, noscript');

    // Remove [hidden] and [aria-hidden="true"]
    removeElements(root, '[hidden], [aria-hidden="true"]');

    // Remove elements with inline display:none or visibility:hidden
    var all = root.querySelectorAll('[style]');
    for (var i = 0; i < all.length; i++) {
      try {
        var s = all[i].getAttribute('style') || '';
        if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(s)) {
          var p = all[i].parentNode;
          if (p) p.removeChild(all[i]);
        }
      } catch (e) { /* skip */ }
    }

    // Remove interactive elements (keep <a> for link context)
    removeElements(root, 'button, input, select, textarea, [role="button"]');

    // Remove empty wrapper elements
    removeEmptyElements(root);
  }

  function removeElements(root, selector) {
    var elements = root.querySelectorAll(selector);
    for (var i = 0; i < elements.length; i++) {
      var p = elements[i].parentNode;
      if (p) p.removeChild(elements[i]);
    }
  }

  function isElementEmpty(el) {
    var tag = el.tagName;
    // Keep self-contained elements
    if (tag === 'IMG' && el.getAttribute('src')) return false;
    if (tag === 'BR' || tag === 'HR') return false;
    // Keep table cells even if empty (preserve table structure)
    if (tag === 'TD' || tag === 'TH') return false;
    // Has text?
    if ((el.textContent || '').trim()) return false;
    // Has meaningful children?
    var children = el.children;
    for (var i = 0; i < children.length; i++) {
      if (!isElementEmpty(children[i])) return false;
    }
    return true;
  }

  function removeEmptyElements(root) {
    // Use a tree walker, collect empties, remove bottom-up
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    var toRemove = [];
    var node;
    while ((node = walker.nextNode())) {
      if (isElementEmpty(node)) {
        toRemove.push(node);
      }
    }
    for (var i = toRemove.length - 1; i >= 0; i--) {
      var p = toRemove[i].parentNode;
      if (p) p.removeChild(toRemove[i]);
    }
  }

  /**
   * Convert relative URLs (href, src) to absolute in the cloned fragment
   */
  function resolveRelativeUrls(root) {
    var baseUrl = window.location.href;

    var links = root.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      try {
        links[i].setAttribute('href', new URL(links[i].getAttribute('href'), baseUrl).href);
      } catch (e) { /* skip invalid */ }
    }

    var imgs = root.querySelectorAll('img[src]');
    for (var i = 0; i < imgs.length; i++) {
      try {
        imgs[i].setAttribute('src', new URL(imgs[i].getAttribute('src'), baseUrl).href);
      } catch (e) { /* skip invalid */ }
    }
  }

  /**
   * Normalize all tables in the fragment:
   * rowspan/colspan are expanded into individual cells so Turndown+GFM
   * produces a clean grid. All work is done on the detached fragment clone.
   */
  function normalizeTables(root) {
    var tables = root.querySelectorAll('table');
    for (var t = 0; t < tables.length; t++) {
      normalizeTable(tables[t]);
    }
  }

  function normalizeTable(table) {
    // Collect direct child rows (handles both section-based and row-based tables)
    // First, check for thead/tbody/tfoot sections
    var sections = table.children;
    var hasSections = false;
    for (var i = 0; i < sections.length; i++) {
      var tag = sections[i].tagName;
      if (tag === 'THEAD' || tag === 'TBODY' || tag === 'TFOOT') {
        hasSections = true;
        normalizeTableRows(sections[i]);
      } else if (tag === 'TR') {
        // Rows directly inside <table> (no sections)
        // Handled below
      }
    }

    if (!hasSections) {
      normalizeTableRows(table);
    }
  }

  /**
   * Extract direct-child TR elements from a container (table/thead/tbody/tfoot),
   * build a grid, expand rowspan/colspan, then rebuild clean rows.
   */
  function normalizeTableRows(container) {
    // Get only direct-child TR elements (don't descend into nested tables)
    var rows = [];
    var children = container.children;
    for (var i = 0; i < children.length; i++) {
      if (children[i].tagName === 'TR') {
        rows.push(children[i]);
      }
    }

    if (rows.length === 0) return;

    // ── Build the grid ──
    // First pass: determine max columns
    var maxCols = 0;
    var rowData = [];
    for (var r = 0; r < rows.length; r++) {
      // Get only direct td/th children of the row (avoid nested table cells)
      var cellEls = [];
      var rowChildren = rows[r].children;
      for (var j = 0; j < rowChildren.length; j++) {
        var t = rowChildren[j].tagName;
        if (t === 'TD' || t === 'TH') {
          cellEls.push(rowChildren[j]);
        }
      }

      var colCount = 0;
      var cellList = [];
      for (var c = 0; c < cellEls.length; c++) {
        var cs = parseInt(cellEls[c].getAttribute('colspan') || '1');
        colCount += cs;
        cellList.push({
          el: cellEls[c],
          colspan: cs,
          rowspan: parseInt(cellEls[c].getAttribute('rowspan') || '1'),
          tag: cellEls[c].tagName
        });
      }
      if (colCount > maxCols) maxCols = colCount;
      rowData.push({ cells: cellList, colspanTotal: colCount });
    }

    if (maxCols === 0) return;

    // Initialize grid with nulls
    var grid = [];
    for (var r = 0; r < rows.length; r++) {
      grid[r] = new Array(maxCols).fill(null);
    }

    // Fill grid, expanding rowspan/colspan
    for (var r = 0; r < rows.length; r++) {
      var colIdx = 0;
      var cellList = rowData[r].cells;

      for (var c = 0; c < cellList.length; c++) {
        // Skip columns occupied by rowspan from above
        while (colIdx < maxCols && grid[r][colIdx] !== null) {
          colIdx++;
        }
        if (colIdx >= maxCols) break;

        var cellInfo = cellList[c];
        for (var dr = 0; dr < cellInfo.rowspan; dr++) {
          for (var dc = 0; dc < cellInfo.colspan; dc++) {
            var rr = r + dr;
            var cc = colIdx + dc;
            if (rr < rows.length && cc < maxCols) {
              if (dr === 0 && dc === 0) {
                // Original position
                grid[rr][cc] = cellInfo;
              } else {
                // Duplicated (merged) position — reference the source cell
                grid[rr][cc] = { source: cellInfo, isDup: true };
              }
            }
          }
        }
        colIdx += cellInfo.colspan;
      }
    }

    // ── Rebuild the rows with clean cells (no rowspan/colspan) ──
    for (var r = 0; r < rows.length; r++) {
      // Clear the existing row
      while (rows[r].firstChild) {
        rows[r].removeChild(rows[r].firstChild);
      }

      // Create new cells from the grid
      for (var c = 0; c < maxCols; c++) {
        var cell = grid[r][c];
        var newCell;

        if (cell === null) {
          // Empty cell (shouldn't happen if grid is consistent)
          newCell = document.createElement('td');
        } else if (cell.isDup) {
          // Duplicate: clone source cell content
          newCell = document.createElement(cell.source.tag === 'TH' ? 'th' : 'td');
          var srcEl = cell.source.el;
          if (srcEl) {
            newCell.innerHTML = srcEl.innerHTML;
            // Copy relevant attributes (but not rowspan/colspan)
            copyAttrs(srcEl, newCell);
          }
        } else {
          // Original cell: clone content, strip rowspan/colspan
          newCell = document.createElement(cell.tag === 'TH' ? 'th' : 'td');
          var el = cell.el;
          if (el) {
            newCell.innerHTML = el.innerHTML;
            copyAttrs(el, newCell);
          }
        }
        rows[r].appendChild(newCell);
      }
    }
  }

  function copyAttrs(src, dest) {
    var attrs = src.attributes;
    for (var i = 0; i < attrs.length; i++) {
      var name = attrs[i].name;
      // Skip rowspan/colspan since we've expanded them
      if (name === 'rowspan' || name === 'colspan') continue;
      dest.setAttribute(name, attrs[i].value);
    }
  }

  function buildMetadata() {
    var title = document.title || 'Untitled';
    var url = window.location.href;
    var now = new Date();
    var dateStr = now.getFullYear() + '-' +
      pad(now.getMonth() + 1) + '-' +
      pad(now.getDate()) + ' ' +
      pad(now.getHours()) + ':' +
      pad(now.getMinutes());

    return '> **Source:** [' + title + '](' + url + ')\n' +
           '> **Selected at:** ' + dateStr + '\n\n---\n\n';
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function showToast(message, type) {
    var existing = document.getElementById('_md_ai_toast_');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = '_md_ai_toast_';
    toast.textContent = message;
    toast.style.cssText = [
      'position:fixed',
      'bottom:24px',
      'right:24px',
      'z-index:2147483647',
      'padding:10px 20px',
      'border-radius:6px',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif',
      'font-size:14px',
      'color:#fff',
      'box-shadow:0 4px 12px rgba(0,0,0,0.2)',
      'pointer-events:none',
      type === 'error' ? 'background:#dc3545' : 'background:#28a745'
    ].join(';');

    document.body.appendChild(toast);

    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease-out';
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2000);
  }
})();
