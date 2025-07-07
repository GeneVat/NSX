# NSX Guide

To start run `node ./nsx/nsx.js` or `npm run start` with Node.js installed.

## HTML

- Use `$` to denote HTML tags.
- Example:
  - `$h1 hi` converts to `<h1>hi</h1>`
  - `$h1+class="text" hi` converts to `<h1 class="text">hi</h1>`
- Use `&` to denote a child element.
- Example:
  - `div &h1 'texthere' &h1 'hello'` converts to `<div> <h1>texthere</h1> <h2>hello</h2> </div>`
## CSS

- Use `%` for CSS rules.
- {} aren't used for css.
- Example:
  - `%body font-size:10px;` converts to `body {font-size:10px;}`

## JavaScript

- Use `!` to denote single-line JS statements.
- Example:
  - `!console.log('Hello, World!');` converts to `console.log('Hello, World!');`

### Functions

- Functions are writen with an open and close tag to have multiple lines.
- The open tag is `#!` and the closing tag is `#!e`
- Write `#! name() { console.log('Text') }` with `#!e` on the next line 
  - To output `function name() { console.log('Text') }`

## Comments & Multi lines

- Start line with * to add comment 
- `* This is a comment`

- To have multi-line HTML & CSS use `{}` example Line 1: `$h1 {` Line 2: `Text }` will be processed as `$h1 Text`