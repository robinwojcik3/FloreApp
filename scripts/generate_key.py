import os
import json
import re
import sys

def parse_key(genus: str):
    ocr_path = os.path.join('data', 'ocr', f'{genus}_ocr.txt')
    if not os.path.exists(ocr_path):
        print(f"Fichier {ocr_path} introuvable. Veuillez l'ajouter dans data/ocr/.")
        return None

    nodes = []
    previous_id = None
    with open(ocr_path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            match = re.match(r"^(\d+[\'’]*)(?:[.)])?\s*(.*)", line)
            if not match:
                continue
            node_id = match.group(1).replace('.', '')
            texte = match.group(2).strip()
            goto_match = re.search(r"(\d+)$", texte)
            if goto_match:
                goto = goto_match.group(1)
                texte = texte[:goto_match.start()].rstrip(" .…")
            else:
                goto = 'END'
            base = re.match(r"\d+", node_id).group()
            primes = node_id[len(base):]
            parent = base if primes else previous_id
            nodes.append({
                'id': node_id,
                'texte': texte,
                'goto': goto,
                'parent': parent
            })
            previous_id = node_id
    return nodes


def save_json(genus: str, nodes):
    os.makedirs(os.path.join('data', 'keys'), exist_ok=True)
    path = os.path.join('data', 'keys', f'{genus}_key.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(nodes, f, ensure_ascii=False, indent=2)
    print(f"Clé sauvegardée dans {path}")


def generate_html(genus: str):
    html = f"""<!doctype html>
<html lang='fr'>
<meta charset='utf-8'>
<title>Clé {genus}</title>
<div id='key'></div>
<button id='back' style='display:none'>Retour</button>
<script>
const genus = '{genus}';
fetch('data/keys/' + genus + '_key.json').then(r => r.json()).then(data => {
  const nodes = {};
  data.forEach(n => nodes[n.id] = n);
  const children = id => data.filter(n => n.parent === id);
  let history = [];
  let root = data.find(n => !n.parent);
  function display(node) {
    const container = document.getElementById('key');
    container.innerHTML = '';
    children(node.id).forEach(child => {
      const btn = document.createElement('button');
      btn.textContent = child.texte;
      btn.onclick = () => {
        history.push(node);
        if (child.goto === 'END') {
          container.innerHTML = '<p>' + child.texte + '</p>';
        } else if (nodes[child.goto]) {
          display(nodes[child.goto]);
        } else {
          container.innerHTML = '<p>Étape ' + child.goto + ' manquante.</p>';
        }
        document.getElementById('back').style.display = 'block';
      };
      container.appendChild(btn);
      container.appendChild(document.createElement('br'));
    });
  }
  display(root);
  document.getElementById('back').onclick = function() {
    if (history.length) {
      display(history.pop());
      if (!history.length) this.style.display = 'none';
    }
  };
});
</script>
</html>"""
    path = os.path.join('data', 'keys', f'{genus}_key.html')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"Interface sauvegardée dans {path}")


def main():
    genus = sys.argv[1] if len(sys.argv) > 1 else input('Genre ? ').strip().lower()
    nodes = parse_key(genus)
    if nodes is None:
        return
    save_json(genus, nodes)
    generate_html(genus)


if __name__ == '__main__':
    main()
