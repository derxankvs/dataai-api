async function fetchFiles(){
  const r = await fetch('/data-files.json');
  const files = await r.json();
  const el = document.getElementById('list');
  if (!files.length) { el.innerHTML = '<p>Nenhum arquivo</p>'; return; }
  el.innerHTML = files.map(f => `<div class="item"><span>${f}</span><span><a class="btn" href="/a/key=${f.replace('.json','')}/json/view" target="_blank">Ver</a> <a class="btn" href="/a/key=${f.replace('.json','')}/json/download">Baixar</a></span></div>`).join('');
}

async function fetchConsultas(){
  const r = await fetch('/a/consultas/json/view');
  const data = await r.json();
  const el = document.getElementById('consult-list');
  if (!data.length) { el.innerHTML = '<p>Nenhuma consulta</p>'; return; }
  el.innerHTML = data.slice(0,20).map(c => `<div class="item"><small>${c.timestamp}</small><a class="btn" href="#" onclick='alert(JSON.stringify(${JSON.stringify({})}))'>Ver</a></div>`).join('');
}

window.onload = ()=>{ fetchFiles(); fetchConsultas(); };
