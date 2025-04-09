# NSX Guide

To start, run `npm run start` with Node.js installed.

## HTML Syntax

- Use `$` to denote HTML tags.
    - Example: `$h1 hi` converts to `<h1>hi</h1>`
    - Example: `$h1+class="text" hi` converts to `<h1 class="text">hi</h1>`
  
- Use `&` to denote child elements.
    - Example: `div &h1 'texthere' &h1 'hello'` converts to:
    ```html
    <div>
      <h1>texthere</h1>
      <h1>hello</h1>
    </div>
    ```

### Reusable HTML

- Use `!usable-add` to define a reusable HTML block.
    - Example: `!usable-add hi $h1 Hello` creates a reusable block called `hi` with the HTML Code `$h1 Hello`.
  
- Use `!usable-use` to include a reusable HTML block.
    - Example: `!usable-use hi` will insert the `hi` block.

---

## CSS Syntax

- Use `%` for CSS rules (no braces `{}` or semicolons `;` needed).
    - Example: `%body font-size:10px` converts to:
    ```css
    body {
        font-size: 10px;
    }
    ```

---

## JavaScript Syntax

- Use `!` for JavaScript statements.
    - Example: `!console.log('Hello, World!')` becomes `console.log('Hello, World!')`.

## Comments & Multi-line Syntax

- Start a line with `*` to add a comment.
    - Example: `* This is a comment` becomes a comment in the output.
  
- To write multi-line  use `{}`:
    - Example for HTML:
      ```html
      $h1 {
        Text
      }
      ```
    - This will be processed as: 
      ```html
      <h1>Text</h1>
      ```

--- 
