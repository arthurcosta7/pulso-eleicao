export const REGIONS=['Norte','Nordeste','Centro-Oeste','Sudeste','Sul','Exterior'];
export const STATES=[['AC','Acre',0],['AL','Alagoas',1],['AP','Amapá',0],['AM','Amazonas',0],['BA','Bahia',1],['CE','Ceará',1],['DF','Distrito Federal',2],['ES','Espírito Santo',3],['GO','Goiás',2],['MA','Maranhão',1],['MT','Mato Grosso',2],['MS','Mato Grosso do Sul',2],['MG','Minas Gerais',3],['PA','Pará',0],['PB','Paraíba',1],['PR','Paraná',4],['PE','Pernambuco',1],['PI','Piauí',1],['RJ','Rio de Janeiro',3],['RN','Rio Grande do Norte',1],['RS','Rio Grande do Sul',4],['RO','Rondônia',0],['RR','Roraima',0],['SC','Santa Catarina',4],['SP','São Paulo',3],['SE','Sergipe',1],['TO','Tocantins',0],['ZZ','Exterior',5]].map(([uf,name,region])=>({uf,name,region:REGIONS[region]}));
const number=v=>Number(String(v??0).replace(',','.'));
export function normalize(data){
 const cargo=data.carg?.find(c=>String(c.cd)==='1');
 if(!cargo||!data.s||!data.v)throw Error('Formato do TSE não reconhecido');
 const candidates=(cargo.agr??[]).flatMap(a=>(a.par??[]).flatMap(p=>p.cand??[]));
 if(!candidates.some(c=>c.n==='13')||!candidates.some(c=>c.n==='22'))throw Error('Candidaturas esperadas ausentes');
 const lula=number(candidates.find(c=>c.n==='13').vap),flavio=number(candidates.find(c=>c.n==='22').vap);
 const r={lula,flavio,valid:number(data.v.vv),sections:number(data.s.ts),counted:number(data.s.st),electors:number(data.e?.te),blank:number(data.v.vb),nullVotes:number(data.v.tvn),date:data.dt||data.dg,time:data.ht||data.hg,id:data.idg,final:data.tf==='s',elected:candidates.find(c=>c.e==='s'&&/eleito/i.test(c.st??''))?.n??null};
 if(Object.values(r).some(v=>typeof v==='number'&&(!Number.isFinite(v)||v<0))||r.counted>r.sections||lula+flavio>r.valid)throw Error('Totais inválidos no arquivo do TSE');
 return r;
}
export function project(states,reference,{swing=0,turnout=1}={}){
 let lula=0,flavio=0,remaining=0,observed=0,unknown=0;const rows=[];
 for(const info of STATES){
  const s=states[info.uf],b=reference[info.uf];
  if(!s||!b){unknown++;continue;}
  const p=s.sections?s.counted/s.sections:0;
  const votes=s.lula+s.flavio;
  const prior=b.lula+b.flavio?b.lula/(b.lula+b.flavio):0.5;
  // Reference volume is all first-round valid votes; pair share is normalized.
  const expectedFromBase=b.sections?b.valid*s.sections/b.sections:b.valid;
  const rest=p>=1?0:Math.max(0,expectedFromBase*turnout*(1-p));
  const credibility=p/(p+0.05);
  const share=Math.max(0,Math.min(1,(votes?credibility*s.lula/votes+(1-credibility)*prior:prior)+swing/100));
  const pl=s.lula+rest*share,pf=s.flavio+rest*(1-share);
  lula+=pl;flavio+=pf;remaining+=rest;observed+=votes;
  rows.push({...info,...s,progress:p,remaining:rest,estimatedLula:pl,estimatedFlavio:pf,share,prior});
 }
 return {lula,flavio,remaining,observed,unknown,rows,share:lula+flavio?lula/(lula+flavio):null,available:unknown===0&&observed>0};
}
export function groupRows(rows){return REGIONS.map(name=>{
 const r=rows.filter(x=>x.region===name),sum=k=>r.reduce((a,x)=>a+x[k],0);
 return {name,lula:sum('lula'),flavio:sum('flavio'),sections:sum('sections'),counted:sum('counted'),remaining:sum('remaining'),estimatedLula:sum('estimatedLula'),estimatedFlavio:sum('estimatedFlavio'),states:r.length};
});}
export function demo(reference,progress=0.58){
 const delays={'Norte':0.88,'Nordeste':1.8,'Centro-Oeste':0.62,'Sudeste':0.68,'Sul':0.55,'Exterior':0.35};
 const states={};
 for(const s of STATES){const b=reference[s.uf];const p=progress>=1?1:Math.min(0.999,Math.pow(progress,delays[s.region]));const share=Math.max(0.02,Math.min(.98,b.lula/(b.lula+b.flavio)+0.012));const valid=Math.round(b.valid*p);const lula=Math.round(valid*share);states[s.uf]={...b,sections:b.sections,counted:Math.round(b.sections*p),lula,flavio:valid-lula,valid,blank:0,nullVotes:0,date:'Cenário fictício',time:'',id:`demo-${progress}`,final:p===1};}
 const sum=k=>Object.values(states).reduce((a,s)=>a+s[k],0);
 return {states,national:{lula:sum('lula'),flavio:sum('flavio'),valid:sum('valid'),sections:sum('sections'),counted:sum('counted'),blank:0,nullVotes:0,date:'Simulação',time:'',id:`demo-${progress}`,final:progress>=1},checkedAt:new Date().toISOString(),errors:[],simulation:true};
}
