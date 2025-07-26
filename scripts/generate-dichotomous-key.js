const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) {
  console.error('Usage: node scripts/generate-dichotomous-key.js <Genre>');
  process.exit(1);
}

const genre = process.argv[2];
const inputFile = path.join(__dirname, '..', `${genre}_ocr.txt`);
if (!fs.existsSync(inputFile)) {
  console.error(`File not found: ${inputFile}`);
  process.exit(1);
}

const text = fs.readFileSync(inputFile, 'utf8');
const lines = text.split(/\r?\n/).filter(l => /^\s*\d+/.test(l));

const nodes = [];
const gotoMap = {};

for (const rawLine of lines) {
  const m = rawLine.match(/^\s*(\d+(?:['’]*))\.?\s*(.*)$/);
  if (!m) continue;
  const id = m[1];
  let body = m[2].trim();
  let goto = 'END';
  const tail = body.match(/((?:\d+(?:['’]*)|END))\s*$/i);
  if (tail) {
    goto = tail[1].toUpperCase();
    body = body.slice(0, tail.index).trim().replace(/[;:,.-]+$/, '').trim();
  }
  const parent = gotoMap[id] || null;
  nodes.push({ id, texte: body, goto, parent });
  if (goto !== 'END' && !(goto in gotoMap)) {
    gotoMap[goto] = id;
  }
}

fs.writeFileSync(`${genre}_key.json`, JSON.stringify(nodes, null, 2));

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Clé ${genre}</title>
<style>
body{font-family:sans-serif;margin:0;padding:1em;background:#f5f5f5;}
ul{list-style:none;padding-left:1em;}
li{margin:0.2em 0;}
button{cursor:pointer;background:none;border:none;color:#0645ad;text-decoration:underline;padding:0;font:inherit;}
</style>
</head>
<body>
<h1>Clé ${genre}</h1>
<div id="key"></div>
<script>
const data = ${JSON.stringify(nodes)};
const container = document.getElementById('key');
const startId = data.length ? data[0].id : null;
let stack = startId ? [startId] : [];
function render(){
  if(!stack.length){container.textContent='Aucune donnée';return;}
  const current = stack[stack.length-1];
  const children = data.filter(n=>n.parent===current);
  container.innerHTML='';
  if(children.length===0){
    const node = data.find(n=>n.id===current);
    if(node && node.goto!=='END'){
      stack.push(node.goto);
      render();
      return;
    }
    container.textContent='Fin de la clé';
  }else{
    const list=document.createElement('ul');
    children.forEach(ch=>{
      const li=document.createElement('li');
      const btn=document.createElement('button');
      btn.textContent=ch.id+'. '+ch.texte;
      btn.onclick=()=>{stack.push(ch.goto);render();};
      li.appendChild(btn);
      list.appendChild(li);
    });
    container.appendChild(list);
  }
  if(stack.length>1){
    const back=document.createElement('button');
    back.textContent='Retour';
    back.onclick=()=>{stack.pop();render();};
    container.appendChild(back);
  }
}
render();
</script>
</body>
</html>`;

fs.writeFileSync(`${genre}_key.html`, html);
console.log('Generated', `${genre}_key.json`, 'and', `${genre}_key.html`);
