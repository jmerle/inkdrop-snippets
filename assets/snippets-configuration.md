```js
/*
This note is a configuration note for the Snippets plugin.
Moving the note to trash causes this note to be unregistered as a snippets configuration.
Moving the note to a different notebook or renaming it will not cause problems.
Saving the note will reload the snippets.

Snippets are configured as JavaScript objects in the array below.
Each snippet object should contain a "trigger" and a "content" member.

trigger: string
The trigger should be the text that should activate the snippet.
When the trigger is typed and the activation key is pressed (default: Tab),
the snippet is executed and the trigger is replaced by the snippet's content.

When there are multiple snippets with the same trigger, the last registered one will be used.
Snippet configuration notes are read in the order of the note ids in the plugin's settings.
Snippets in configuration notes are registered from top to bottom.

content: string | () => any | () => Promise<any>
The content with which the trigger should be replaced with.
If it is a JavaScript function, it is called with the current selection and the return value is used as content.
If a Promise is returned, the plugin waits for the promise to resolve.

The content may contain tokens like $1$ and $2$ to define placeholders.
Placeholders can contain default values by defining them like `$1:Default value comes here$`.
When the snippet is triggered, the cursor will move to the first placeholder.
Placeholders can be jumped between using Tab and Shift+Tab by default.
If no placeholders are defined, the cursor will move to the end of the content when the snippet is executed.

To make working with dates easier, all functions in the date-fns library are available.
date-fns documentation: https://date-fns.org/docs/Getting-Started
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
