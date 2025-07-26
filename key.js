(async function(){
  const params = new URLSearchParams(location.search);
  const genre = params.get('genre');
  const file = genre ? `data/keys/${genre.toLowerCase()}_key.json` : null;
  const pathDiv = document.getElementById('path');
  const choicesDiv = document.getElementById('choices');
  const backBtn = document.getElementById('back');
  let nodes = null;
  let stack = [];
  if(!file){
    choicesDiv.textContent = 'Aucun genre fourni (paramètre ?genre=).';
    backBtn.style.display = 'none';
    return;
  }
  try{
    const res = await fetch(file);
    if(!res.ok) throw new Error('Fichier introuvable');
    nodes = await res.json();
  }catch(err){
    choicesDiv.textContent = 'Clé indisponible : ' + err.message;
    backBtn.style.display = 'none';
    return;
  }

  const rootId = Object.values(nodes).find(n => !n.parent)?.id;
  if(!rootId){
    choicesDiv.textContent = 'Clé vide.';
    return;
  }
  stack = [rootId];
  showStep(rootId);

  backBtn.addEventListener('click', ()=>{
    if(stack.length > 1){
      stack.pop();
      showStep(stack[stack.length-1]);
    }
  });

  function showStep(id){
    pathDiv.textContent = id;
    const children = Object.values(nodes).filter(n => n.parent === id);
    choicesDiv.innerHTML = '';
    if(!children.length){
      const finalNode = nodes[id];
      const p = document.createElement('p');
      p.textContent = finalNode.texte;
      choicesDiv.appendChild(p);
      return;
    }
    for(const child of children){
      const btn = document.createElement('button');
      btn.textContent = child.texte;
      btn.addEventListener('click', ()=>{
        if(child.goto && child.goto !== 'END'){
          stack.push(child.goto);
          showStep(child.goto);
        }else{
          stack.push(child.id);
          showStep(child.id);
        }
      });
      choicesDiv.appendChild(btn);
    }
  }
})();
