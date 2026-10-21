import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check if file calls getState(
    if 'getState(' not in content:
        return False

    # Check if getState is already imported or defined
    if re.search(r'import\s+{[^}]*\bgetState\b[^}]*}\s+from', content) or re.search(r'\b(const|let|var|function)\s+getState\b', content):
        return False

    # Determine relative path to coreState.js based on directory depth from src/
    rel_path = os.path.relpath(filepath, 'src')
    parts = rel_path.split(os.sep)
    depth = len(parts) - 1 # e.g. src/views/Foo.js -> parts=['views', 'Foo.js'], depth=1

    if depth <= 1:
        import_stmt = "import { getState } from '../store/coreState.js';\n"
    elif depth == 2:
        import_stmt = "import { getState } from '../../store/coreState.js';\n"
    else:
        import_stmt = "import { getState } from '../../../store/coreState.js';\n"

    # Prepend import statement at the top of the file (after license comment if present)
    lines = content.splitlines(keepends=True)
    insert_idx = 0
    # Skip leading comment block if any
    if lines and lines[0].startswith('/**'):
        for i, line in enumerate(lines):
            if '*/' in line:
                insert_idx = i + 1
                break

    lines.insert(insert_idx, import_stmt)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    
    print(f"Injected getState import into {filepath} (depth {depth})")
    return True

def main():
    count = 0
    for root, dirs, files in os.walk('src'):
        for file in files:
            if file.endswith('.js'):
                filepath = os.path.join(root, file)
                if process_file(filepath):
                    count += 1
    print(f"Total files updated: {count}")

if __name__ == '__main__':
    main()
