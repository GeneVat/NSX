# NSX Guide

To use # and #js like v0.4.0 have `#0.4.0` as a line.

## HTML

- Use `$` to denote HTML tags.
- Example:
  - `$h1 hi` converts to `<h1>hi</h1>`
  - `$h1+class="text" hi` converts to `<h1 class="text">hi</h1>`

## CSS

- Use `%` for CSS rules.
- Example:
  - `%body { background-color: #f0f0f0; }` converts to `body { background-color: #f0f0f0; }`

## JavaScript

- Use `!` to denote single-line JS statements.
  - Example: `!console.log('Hello, World!');` converts to `console.log('Hello, World!');`

### Multi-line JavaScript

Enclose multi-line JS blocks between ```#jss and #jse``` markers:
``#jss
console.log('This is a multi-line JS block.');
console.log('It will be added to script.js');
#jse``
converts to:
console.log('This is a multi-line JS block.');
console.log('It will be added to script.js');

## Create and Import

- `#import 'external.js'` imports an external JavaScript file.
- `#create 'newfile.js'` creates and imports a new JavaScript file.
