# NSX Guide

## HTML

- Use `$` to denote HTML tags.
- Example:
  - `$h1 hi` converts to `<h1>hi</h1>`
  - `$h1+class="text" hi` converts to `<h1 class="text">hi</h1>`

## CSS

- Use `%` for CSS rules.
- {} aren't used for css 
- Example:
 `%body font-size:10px;` converts to `body {font-size:10px;}`

## JavaScript

- Use `!` to denote single-line JS statements.
- Example: `!console.log('Hello, World!');` converts to `console.log('Hello, World!');`

### Functions

- Functions are writen with an open and close tag to have multiple lines.
- The open tag is `#fn` and the closing tag is `#efn`
- Write `#fn name() { console.log('Text') }` with `#efn` on the next line 
  - To output `function name() { console.log('Text') }`
