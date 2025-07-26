import os
import sys
import json
import argparse
import re


def normalize_id(raw_id: str) -> str:
    """Return a cleaned identifier with unified apostrophes."""
    cleaned = raw_id.strip().rstrip('.')
    cleaned = cleaned.replace('’', "'")
    cleaned = cleaned.replace(' ', '')
    return cleaned


def parse_line(line: str):
    """Parse a single OCR line and return (id, text, goto, level) or None."""
    m = re.match(r"^(\d+[’']*\.?)(.*)", line.strip())
    if not m:
        return None
    raw_id, rest = m.groups()
    node_id = normalize_id(raw_id)
    level = node_id.count("'")

    rest = rest.strip()
    goto = 'END'
    text = rest

    # look for an explicit arrow or trailing number indicating the next step
    m2 = re.search(r"(->|→|—|–|-)\s*(\d+[’']*)\.?$", rest)
    if m2:
        goto = normalize_id(m2.group(2))
        text = rest[:m2.start()].strip(' .;,-')
    else:
        m3 = re.search(r"\s(\d+[’']*)\.?$", rest)
        if m3:
            goto = normalize_id(m3.group(1))
            text = rest[:m3.start()].strip(' .;,-')

    return node_id, text.strip(), goto, level


def build_key(lines):
    nodes = {}
    stack = []
    for line in lines:
        parsed = parse_line(line)
        if not parsed:
            continue
        node_id, text, goto, level = parsed
        while len(stack) > level:
            stack.pop()
        parent = stack[-1] if stack else None
        nodes[node_id] = {
            'id': node_id,
            'texte': text,
            'goto': goto,
            'parent': parent
        }
        if len(stack) > level:
            stack[level] = node_id
        elif len(stack) == level:
            stack.append(node_id)
        else:
            # should not happen, but ensure stack size
            while len(stack) < level:
                stack.append(None)
            stack.append(node_id)
    return nodes


def process_file(input_path):
    with open(input_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    return build_key(lines)


def main():
    parser = argparse.ArgumentParser(description='Construit une clé dichotomique depuis un OCR de Flora Gallica')
    parser.add_argument('genre', nargs='?', help='Nom du genre à traiter')
    args = parser.parse_args()

    genre = args.genre or input('Genre : ').strip()
    input_file = os.path.join('data', 'ocr', f'{genre.lower()}_ocr.txt')
    output_file = os.path.join('data', 'keys', f'{genre.lower()}_key.json')

    if not os.path.exists(input_file):
        print(f"Fichier {input_file} introuvable. Veuillez le placer dans data/ocr/.")
        return

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    nodes = process_file(input_file)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(nodes, f, ensure_ascii=False, indent=2)
    print(f'Clé sauvegardée dans {output_file}')


if __name__ == '__main__':
    main()
