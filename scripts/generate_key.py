import os
import re
import json
import sys


def parse_lines(lines):
    nodes = []
    last_main = None
    prev_main = None
    for line in lines:
        line = line.strip()
        if not line:
            continue
        m = re.match(r"^(\d+(?:'+)?)(?:\.|\))?\s*(.+)", line)
        if not m:
            continue
        node_id = m.group(1).replace('′', "'")
        text = m.group(2).strip()
        goto = 'END'
        gmatch = re.search(r"(.*?)(\d+(?:'+)?)\s*$", text)
        if gmatch:
            text = gmatch.group(1).rstrip(" .;-")
            goto = gmatch.group(2).replace('′', "'")
        if "'" in node_id:
            parent = last_main
        else:
            parent = prev_main
            prev_main = node_id
            last_main = node_id
        nodes.append({
            'id': node_id,
            'texte': text,
            'goto': goto,
            'parent': parent
        })
    return nodes


def build_key(genus: str):
    input_path = os.path.join('data', 'ocr', f'{genus}_ocr.txt')
    output_path = os.path.join('data', 'keys', f'{genus}_key.json')

    if not os.path.exists(input_path):
        print(f'Fichier non trouvé : {input_path}')
        return

    with open(input_path, encoding='utf-8') as f:
        lines = f.readlines()

    nodes = parse_lines(lines)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(nodes, f, ensure_ascii=False, indent=2)
    print(f'Clé enregistrée dans {output_path}')


if __name__ == '__main__':
    genus = sys.argv[1] if len(sys.argv) > 1 else input('Genre : ').strip().lower()
    build_key(genus)
