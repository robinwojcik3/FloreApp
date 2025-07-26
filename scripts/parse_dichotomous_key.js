const fs = require('fs');

function parseFile(genus) {
  const file = `${genus}_ocr.txt`;
  if (!fs.existsSync(file)) {
    throw new Error(`File not found: ${file}`);
  }
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  const nodes = [];
  const idSet = new Set();
  for (const line of lines) {
    const m = line.match(/^\s*(\d+[\u2032\u2033\u2034\u00B4']*)(?:[.)-]*)\s*(.+)$/);
    if (!m) continue;
    let id = m[1];
    let rest = m[2].trim();
    let goto = 'END';
    let text = rest;
    const gm = rest.match(/^(.*?)(?:\s{3,}|\.{3,}|[-–—])\s*(\d+[\u2032\u2033\u2034\u00B4']*)\s*$/);
    if (gm) {
      text = gm[1].trim();
      goto = gm[2];
    }
    nodes.push({ id, texte: text, goto });
    idSet.add(id);
  }
  const parentMap = {};
  for (const n of nodes) {
    if (n.goto !== 'END') {
      parentMap[n.goto] = n.id;
    }
  }
  for (const n of nodes) {
    n.parent = parentMap[n.id] || null;
  }
  return nodes;
}

function generateHtml(genus, data) {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Clé dichotomique: ${genus}</title>
<style>
body{font-family:Arial, sans-serif;margin:1em;}
button{display:block;margin:0.3em 0;padding:0.2em 0.5em;}
#path{margin-bottom:1em;font-style:italic;color:#555;}
</style>
</head>
<body>
<h1>Clé dichotomique: ${genus}</h1>
<div id="path"></div>
<div id="key"></div>
<script>
const data = ${JSON.stringify(data)};
const groups = {};
function base(id){return String(id).match(/^(\d+)/)[1];}
data.forEach(n=>{const b=base(n.id);(groups[b]||(groups[b]=[])).push(n);});
const container=document.getElementById('key');
const pathDiv=document.getElementById('path');
const stack=[base(data[0].id)];
const labels=[];
function render(b){
  container.innerHTML='';
  const nodes=groups[b]||[];
  nodes.forEach(n=>{
    const btn=document.createElement('button');
    btn.textContent=n.id+' '+n.texte;
    btn.onclick=()=>{labels.push(n.id);if(n.goto==='END'){alert('FIN : '+n.texte);}else{stack.push(base(n.goto));render(base(n.goto));}};
    container.appendChild(btn);
  });
  pathDiv.textContent=labels.join(' \u2192 ');
  if(stack.length>1){
    const back=document.createElement('button');
    back.textContent='Retour';
    back.onclick=()=>{stack.pop();labels.pop();render(stack[stack.length-1]);};
    container.appendChild(back);
  }
}
render(stack[0]);
</script>
</body>
</html>`;
  return html;
}

function main(){
  const genus = process.argv[2];
  if(!genus){
    console.error('Usage: node scripts/parse_dichotomous_key.js <Genus>');
    process.exit(1);
  }
  try {
    const data = parseFile(genus);
    fs.writeFileSync(`${genus}_key.json`, JSON.stringify(data, null, 2));
    fs.writeFileSync(`${genus}_key.html`, generateHtml(genus, data));
    console.log('Generated', `${genus}_key.json`, 'and', `${genus}_key.html`);
  } catch(err){
    console.error(err.message);
    process.exit(1);
  }
}

if(require.main===module){
  main();
}

module.exports = { parseFile, generateHtml };
