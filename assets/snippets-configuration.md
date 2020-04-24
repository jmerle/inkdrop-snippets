```js
// This note is a snippets configuration for the Snippets plugin.
// Moving the note to trash causes all the snippets below to be deactivated.
// Moving the note to a different notebook or renaming it will not cause problems.

// Snippets are configured as JavaScript objects in the array below.
// Each snippet object should contain a "trigger" and a "content" member.

// trigger
// The trigger should be a string containing the text that should trigger the snippet.
// When the trigger is typed and the activation key is pressed (default: Tab),
// the snippet is executed and the trigger text is replaced by the snippet's content.

// content
// The content of the snippet with which the trigger should be replaced with when it is ran.
// This can either be a string or a JavaScript function.
// If it is a JavaScript function, its return value is used.
// If a Promise is returned, the plugin waits for the promise to resolve.

[
    // Example 1: static snippet which prints "Snippets" upon activation
    {
        trigger: 'name',
        content: 'Snippets',
    },

    // Example 2: dynamic snippet which prints the current timestamp upon activation
    {
        trigger: 'timestamp',
        content: () => new Date().toISOString(),
    },
];
```
