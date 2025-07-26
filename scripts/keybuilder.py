import json
import re
from pathlib import Path
from typing import Dict, Any


def parse_ocr_text(text: str) -> Dict[str, Dict[str, Any]]:
    """Parse OCR text into a dictionary of nodes."""
    nodes: Dict[str, Dict[str, Any]] = {}
    line_pattern = re.compile(r"^(\d+[’']*)\.?\s*(.*)")
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        match = line_pattern.match(line)
        if not match:
            continue
        node_id = match.group(1).replace("’", "'")
        rest = match.group(2).strip()
        goto = "END"
        gt_match = re.search(r"(?:->|→|\s)(\d+[’']*)\.?$", rest)
        if gt_match:
            goto = gt_match.group(1).replace("’", "'")
            rest = rest[:gt_match.start()].strip()
        nodes[node_id] = {"id": node_id, "texte": rest, "goto": goto, "parent": None}

    # Assign parents based on goto relations
    for node in nodes.values():
        target = node["goto"]
        if target != "END" and target in nodes and nodes[target]["parent"] is None:
            nodes[target]["parent"] = node["id"]
    return nodes


def parse_ocr_file(path: Path) -> Dict[str, Dict[str, Any]]:
    return parse_ocr_text(path.read_text(encoding="utf-8"))


def save_key(genre: str, nodes: Dict[str, Dict[str, Any]], outdir: Path) -> Path:
    outdir.mkdir(parents=True, exist_ok=True)
    out_file = outdir / f"{genre}_key.json"
    with out_file.open("w", encoding="utf-8") as f:
        json.dump(nodes, f, ensure_ascii=False, indent=2)
    return out_file


def generate_html(genre: str, nodes: Dict[str, Dict[str, Any]], outdir: Path) -> Path:
    outdir.mkdir(parents=True, exist_ok=True)
    html_file = outdir / f"{genre}_viewer.html"
    data_json = json.dumps(nodes, ensure_ascii=False)
    html_content = f"""<!DOCTYPE html>
<html lang='fr'>
<meta charset='UTF-8'>
<title>Clé {genre}</title>
<style>
body {{ font-family: sans-serif; padding: 1em; }}
.choice {{ margin: 0.5em 0; cursor: pointer; color: blue; }}
button {{ margin-top: 1em; }}
</style>
<body>
<h1>Clé dichotomique : {genre}</h1>
<div id='texte'></div>
<div id='choix'></div>
<button id='back' style='display:none'>Retour</button>
<script>
const key = {data_json};
let history = [];
function base(id) {{ return id.replace(/['’]/g, ''); }}
function render(step) {{
  const entries = Object.values(key).filter(n => base(n.id) === step);
  const texte = document.getElementById('texte');
  const choix = document.getElementById('choix');
  texte.textContent = 'Étape ' + step;
  choix.innerHTML = '';
  entries.forEach(n => {{
    const div = document.createElement('div');
    div.className = 'choice';
    div.textContent = n.texte;
    div.onclick = () => {{
      if (n.goto === 'END') {{
        texte.textContent = 'Fin de la clé';
        choix.innerHTML = '';
      }} else {{
        history.push(step);
        document.getElementById('back').style.display = 'inline';
        render(base(n.goto));
      }}
    }};
    choix.appendChild(div);
  }});
}}
document.getElementById('back').onclick = () => {{
  const prev = history.pop();
  if (prev) {{
    render(prev);
  }}
  if (history.length === 0) document.getElementById('back').style.display = 'none';
}};
const start = Object.keys(key).map(k => parseInt(base(k))).sort()[0].toString();
render(start);
</script>
</body>
</html>"""
    html_file.write_text(html_content, encoding="utf-8")
    return html_file
