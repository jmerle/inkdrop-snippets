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
    // Example 1: static snippet
    {
        trigger: 'hello',
        content: 'Hello, world!',
    },

    // Example 2: dynamic snippet
    {
        trigger: 'date',
        content: () => format(new Date(), 'dd-MM-yyyy'),
    },

    // Example 3: static snippet with placeholders
    {
        trigger: 'name',
        content: 'My first name is $1:John$ and my last name is $2$',
    },
];
```
