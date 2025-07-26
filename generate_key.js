const fs = require('fs');
const path = require('path');

const genus = process.argv[2];
if (!genus) {
  console.error('Usage: node generate_key <genus>');
  process.exit(1);
}

const inputFile = path.join(__dirname, `${genus}_ocr.txt`);
if (!fs.existsSync(inputFile)) {
  console.error(`File not found: ${inputFile}`);
  process.exit(1);
}

const raw = fs.readFileSync(inputFile, 'utf8');
const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
const nodes = [];

for (const line of lines) {
  const m = line.match(/^(\d+[\u2019']*)(.*)$/); // digits and primes
  if (!m) continue;
  let id = m[1].trim().replace(/\u2019/g, "'");
  let text = m[2].trim();
  let goto = 'END';
  const gotoMatch = text.match(/(\d+[\u2019']*)\.?$/);
  if (gotoMatch) {
    goto = gotoMatch[1].replace(/\u2019/g, "'");
    text = text.slice(0, gotoMatch.index).trim().replace(/[\-\u2013\u2014>]+\s*$/, '').trim();
  }
  nodes.push({ id, texte: text, goto, parent: null });
}

const idMap = Object.fromEntries(nodes.map(n => [n.id, n]));
for (const n of nodes) {
  if (n.goto !== 'END' && idMap[n.goto] && !idMap[n.goto].parent) {
    idMap[n.goto].parent = n.id;
  }
}

fs.writeFileSync(`${genus}_key.json`, JSON.stringify(nodes, null, 2), 'utf8');

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Clé du genre ${genus}</title>
<style>
body{font-family:sans-serif;padding:1em;}
ul{list-style:none;padding:0;}
li{margin:0.5em 0;}
button{margin-right:0.5em;}
</style>
</head>
<body>
<h1>Clé du genre ${genus}</h1>
<div id="panel"></div>
<button id="back" disabled>Retour</button>
<script>
fetch('${genus}_key.json').then(r=>r.json()).then(data=>{
  const groups={};
  const idMap={};
  data.forEach(n=>{
    const root=n.id.replace(/[\'\u2019]+/g,'');
    (groups[root]=groups[root]||[]).push(n);
    idMap[n.id]=n;
  });
  let current='1';
  const history=[];
  document.getElementById('back').onclick=()=>{
    if(history.length){current=history.pop();render();}
  };
  function render(){
    const panel=document.getElementById('panel');
    panel.innerHTML='';
    (groups[current]||[]).forEach(n=>{
      const btn=document.createElement('button');
      btn.textContent=n.texte;
      btn.onclick=()=>{
        if(n.goto==='END'){
          alert('FIN : '+n.texte);
        }else{
          history.push(current);
          current=n.goto.replace(/[\'\u2019]+/g,'');
          render();
        }
      };
      panel.appendChild(btn);
    });
    document.getElementById('back').disabled=!history.length;
  }
  render();
});
</script>
</body>
</html>`;

fs.writeFileSync(`key_${genus}.html`, html, 'utf8');
console.log('Fichiers générés:', `${genus}_key.json`, `key_${genus}.html`);
