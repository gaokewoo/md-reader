// DOM-based search highlight utilities
// Extracted from MarkdownViewer to allow App.tsx to operate on any tab container

/**
 * Find text nodes and wrap matches with <mark class="search-highlight">
 * Returns the total number of matches found.
 */
export function applySearchHighlights(container: HTMLElement, keyword: string): number {
  // First, remove any existing highlights
  const existingMarks = container.querySelectorAll('mark.search-highlight')
  for (const mark of existingMarks) {
    const parent = mark.parentNode
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ''), mark)
      parent.normalize() // Merge adjacent text nodes
    }
  }

  if (!keyword) return 0

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    // Skip script/style nodes
    if (node.parentElement?.tagName === 'SCRIPT' || node.parentElement?.tagName === 'STYLE') continue
    if (node.textContent && node.textContent.toLowerCase().includes(keyword.toLowerCase())) {
      textNodes.push(node)
    }
  }

  let matchCount = 0
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')

  for (const textNode of textNodes) {
    const text = textNode.textContent || ''
    const parts = text.split(regex)
    if (parts.length <= 1) continue

    const fragment = document.createDocumentFragment()
    for (const part of parts) {
      if (regex.test(part)) {
        const mark = document.createElement('mark')
        mark.className = 'search-highlight'
        mark.textContent = part
        mark.setAttribute('data-match-index', String(matchCount))
        fragment.appendChild(mark)
        matchCount++
      } else {
        fragment.appendChild(document.createTextNode(part))
      }
    }

    textNode.parentNode?.replaceChild(fragment, textNode)
  }

  return matchCount
}

/**
 * Scroll to a specific match and highlight it as current.
 */
export function scrollToMatch(container: HTMLElement, matchIndex: number) {
  const marks = container.querySelectorAll('mark.search-highlight')
  // Remove current highlight from all
  marks.forEach(m => {
    m.classList.remove('search-highlight-current')
  })

  if (matchIndex >= 0 && matchIndex < marks.length) {
    const target = marks[matchIndex]
    target.classList.add('search-highlight-current')
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}
