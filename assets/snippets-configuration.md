```js
/*
This note is a configuration note for the Snippets plugin.
Moving the note to trash causes this note to be unregistered as a snippets configuration.
Moving the note to a different notebook or renaming it will not cause problems.
Saving the note will reload the snippets.

Documentation on the format of this note:
https://github.com/jmerle/inkdrop-snippets#usage
*/

[
    // Example 1: static snippet which prints "Snippets"
    {
        trigger: 'snippet',
        content: 'Snippets',
    },

    // Example 2: dynamic snippet which prints a formatted timestamp
    {
        trigger: 'timestamp',
        content: () => format(new Date(), 'dd-MM-yyyy HH:mm:ss'),
    },

    // Example 3: multi-line snippet with placeholders and a default value
    {
        trigger: 'header',
        content: `
---
layout: $2:none$
title: $1$
---
$3$
        `.trim(),
    },
];
```
