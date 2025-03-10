import re
import os
import shutil

# Define the mapping of NSX tags to HTML tags
tag_map = {
    '$html': 'html',
    '$head': 'head',
    '$title': 'title',
    '$body': 'body',
    '$section': 'section',
    '$style': 'style',
    '$nav': 'nav',
    '$h1': 'h1',
    '$h2': 'h2',
    '$h3': 'h3',
    '$p': 'p',
    '$br': 'br',
    '$strong': 'strong',
    '$em': 'em',
    '$b': 'b',
    '$i': 'i',
    '$u': 'u',
    '$a': 'a',
    '$img': 'img',
    '$div': 'div',
    '$span': 'span',
    '$pre': 'pre',
    '$code': 'code',
    '$blockquote': 'blockquote',
    '$ol': 'ol',
    '$ul': 'ul',
    '$li': 'li',
    '$table': 'table',
    '$tr': 'tr',
    '$th': 'th',
    '$td': 'td',
    '$form': 'form',
    '$input': 'input',
    '$button': 'button',
    '$select': 'select',
    '$option': 'option',
    '$textarea': 'textarea',
    '$label': 'label',
    '$fieldset': 'fieldset',
    '$legend': 'legend',
    '$script': 'script',
}

# Function to preprocess NSX lines by removing spaces inside quotes
def remove_spaces_inside_quotes(nsx_lines):
    preprocessed_lines = []
    for line in nsx_lines:
        # Remove spaces inside quotes
        line = re.sub(r'="([^"]*?)"', lambda m: '="' + m.group(1).replace(' ', '') + '"', line)
        preprocessed_lines.append(line)
    return preprocessed_lines

# Function to treat all lines as one, breaking on '&' for new line
def merge_lines(nsx_lines):
    # Join all lines into one big line
    joined_lines = ' '.join([line.strip() for line in nsx_lines])

    # Replace '&' with a special marker for new lines
    return joined_lines.replace('&', ' &')

# Function to process NSX input and convert it to HTML
def convert_nsx_to_html(nsx_lines):
    output = []
    custom_tags = {}  # Added custom tag mapping dictionary

    # Preprocess lines to remove spaces inside quotes
    nsx_lines = remove_spaces_inside_quotes(nsx_lines)
    
    # Merge lines into a single line and treat '&' as a new line marker
    nsx_lines = merge_lines(nsx_lines)

    # Split the lines based on the special marker '&'
    nsx_lines_split = nsx_lines.split(' &')

    for line in nsx_lines_split:
        line = line.strip()

        # Ignore lines containing only curly braces (e.g., {text})
        if re.match(r'^\{[^}]*\}$', line):
            continue

        result = []
        tag_stack = []

        # Split the line into words to process individually
        words = line.split()
        i = 0
        while i < len(words):
            word = words[i]
            if word.startswith('!'):
                # Custom tag definition: next token is the definition
                if i + 1 < len(words):
                    alias = '$' + word[1:]
                    definition = words[i + 1]
                    custom_tags[alias] = definition
                    # Skip these tokens from output
                    i += 2
                    continue
                i += 1
                continue
            elif word.startswith('$'):
                token = word
                if '+' in token:
                    base_end = token.find('+')
                    base_tag = token[:base_end]
                    attributes = token[base_end+1:].replace('+', ' ')
                    # Check custom_tags if base_tag is not in tag_map
                    if base_tag not in tag_map and base_tag in custom_tags:
                        token = custom_tags[base_tag]
                    else:
                        if base_tag in tag_map:
                            tag_name = tag_map[base_tag]
                            open_tag = f"<{tag_name} {attributes}>"
                            close_tag = f"</{tag_name}>"
                            result.append(open_tag)
                            tag_stack.append(close_tag)
                            i += 1
                            continue
                else:
                    if token not in tag_map and token in custom_tags:
                        token = custom_tags[token]
                match = re.match(r'(\$\w+)(=(.*))?', token)
                if match:
                    base_tag = match.group(1)
                    param = match.group(3)
                    if base_tag in tag_map:
                        tag_name = tag_map[base_tag]
                    else:
                        # Assume custom definition in the form "$tag=..."
                        tag_name = token.split('=')[0][1:]
                    if param:
                        open_tag = f"<{tag_name} {param}>"
                    else:
                        open_tag = f"<{tag_name}>"
                    close_tag = f"</{tag_name}>"
                    result.append(open_tag)
                    tag_stack.append(close_tag)
                i += 1
                continue
            elif word.startswith('@'):
                # Process JS code block: output newlines around the <script> block for each @ token.
                js_code = word[1:]
                result.append(f"\n{js_code}")
            elif word.startswith('%'):
                if '+' in word:
                    tag_name = word[1:].replace('+', ' ')
                    close_tag = f"</{tag_name}>"
                    result.append(close_tag)
                else:
                    close_tag = f"</{word[1:]}>"  # Standard close tag

                    # Force close the current tag stack by popping
                    while tag_stack and tag_stack[-1] != close_tag:
                        result.append(tag_stack.pop())
                    
                    # Now append the closing tag
                    if tag_stack and tag_stack[-1] == close_tag:
                        result.append(tag_stack.pop())  # Remove the closing tag
                    else:
                        result.append(close_tag)
            else:
                result.append(word)
            i += 1

        # Add any remaining close tags from the stack
        while tag_stack:
            result.append(tag_stack.pop())

        output.append(' '.join(result))

    return '\n'.join(output)

# Function to read NSX file and compile it to HTML
def compile_nsx_to_html(input_file, output_file):
    try:
        # Read the NSX input file
        with open(input_file, 'r') as infile:
            nsx_lines = infile.readlines()

        # Process the content and convert to HTML
        compiled_html = convert_nsx_to_html(nsx_lines)

        # Save the processed HTML content to output file
        with open(output_file, 'w') as outfile:
            outfile.write(compiled_html)

        print(f"Compilation complete! The HTML output has been saved to {output_file}")
    
    except FileNotFoundError:
        print(f"Error: The file {input_file} was not found.")
    except Exception as e:
        print(f"Error: {e}")

# Main function to run the script
if __name__ == "__main__":
    input_dir = '../'
    output_dir = 'dist/'

    # Delete all files in the output directory
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
    os.makedirs(output_dir)

    for root, dirs, files in os.walk(input_dir):
        # Skip the src directory
        if 'src' in root:
            continue
        for filename in files:
            if filename.endswith('.nsx'):
                input_file = os.path.join(root, filename)
                relative_path = os.path.relpath(root, input_dir)
                output_subdir = os.path.join(output_dir, relative_path)
                if not os.path.exists(output_subdir):
                    os.makedirs(output_subdir)
                output_file = os.path.join(output_subdir, f"{os.path.splitext(filename)[0]}.html")
                compile_nsx_to_html(input_file, output_file)