import {STATES,REGIONS,normalize,project,groupRows,demo} from './model.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const fmt=new Intl.NumberFormat('pt-BR'),one=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1}),two=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const pct=n=>two.format(n*100)+'%',compact=n=>n>=1e6?one.format(n/1e6)+' mi':n>=1000?one.format(n/1000)+' mil':fmt.format(Math.round(n));
const time=iso=>new Date(iso).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit'});
const iconPaths={grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',map:'m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2z M9 3v16 M15 5v16',chart:'M3 3v18h18 M6 15l5-5 4 3 6-8',sliders:'M4 7h9m4 0h3M4 17h3m4 0h9 M13 4v6 M7 14v6',book:'M12 5c-4-3-9-2-9-2v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2z M12 5v16',help:'M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4 M12 16v.1 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',refresh:'M20 7a8 8 0 1 0 0 10 M20 3v5h-5',info:'M12 11v6 M12 7v.1 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',ballot:'M5 13H3v8h18v-8h-2 M8 16h8 M7 9l5-7 7 5-5 7z',check:'m8 12 3 3 5-6 M21 12a9 9 0 1 1-5-8',clock:'M12 7v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',signal:'M4 17v3 M9 12v8 M14 8v12 M19 3v17',flag:'M5 21V3h14l-3 5 3 5H5',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z',globe:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M2 12h20 M12 2c6 6 6 14 0 20-6-6-6-14 0-20',layers:'m12 3 10 5-10 5L2 8z M2 12l10 5 10-5 M2 16l10 5 10-5',search:'M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',play:'m9 5 11 7-11 7z',close:'m6 6 12 12 M6 18 18 6'};
function icons(root=document){root.querySelectorAll('i[data-icon]').forEach(el=>{el.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPaths[el.dataset.icon]||iconPaths.info}"/></svg>`;});}
icons();
let reference,mapData,live=null,view=null,projection=null,history=[],isDemo=false,busy=false,mapMode='progress',selectedUF=null,ascending=true,loadError='',timer;
const storage={read(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback;}catch{return fallback;}},write(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}};
history=storage.read('pulso-history-6258-v1',[]).filter(p=>Number.isFinite(p.raw)&&Number.isFinite(p.projected)&&p.at);
function notify(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(timer);timer=setTimeout(()=>$('#toast').hidden=true,4000);}
function openMethod(){$('#methodDialog').showModal();}
$$('[data-method]').forEach(b=>b.addEventListener('click',openMethod));$('#infoButton').addEventListener('click',openMethod);$('#closeMethod').addEventListener('click',()=>$('#methodDialog').close());$('#methodDialog').addEventListener('click',e=>{if(e.target===$('#methodDialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$$('nav a').forEach(a=>a.addEventListener('click',()=>{$$('nav a').forEach(b=>b.classList.toggle('active',b===a));}));
const officialURL=uf=>{const u=uf.toLowerCase();return `https://resultados.tse.jus.br/oficial/ele2026/6258/dados/${u}/${u}-c0001-e006258-u.json`;};
async function refresh(){
 if(busy)return;busy=true;$('#refresh').disabled=true;
 if(!isDemo)$('#connection').innerHTML='<span></span>Consultando o TSE';
 const states={},errors=[];let national=null;const keys=['BR',...STATES.map(s=>s.uf)];
 try{
  for(let i=0;i<keys.length;i+=4){
   await Promise.all(keys.slice(i,i+4).map(async uf=>{try{const r=await fetch(officialURL(uf),{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error(`HTTP ${r.status}`);const result=normalize(await r.json());if(uf==='BR')national=result;else states[uf]=result;}catch(e){errors.push(`${uf}: ${e.name==='TimeoutError'?'tempo de resposta excedido':e.message}`);}}));
   // Do not hammer all files after a clear platform block.
   if(errors.some(e=>/HTTP (403|429)/.test(e))){for(const uf of keys.slice(i+4))errors.push(`${uf}: consulta suspensa após bloqueio`);break;}
  }
  const next={states,national,checkedAt:new Date().toISOString(),errors,simulation:false};
  if(national&&errors.length===0){live=next;storage.write('pulso-snapshot-6258-v1',next);loadError='';record(next);}
  else{loadError=`Não foi possível atualizar ${errors.length} arquivo(s). ${errors.slice(0,2).join('; ')}.`;if(!live&&national)live=next;}
 }catch(e){loadError='Não foi possível acessar o TSE nesta consulta. '+e.message;}
 busy=false;$('#refresh').disabled=false;if(!isDemo)render();
}
function record(snapshot){const p=project(snapshot.states,reference.states);if(!p.available||!snapshot.national.valid)return;const key=snapshot.national.id+'|'+STATES.map(s=>snapshot.states[s.uf]?.id).join('|');if(history.at(-1)?.key===key)return;history.push({key,at:snapshot.checkedAt,raw:snapshot.national.lula/snapshot.national.valid*100,projected:p.share*100});history=history.slice(-180);storage.write('pulso-history-6258-v1',history);}
function getView(){return isDemo?demo(reference.states,Number($('#demoProgress').value)/100):live;}
function render(){
 view=getView();projection=project(view?.states??{},reference.states,{swing:isDemo?Number($('#swing').value):0});
 document.body.classList.toggle('demo-mode',isDemo);
 const national=view?.national,hasVotes=!!national?.valid,complete=projection.available;
 $('#scoreBadge').textContent=isDemo?'Dados fictícios · simulação':'Dados oficiais · TSE';
 $('#connection').className='connection '+(isDemo?'demo':loadError?'warning':'');
 $('#connection').innerHTML='<span></span>'+(isDemo?'Modo simulação':loadError?'Atualização indisponível':!national?'Sem conexão com o TSE':hasVotes?'Acompanhando o TSE':'Aguardando apuração');
 const notice=$('#notice');notice.className='notice '+(isDemo?'simulation':loadError?'error':'');
 let text=isDemo?'Simulação ativa: os números são fictícios. O Nordeste foi configurado para chegar depois. Volte ao TSE no botão abaixo.':loadError?(live?'A atualização falhou. Exibindo o último retrato disponível, consultado às '+time(live.checkedAt)+'. '+loadError:loadError+' Use Atualizar para tentar novamente.'):
 !hasVotes?'Aguardando divulgação de votos. O arquivo do TSE ainda não contém votos totalizados. Nenhum cenário fictício é exibido como resultado oficial.':'Dados oficiais consultados a cada minuto. A projeção é experimental e considera o peso de cada UF e do exterior.';
 if(!isDemo&&hasVotes&&complete){const regional=projection.observed;if(Math.abs(regional-national.lula-national.flavio)>1000)text+=' Brasil e UFs estão em momentos diferentes de divulgação; os totais ainda não coincidem.';}
 notice.querySelector('span').textContent=text;
 $('#countedPct').textContent=national?.sections?pct(national.counted/national.sections):'—';$('#countedBar').style.width=(national?.sections?national.counted/national.sections*100:0)+'%';
 $('#countedDetail').textContent=national?`${fmt.format(national.counted)} de ${fmt.format(national.sections)} seções`:'Fonte indisponível';
 $('#validVotes').textContent=national?fmt.format(national.valid):'—';$('#validDetail').textContent=isDemo?'Cenário fictício de apuração':national?`${compact(national.blank)} brancos · ${compact(national.nullVotes)} nulos`:'Placar nacional do TSE';
 $('#remainingVotes').textContent=projection.unknown===0?compact(projection.remaining):'—';$('#sourceTime').textContent=isDemo?'Simulação':national?.time||'—';
 $('#checkedTime').textContent=isDemo?'Sem vínculo com a apuração real':national?`Fonte: ${national.date} · consulta ${time(view.checkedAt)}`:'Consulta automática a cada 60 s';
 const l=hasVotes?national.lula/national.valid:null,f=hasVotes?national.flavio/national.valid:null;
 $('#lulaPct').innerHTML=(l===null?'—':two.format(l*100))+'<small>%</small>';$('#flavioPct').innerHTML=(f===null?'—':two.format(f*100))+'<small>%</small>';
 $('#lulaVotes').textContent=national?fmt.format(national.lula)+' votos':'Aguardando votos';$('#flavioVotes').textContent=national?fmt.format(national.flavio)+' votos':'Aguardando votos';
 $('#lulaBar').style.width=(l??0)*100+'%';$('#flavioBar').style.width=(f??0)*100+'%';
 const diff=national?national.lula-national.flavio:0;
 $('#leadText').textContent=!hasVotes?'Aguardando início da totalização':diff===0?'Empate no placar apurado':`${diff>0?'Lula':'Flávio'} à frente por ${compact(Math.abs(diff))} votos`;
 $('#projectedLula').innerHTML=(complete?two.format(projection.share*100):'—')+'<small>%</small>';$('#projectedFlavio').innerHTML=(complete?two.format((1-projection.share)*100):'—')+'<small>%</small>';
 const adjustment=complete&&hasVotes?(projection.share-l)*100:null;
 $('#adjustment').textContent=adjustment===null?'—':(adjustment>=0?'+':'−')+one.format(Math.abs(adjustment))+' p.p.';
 $('#projectionNote').textContent=!complete?(projection.unknown?'Projeção indisponível: faltam dados atuais de '+projection.unknown+' abrangência(s).':'Aguardando os primeiros votos. A referência do 1º turno, sozinha, não é uma projeção ao vivo.'):
 `${isDemo?'Cenário fictício. ':''}Extrapolação por UF; preferência suavizada com o 1º turno. ${projection.remaining<1?'Todas as seções foram totalizadas.':'Não é probabilidade de vitória nem declaração de vencedor.'}`;
 const groups=groupRows(projection.rows);
 $('#regionRows').innerHTML=groups.map(r=>`<div class="region-row ${r.name==='Nordeste'?'highlight':''}"><span>${r.name}</span><div class="region-track"><div style="width:${r.sections?r.counted/r.sections*100:0}%"></div></div><span>${r.sections?pct(r.counted/r.sections):'—'}</span></div>`).join('');
 const ne=groups.find(g=>g.name==='Nordeste'),ex=groups.find(g=>g.name==='Exterior');
 $('#exteriorProgress').textContent=ex?.sections?pct(ex.counted/ex.sections):'—';
 const insight=$('#regionInsight p');
 if(complete&&projection.remaining>0&&ne){const share=ne.remaining/projection.remaining*100;insight.textContent=`O Nordeste representa ${one.format(share)}% dos votos estimados que ainda faltam. O impacto depende da preferência nessas urnas.`;}
 else insight.textContent='Uma região com poucas urnas apuradas pode estar sub-representada no placar nacional. A ordem de chegada varia.';
 renderMap();renderTable();renderChart();icons();
}
function renderMap(){
 for(const path of $$('#brazilMap path')){
  const r=projection.rows.find(r=>r.uf===path.dataset.uf);let fill='#edf0f6';
  if(r){if(mapMode==='leader'){if(r.lula+r.flavio)fill=r.lula>r.flavio?'#d38c9d':r.flavio>r.lula?'#83a4cd':'#c5cbd7';}else{const p=r.progress;const a=[237,240,248],b=[83,113,177];fill='rgb('+a.map((v,i)=>Math.round(v+(b[i]-v)*p)).join(',')+')';}}
  path.setAttribute('fill',fill);path.classList.toggle('selected',path.dataset.uf===selectedUF);
 }
 $('#mapLegend').classList.toggle('leaders',mapMode==='leader');const labels=$$('#mapLegend>span');labels[0].textContent=mapMode==='leader'?'Lula · rosa':'Menos apurado';labels[1].textContent=mapMode==='leader'?'Flávio · azul':'Mais apurado';
}
function mapInfo(uf){const r=projection.rows.find(r=>r.uf===uf),s=STATES.find(s=>s.uf===uf);const tip=$('#mapTooltip');tip.textContent=`${s.name} · ${r?pct(r.progress)+' apurado':'sem dados'}${r?.lula+r?.flavio?' · Lula '+pct(r.lula/(r.lula+r.flavio)):''}`;tip.classList.add('visible');}
function selectUF(uf){selectedUF=selectedUF===uf?null:uf;$('#stateSearch').value=selectedUF??'';$('#regionFilter').value='';renderTable();renderMap();$('#states').scrollIntoView({behavior:'smooth',block:'start'});}
function drawMap(){
 const ns='http://www.w3.org/2000/svg';
 for(const area of mapData){const path=document.createElementNS(ns,'path');path.setAttribute('d',area.d);path.setAttribute('tabindex','0');path.setAttribute('role','button');path.setAttribute('aria-label',STATES.find(s=>s.uf===area.uf)?.name??area.uf);path.dataset.uf=area.uf;path.addEventListener('mouseenter',()=>mapInfo(area.uf));path.addEventListener('mouseleave',()=>$('#mapTooltip').classList.remove('visible'));path.addEventListener('focus',()=>mapInfo(area.uf));path.addEventListener('blur',()=>$('#mapTooltip').classList.remove('visible'));path.addEventListener('click',()=>selectUF(area.uf));path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectUF(area.uf);}});$('#brazilMap').append(path);}
 // State labels are placed at the center of each vector bounding box.
 for(const p of $$('#brazilMap path')){if(['DF','ES','SE','AL','PB','RN'].includes(p.dataset.uf))continue;const b=p.getBBox();const label=document.createElementNS(ns,'text');label.setAttribute('x',b.x+b.width/2);label.setAttribute('y',b.y+b.height/2+4);label.setAttribute('text-anchor','middle');label.setAttribute('class','map-label');label.textContent=p.dataset.uf;$('#brazilMap').append(label);}
}
const unaccent=v=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function renderTable(){
 const query=unaccent($('#stateSearch').value.trim()),region=$('#regionFilter').value;
 const rows=STATES.map(s=>projection.rows.find(r=>r.uf===s.uf)??{...s,missing:true}).filter(r=>(!region||r.region===region)&&(!query||unaccent(r.uf+' '+r.name).includes(query))).sort((a,b)=>((a.progress??-1)-(b.progress??-1))*(ascending?1:-1)||a.name.localeCompare(b.name,'pt-BR'));
 $('#statesBody').innerHTML=rows.length?rows.map(r=>{const valid=r.lula+r.flavio;return `<tr data-uf="${r.uf}" class="${r.uf===selectedUF?'selected':''}"><td><span class="uf">${r.uf}</span><span class="state-name">${r.name}</span></td><td><div class="table-progress"><div><span style="width:${(r.progress??0)*100}%"></span></div><b>${r.missing?'—':pct(r.progress)}</b></div></td><td class="lula-cell">${valid?pct(r.lula/valid):'—'}</td><td class="flavio-cell">${valid?pct(r.flavio/valid):'—'}</td><td>${r.missing?'—':compact(r.remaining)}</td><td>${isDemo?'Fictício':r.time||'—'}</td></tr>`;}).join(''):'<tr><td colspan="6" style="text-align:center;padding:35px">Nenhuma abrangência encontrada. Tente outro nome ou região.</td></tr>';
 $('#tableCount').textContent=`${rows.length} de 28 abrangências · ${isDemo?'simulação':'TSE'}`;
}
function renderChart(){
 const data=isDemo?Array.from({length:28},(_,i)=>{const progress=(i+1)/28*(Number($('#demoProgress').value)/100),d=demo(reference.states,progress),p=project(d.states,reference.states,{swing:Number($('#swing').value)});return {raw:d.national.lula/d.national.valid*100,projected:p.share*100,at:progress};}):history;
 const width=580,height=190,left=30,right=13,top=16,bottom=30,w=width-left-right,h=height-top-bottom;
 const lo=Math.floor(Math.min(46,...data.flatMap(d=>[d.raw-1,d.projected-1]))/2)*2,hi=Math.ceil(Math.max(54,...data.flatMap(d=>[d.raw+1,d.projected+1]))/2)*2;
 const y=v=>top+(hi-v)/(hi-lo)*h,x=i=>left+(data.length<2?w/2:i/(data.length-1)*w);
 const ticks=[hi,(hi+lo)/2,lo];if(50>lo&&50<hi&&!ticks.includes(50))ticks.push(50);
 let svg=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${isDemo?'Histórico fictício do cenário simulado':'Histórico das consultas realizadas neste navegador'}">`;
 for(const v of ticks)svg+=`<line x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}" stroke="${v===50?'#d3d8e6':'#eef1f7'}" ${v===50?'stroke-dasharray="4 4"':''}/><text x="0" y="${y(v)+4}">${one.format(v)}%</text>`;
 if(data.length){for(const [key,color,dash] of [['raw','#8398bc',''],['projected','#8f85b2','5 5']]){const points=data.map((d,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(d[key]).toFixed(2)}`).join(' ');svg+=`<path d="${points}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" ${dash?'stroke-dasharray="'+dash+'"':''}/>`;const last=data.at(-1);svg+=`<circle cx="${x(data.length-1)}" cy="${y(last[key])}" r="3.5" fill="${color}"><title>${key==='raw'?'Placar':'Projeção'}: ${two.format(last[key])}%</title></circle>`;}
  const indices=[...new Set([0,Math.floor((data.length-1)/2),data.length-1])];for(const i of indices){const label=isDemo?`${Math.round(data[i].at*100)}% do cenário`:time(data[i].at).slice(0,5);svg+=`<text x="${x(i)}" y="${height-7}" text-anchor="${i===0?'start':i===data.length-1?'end':'middle'}">${label}</text>`;}}
 svg+='</svg>';if(!data.length)svg+='<div class="chart-empty">As primeiras consultas com votos vão desenhar esta história.</div>';else if(data.length===1)svg+='<div class="chart-empty" style="inset:85px 50px 40px">Primeiro registro salvo. A curva aparece com as próximas atualizações.</div>';
 $('#chart').innerHTML=svg;$('#historyNote').textContent=isDemo?'Trajetória fictícia, calculada com diferentes ritmos regionais. Não é histórico do TSE.':'Histórico local: '+data.length+' registro(s). Não reconstruímos períodos anteriores à abertura do painel.';
}
function setDemo(active){isDemo=active;$('#demoProgress').disabled=!active;$('#swing').disabled=!active;$('#labStatus').textContent=active?'Dados fictícios':'Simulação desativada';$('#demoToggle').innerHTML=active?'<i data-icon="signal"></i>Voltar aos dados do TSE':'<i data-icon="play"></i>Explorar simulação';render();if(active){$('#overview').scrollIntoView({behavior:'smooth'});notify('Simulação ativa. Todos os números do painel agora são fictícios.');}else notify('Painel restaurado para os dados oficiais do TSE.');}
$('#demoToggle').addEventListener('click',()=>setDemo(!isDemo));
$('#demoProgress').addEventListener('input',()=>{$('#progressOutput').textContent=$('#demoProgress').value+'%';if(isDemo)render();});
$('#swing').addEventListener('input',()=>{const v=Number($('#swing').value);$('#swingOutput').textContent=(v>0?'+':'')+one.format(v)+' p.p.';if(isDemo)render();});
$('#refresh').addEventListener('click',()=>{if(isDemo){notify('O TSE continua sendo consultado em segundo plano. Use “Voltar aos dados do TSE” para sair da simulação.');}refresh();});
$$('[data-map]').forEach(b=>b.addEventListener('click',()=>{mapMode=b.dataset.map;$$('[data-map]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});renderMap();}));
$('#stateSearch').addEventListener('input',()=>{selectedUF=null;renderTable();renderMap();});$('#regionFilter').addEventListener('change',()=>{selectedUF=null;renderTable();renderMap();});
$('#sortProgress').addEventListener('click',()=>{ascending=!ascending;$('#sortProgress span').textContent=ascending?'↑':'↓';$('#sortProgress').closest('th').setAttribute('aria-sort',ascending?'ascending':'descending');renderTable();});
$('#exteriorChip').addEventListener('click',()=>{$('#regionFilter').value='Exterior';$('#stateSearch').value='';selectedUF='ZZ';renderTable();$('#states').scrollIntoView({behavior:'smooth'});});
$('#download').addEventListener('click',()=>{if(!view){notify('Ainda não há dados disponíveis para exportar.');return;}const payload={mode:isDemo?'simulation':'official',snapshot:view,projection,reference:{election:'6257',fetchedAt:reference.fetchedAt},method:'Experimental UF extrapolation; not a probability or official forecast'};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`pulso-${isDemo?'simulacao':'tse'}-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
async function init(){try{[reference,mapData]=await Promise.all(['assets/reference.json','assets/map.json'].map(async u=>{const r=await fetch(u);if(!r.ok)throw Error(u);return r.json();}));$('#referenceDate').textContent='Referência do primeiro turno obtida em '+new Date(reference.fetchedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+'.';const cached=storage.read('pulso-snapshot-6258-v1',null);if(cached?.national&&STATES.every(s=>cached.states?.[s.uf])){live=cached;loadError='Verificando se há uma divulgação mais recente.';}drawMap();render();await refresh();setInterval(()=>{if(!document.hidden)refresh();},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});}catch(e){$('#notice span').textContent='Não foi possível carregar os arquivos de referência. Recarregue a página para tentar novamente. '+e.message;$('#notice').classList.add('error');$('#connection').textContent='Referência indisponível';$('#refresh').onclick=()=>location.reload();}}
init();
