# NSX Guide

To start, run `npm run start` with Node.js installed.

## HTML Syntax

- Use `$` to denote HTML tags.
    - Example: `$h1 hi` converts to `<h1>hi</h1>`
    - Example: `$h1(class="text") hi` converts to `<h1 class="text">hi</h1>`
    - You can use parentheses for attributes: `$a(href="https://example.com" class="link") click here`
    - Use `+` inside attribute values for spaces: `$h1(class="big+red") hi` → `<h1 class="big red">hi</h1>`

- Use `&` to denote child elements (outside of parentheses).
    - Example: `$div &h1 texthere &h1 hello` converts to:
    ```html
    <div>
      <h1>texthere</h1>
      <h1>hello</h1>
    </div>
    ```

### Components (Reusable HTML)

- Use `!add` to define a reusable HTML block (component).
    - Example: `!add hi $h1 Hello` creates a component called `hi` with the HTML `$h1 Hello`.
    - You can use `{pass.key}` in your component HTML to inject arguments.

- Use `!use` to include a component, optionally passing arguments.
    - Example: `!use hi` will insert the `hi` component.
    - Example: `!use hi(title="Welcome" text="Hello")` will inject arguments into `{pass.title}` and `{pass.text}` in the component.

---

## CSS Syntax

- Use `%` for CSS rules (no braces `{}` needed).
    - Example: `%body = font-size:10px; color:red;` converts to:
    ```css
    body { font-size:10px; color:red; }
    ```

### Shorthand CSS Rules

- To enable shorthand CSS syntax, add `#C2` anywhere in your `main.nsx` file.
- Shorthand format examples:
    - `text-align-center` → `text-align: center;`
    - `color-red` → `color: red;`
    - `size-20px` → `font-size: 20px;`
    - `weight-bold` → `font-weight: bold;`
    - `gap-10` → `gap: 10px;`
    - `border-5` → `border-radius: 5px;`
    - `width-100%` → `width: 100%;`
    - `height-50px` → `height: 50px;`
- This works inside any CSS rule block:
    ```
    %body
      text-align-center
      color-red
      size-20px
    ```
    Converts to:
    ```css
    body { text-align: center; color: red; font-size: 20px; }
    ```

---

## JavaScript Syntax

- Use `!` for JavaScript statements.
    - Example: `!console.log('Hello, World!')` becomes `console.log('Hello, World!')`.

---

## Comments & Multi-line Syntax

- Start a line with `*` to add a comment (ignored).
    - Example: `* This is a comment`

- To write multi-line blocks, indent lines after the initial line:
    - Example for HTML:
      ```
      $h1
        This is a multi-line
        heading!
      ```
      Converts to:
      ```html
      <h1>This is a multi-line
      heading!</h1>
      ```

    - Example for CSS:
      ```
      %body
        font-size: 20px;
        color: blue;
      ```
      Converts to:
      ```css
      body { font-size: 20px; color: blue; }
      ```

---

## File Watching & Commands

- The compiler watches `main.nsx` for changes and recompiles automatically.
- Console commands:
    - `r` - Recompile manually
    - `c` - Clear console
    - `q` - Quit
    - `h` - Show help
    - `l` - List output files and open output directory

---