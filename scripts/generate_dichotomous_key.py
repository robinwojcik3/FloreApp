import json
import re
import sys
from pathlib import Path


def read_ocr_file(genre: str):
    """Return lines from OCR file for given genus or None if missing."""
    path = Path('data', 'ocr', f'{genre}_ocr.txt')
    if not path.exists():
        print(f'Fichier OCR non trouv\u00e9 : {path}')
        return None
    return path.read_text(encoding='utf8').splitlines()


def parse_lines(lines):
    """Parse OCR lines into a dict of nodes."""
    nodes = []
    pattern = re.compile(r"^\s*(\d+)([\u2019']*)\.?\s*(.*)")
    for line in lines:
        line = line.strip()
        if not line:
            continue
        m = pattern.match(line)
        if not m:
            continue
        base, primes, rest = m.groups()
        node_id = base + primes
        goto = 'END'
        text = rest
        # detect trailing goto number
        g = re.search(r'(\d+[\u2019']*)\s*$', rest)
        if g:
            goto = g.group(1).replace('.', '')
            text = rest[: g.start()].strip()
        nodes.append({'id': node_id, 'texte': text, 'goto': goto, 'parent': None, 'primes': primes})

    id_map = {n['id']: n for n in nodes}
    # set parent for prime alternatives
    for n in nodes:
        if n['primes']:
            base_id = n['id'][:-1]
            if base_id in id_map:
                n['parent'] = base_id
    # set parent based on goto links
    for n in nodes:
        target = n['goto']
        if target != 'END' and target in id_map and id_map[target]['parent'] is None:
            id_map[target]['parent'] = n['id']

    for n in nodes:
        n.pop('primes', None)

    return {n['id']: n for n in nodes}


def save_key(key, genre):
    out_dir = Path('data', 'keys')
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f'{genre}_key.json'
    out_file.write_text(json.dumps(key, ensure_ascii=False, indent=2), encoding='utf8')
    return out_file


def generate_html(key, genre):
    data = json.dumps(key, ensure_ascii=False)
    html = f"""<!doctype html>
<html lang=\"fr\">
<head>
<meta charset=\"utf-8\">
<title>Cl\u00e9 interactive - {genre}</title>
<style>
body{{font-family:sans-serif;padding:1em}}
button{{margin:.5em 0;padding:.5em}}
</style>
</head>
<body>
<h1>Cl\u00e9 pour {genre}</h1>
<div id=\"desc\"></div>
<div id=\"opts\"></div>
<button id=\"back\" style=\"display:none\">Retour</button>
<script>
const key = {data};
let current = Object.keys(key).find(id => !key[id].parent);
const hist = [];
function show(id){{
  const node = key[id];
  document.getElementById('desc').textContent = node.texte;
  const opts = document.getElementById('opts');
  opts.innerHTML = '';
  const children = Object.values(key).filter(n => n.parent === id);
  if(children.length){{
    children.forEach(ch => {{
      const b = document.createElement('button');
      b.textContent = ch.texte;
      b.onclick = () => {{
        hist.push(id);
        if(ch.goto === 'END'){{
          document.getElementById('desc').textContent = ch.texte;
          opts.innerHTML = '';
        }} else {{
          show(ch.goto);
        }}
        updateBack();
      }};
      opts.appendChild(b);
    }});
  }} else if(node.goto && node.goto !== 'END') {{
    hist.push(id);
    show(node.goto);
    updateBack();
  }}
}}
function updateBack(){{
  document.getElementById('back').style.display = hist.length ? 'block' : 'none';
}}
document.getElementById('back').onclick = () => {{
  const prev = hist.pop();
  if(prev){{
    show(prev);
    updateBack();
  }}
}};
show(current);
</script>
</body>
</html>"""
    out_file = Path('data', 'keys', f'{genre}_key.html')
    out_file.write_text(html, encoding='utf8')


def main():
    if len(sys.argv) > 1:
        genre = sys.argv[1]
    else:
        genre = input('Genre botanique : ').strip()
    lines = read_ocr_file(genre)
    if lines is None:
        return
    key = parse_lines(lines)
    json_path = save_key(key, genre)
    generate_html(key, genre)
    print(f'Cl\u00e9 g\u00e9n\u00e9r\u00e9e : {json_path}')


if __name__ == '__main__':
    main()
