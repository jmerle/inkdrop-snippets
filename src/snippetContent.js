'use babel';

// Parses `$1$` / `$1:default$` placeholder markers out of a snippet's content,
// returning the plain text with markers stripped and the character ranges (relative
// to that plain text) each placeholder occupies, ordered by placeholder index. Kept
// separate from Editor.js since it has nothing to do with the editor itself.
export function processContent(content) {
  const placeholders = [];
  const placeholderPattern = /((?<!\\)\$(\d+)(:[^$]*)?\$)/;

  while (true) {
    const match = content.match(placeholderPattern);

    if (match === null) {
      break;
    }

    const index = parseInt(match[2], 10);

    let placeholderValue = match[3];
    if (placeholderValue === undefined || placeholderValue === ':') {
      placeholderValue = `$${index}`;
    } else {
      placeholderValue = placeholderValue.substr(1);
    }

    const start = match.index;
    const end = start + placeholderValue.length;

    placeholders.push({ index, start, end });

    const prefix = content.substr(0, start);
    const suffix = content.substr(start + match[0].length);
    content = prefix + placeholderValue + suffix;
  }

  const orderedPlaceholders = placeholders
    .sort((a, b) => a.index - b.index)
    .map(placeholder => ({ start: placeholder.start, end: placeholder.end }));

  return {
    processedContent: content,
    placeholders: orderedPlaceholders,
  };
}
