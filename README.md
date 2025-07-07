# NSX

Run `npm run start` with Node Installed

## Block Types

- `$ ...` : HTML block
- `% ...` : CSS block
- `! ...` : JavaScript block

Blocks can be single-line or multi-line (indented).

## Example

```
$h1 Hello World!
%h1 color: red;
!console.log("Hello from JS!");
```

## Multi-line Blocks

Indent lines under a block prefix:

```
$div
  &h2 Welcome
  &p This is a paragraph.
```
Childern in HTML are with `&`; Example: `$div &div &&h1 Text` -> `<div><div><h1> Text </h1></div></div>
## Components

Define reusable HTML snippets:

```
!add Button $button[class={pass.class}] {pass.text}
!use Button[class="primary" text="Click Me"]
```
## Shorthand CSS Rules

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

## Special Escape Codes

- In HTML:
  - `#d;` → `$`
  - `#a;` → `&`
- In CSS:
  - `#p;` → `%`
- In JS:
  - `#e;` → `!`

---

## Usage

Run the NSX with

```sh
npm run start
```

### Commands

- `r` or `recompile` : Recompile files
- `c` or `clear`     : Clear the console
- `l` or `list`      : List output files and open output directory
- `v` or `version`   : Show NSX version
- `h` or `help`      : Show help menu
- `q` or `exit`      : Quit