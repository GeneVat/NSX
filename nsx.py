import os
import time

def convert_nsx():
    nsx_file = os.path.join(os.path.dirname(__file__), 'main.nsx')
    if not os.path.exists(nsx_file):
        print("main.nsx not found.")
        return

    with open(nsx_file, 'r') as f:
        nsx_content = f.read()
    
    html_content = ""
    css_content = ""
    js_content = ""
    inside_js_block = False
    # New: Lists to store extra imports from #create
    extra_css_imports = []
    extra_js_imports = []
    
    for line in nsx_content.splitlines():
        stripped = line.lstrip()
        # Handle multi-line JS block
        if inside_js_block:
            if stripped.startswith("#js"):
                inside_js_block = False
            else:
                js_content += line + "\n"
            continue
        if stripped == "#":
            inside_js_block = True
            continue
        # Handle #import directive
        elif stripped.startswith("#import"):
            parts = stripped.split("'")
            if len(parts) >= 2:
                import_file = parts[1]
                import_path = os.path.join(os.path.dirname(nsx_file), import_file)
                if os.path.exists(import_path):
                    with open(import_path, 'r') as imp_f:
                        imp_content = imp_f.read()
                    if import_file.endswith(".js"):
                        js_content += imp_content + "\n"
                    elif import_file.endswith(".css"):
                        css_content += imp_content + "\n"
            continue
        # New: Handle #create directive to copy files to output
        elif stripped.startswith("#create"):
            parts = stripped.split("'")
            if len(parts) >= 2:
                new_filename = parts[1]
                source_path = os.path.join(os.path.dirname(nsx_file), new_filename)
                target_path = os.path.join(os.path.dirname(nsx_file), "output", new_filename)
                if os.path.exists(source_path):
                    with open(source_path, "r") as src_f:
                        content = src_f.read()
                    with open(target_path, "w") as tgt_f:
                        tgt_f.write(content)
                    # If file is CSS or JS, add to extra imports
                    if new_filename.lower().endswith(".js"):
                        extra_js_imports.append(new_filename)
                    elif new_filename.lower().endswith(".css"):
                        extra_css_imports.append(new_filename)
            continue
        if stripped.startswith("$"):
            # Expected format: "$tag[+attr="value" ...] [content]"
            raw = stripped[1:].lstrip()
            parts = raw.split(" ", 1)
            first_part = parts[0]
            content = parts[1] if len(parts) > 1 else ""
            parts2 = first_part.split("+")
            tag = parts2[0]
            attributes = ""
            for attr in parts2[1:]:
                if "=" in attr:
                    key, value = attr.split("=", 1)
                    # Remove surrounding quotes if any and replace '+' with space in value
                    if value.startswith("\"") and value.endswith("\""):
                        value = value[1:-1]
                    value = value.replace("+", " ")
                    attributes += f' {key}="{value}"'
                else:
                    attributes += f' {attr}=""'
            opening = f"<{tag}{attributes}>"
            closing = f"</{tag}>"
            html_content += f"{opening}{content}{closing}\n"
        elif stripped.startswith("%"):
            css_content += stripped[1:].lstrip() + "\n"
        elif stripped.startswith("!"):
            js_content += stripped[1:].lstrip() + "\n"
        # Optionally ignore lines without known marker

    # Clear output folder before writing new files
    output_dir = os.path.join(os.path.dirname(nsx_file), "output")
    if os.path.exists(output_dir):
        for filename in os.listdir(output_dir):
            os.remove(os.path.join(output_dir, filename))
    else:
        os.makedirs(output_dir)

    # New: Build head with default and extra imports
    head = '<script src="script.js"></script><link rel="stylesheet" href="style.css">'
    for js_file in extra_js_imports:
        head += f'<script src="{js_file}"></script>'
    for css_file in extra_css_imports:
        head += f'<link rel="stylesheet" href="{css_file}">'
    
    # Wrap html_content in a full HTML document that auto imports css and js
    full_html = f"""{head}
{html_content}
"""
    with open(os.path.join(output_dir, "index.html"), 'w') as f:
        f.write(full_html)
    with open(os.path.join(output_dir, "style.css"), 'w') as f:
        f.write(css_content)
    with open(os.path.join(output_dir, "script.js"), 'w') as f:
        f.write(js_content)
    

if __name__ == "__main__":
    import sys, select
    nsx_file = os.path.join(os.path.dirname(__file__), 'main.nsx')
    try:
        last_mtime = os.path.getmtime(nsx_file)
    except Exception:
        last_mtime = None

    print("NSX started. Press 'q' then Enter to quit.")
    while True:
        try:
            current_mtime = os.path.getmtime(nsx_file)
        except Exception:
            current_mtime = None

        if current_mtime != last_mtime:
            convert_nsx()
            last_mtime = current_mtime

        i, _, _ = select.select([sys.stdin], [], [], 1)
        if i:
            if sys.stdin.readline().strip().lower() == 'q':
                break
