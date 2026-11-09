/* SCR-310 川口 2026-11-09 9R: verified rider/handicap/statistical snapshot.
   Racecard structure and interactions follow SCR-210; blank pre-race trial times
   are explicitly unconfirmed and never filled with estimates. */
(() => {
"use strict";
const raw=[
["五十嵐一夫","五十嵐","川口",21,60,"A-194","A-73","ボーリバージュ",0,"0.14","0.082","63.758",[1,4,1,4],[2,5,4,6],"3.38","3.462","3.439",[41.2,64.7],[50.0,66.7],[0,0,10]],
["長谷晴久","長谷","浜松",23,56,"A-90","A-126","フィールミー",10,"0.19","0.100","71.853",[1,2,3,4],[8,8,9,17],"3.37","3.470","3.444",[35.3,49.0],[61.1,88.9],[3,0,0]],
["井村淳一","井村","飯塚",28,43,"A-103","A-6","シャーロット",10,"0.21","0.095","71.279",[2,1,0,6],[4,8,3,29],"3.36","3.455","3.418",[30.2,39.7],[11.8,17.6],[2,0,10]],
["佐藤裕二","佐藤","川口",24,52,"A-17","S-43","ライキリ",20,"0.13","0.083","84.634",[3,1,2,4],[6,3,5,24],"3.37","3.453","3.422",[27.6,50.0],[20.0,20.0],[4,0,20]],
["田中茂","田中","飯塚",26,49,"A-84","A-23","レイリー",20,"0.16","0.091","73.386",[1,2,1,6],[5,9,10,24],"3.34","3.431","3.408",[25.4,46.0],[26.7,33.3],[1,0,49]],
["森且行","森","川口",25,52,"S-35","S-27","Ｍニジュウサン",20,"0.11","0.111","93.124",[1,3,0,4],[3,5,3,28],"3.33","3.441","3.414",[34.5,39.7],[28.6,50.0],[6,1,33]],
["若井友和","若井","川口",25,52,"S-17","S-18","モエルトウコン",20,"0.11","0.094","112.716",[0,1,3,6],[2,8,12,16],"3.34","3.434","3.413",[44.6,67.9],[56.3,62.5],[13,1,57]],
["中村雅人","中村","川口",28,45,"S-11","S-11","ＫＯモンソン",20,"0.16","0.093","117.010",[2,2,2,4],[8,6,9,12],"3.34","3.433","3.398",[60.4,72.9],[38.5,76.9],[10,1,71]]
];
const players=raw.map(a=>({name:a[0],short:a[1],loc:a[2],ki:a[3],age:a[4],
 rank:a[5],prev:a[6],car:a[7],h:a[8],st:a[9],diff:a[10],power:a[11],
 r10:a[12],r90:a[13],trial:a[14],avg:a[15],best:a[16],
 dry:a[17],wet:a[18],thisYear:a[19]}));
const root=document.querySelector(".sport-auto .phone-inner");
if(!root)return;
/* Fit only auto-specific line contents horizontally, preserving the five-row
   SCR-210 layout, original font sizes, and line heights. */
function fitRaceInfoLines(){
 for(const holder of root.querySelectorAll(".race-info-bar .ri-auto-fit-row")){
  const inner=holder.querySelector(":scope > .ri-auto-inline");
  if(!inner)continue;
  inner.style.transform="none";
  const natural=inner.getBoundingClientRect().width;
  const available=holder.getBoundingClientRect().width;
  const scale=natural>0&&available>0?Math.min(1,Math.max(.01,(available-.5)/natural)):1;
  inner.style.transform=scale<1?"scaleX("+scale.toFixed(6)+")":"none";
 }
}
let raceInfoFitScheduled=false;
function scheduleRaceInfoFit(){
 if(raceInfoFitScheduled)return;
 raceInfoFitScheduled=true;
 requestAnimationFrame(()=>{raceInfoFitScheduled=false;fitRaceInfoLines();});
}
fitRaceInfoLines();
window.addEventListener("resize",scheduleRaceInfoFit,{passive:true});
document.fonts?.ready.then(scheduleRaceInfoFit);

const table=root.querySelector(".auto-race-table"),wrap=root.querySelector(".race-table-wrap");
if(!table||!wrap)return;
const safe=t=>String(t).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;");
const group=(key,title,count)=>'<th class="auto-section" colspan="'+count+'" data-group="'+key+'">'+title+'</th>';
const th=(text,klass)=>'<th class="auto-value '+(klass||"")+'">'+text+'</th>';
const header='<tr>'+
'<th rowspan="2" class="col-sha"><button type="button" class="sort-car">車番</button></th>'+
'<th rowspan="2" class="col-name">選手名</th>'+
'<th rowspan="2" class="col-h">ハンデ</th><th rowspan="2" class="col-t">試走T</th>'+
'<th rowspan="2" class="col-t">偏差</th><th rowspan="2" class="col-t">平均ST</th>'+
'<th rowspan="2" class="col-rank">ランク</th>'+
'<th rowspan="2" class="col-power"><button type="button" class="sort-power" aria-pressed="false">審査P</button></th>'+
group("recent","近10走",4)+group("good","良10走",3)+group("last90","近90日成績",6)+
group("road","近180日成績",4)+group("titles","今年・通算優勝",3)+group("mania","マニア分析",3)+'</tr>';
const sub=(labels)=>labels.map((v,i)=>th(v,i===0?"auto-start":"")).join("");
const subhead='<tr>'+sub(["1着","2着","3着","着外"])+
 sub(["平均試走T","平均競走T","最高競走T"])+
 sub(["出走","1着","2着","3着","2連対率","3連対率"])+
 sub(["良2連対率","良3連対率","湿2連対率","湿3連対率"])+
 sub(["今年優出","今年V","通算V"])+
 sub(["走路別","近90日","タイム"])+'</tr>';
table.tHead.innerHTML=header+subhead;
const num=(values)=>values.map((v,i)=>'<td class="auto-value'+(i===0?" auto-start":"")+'">'+v+'</td>').join("");
table.tBodies[0].innerHTML=players.map((p,i)=>{
  const total=p.r90.reduce((x,y)=>x+y,0),pct=(x)=>total?(100*x/total).toFixed(1)+"%":"—";
  const main='<td class="col-sha"><span class="frame-cell f'+(i+1)+'">'+(i+1)+'</span><span class="sha-nm">'+safe(p.short)+'</span></td>'+
  '<td class="col-name"><div class="rider-name">'+safe(p.name)+'</div><div class="rider-meta rider-home">'+safe(p.car)+'</div><div class="rider-meta rider-age">'+p.loc+" "+p.ki+"期 "+p.age+'歳</div></td>'+
  '<td class="col-h">'+p.h+'m</td><td class="col-t" title="試走タイム未収録">—</td>'+
  '<td class="col-t">'+p.diff+'</td><td class="col-t">'+p.st+'</td>'+
  '<td class="col-rank"><span class="grade-current">'+p.rank+'</span><span class="grade-prev">前'+p.prev+'</span></td>'+
  '<td class="col-power">'+p.power+'</td>';
  const ninety=[total,p.r90[0],p.r90[1],p.r90[2],pct(p.r90[0]+p.r90[1]),pct(p.r90[0]+p.r90[1]+p.r90[2])];
  const fields=main+num(p.r10)+num([p.trial,p.avg,p.best])+num(ninety)+
  num([...p.dry.map(v=>v.toFixed(1)+"%"),...p.wet.map(v=>v.toFixed(1)+"%")])+
  num(p.thisYear)+
  ['road','last90','good'].map((key,j)=>'<td class="auto-value'+(j===0?' auto-start':'')+'"><button type="button" class="item-btn auto-detail-button" data-report="'+key+'">'+["走路別","近90日","タイム"][j]+'</button></td>').join("");
  return '<tr data-vehicle="'+(i+1)+'" data-power="'+p.power+'">'+fields+'</tr>';
}).join("");
const menu=[...root.querySelectorAll(".race-menu-scroll .info-tab[data-target]")];
function choose(key){
 const cell=key==="player"?table.querySelector(".col-name"):table.querySelector('[data-group="'+key+'"]');
 if(!cell)return;
 const x=wrap.scrollLeft+cell.getBoundingClientRect().left-wrap.getBoundingClientRect().left-50;
 wrap.scrollTo({left:Math.max(0,x),behavior:"smooth"});
 menu.forEach(t=>t.classList.toggle("active",t.dataset.target===key));
 // Match SCR-210's gold/white highlight on the selected heading group.
 table.querySelectorAll("thead th.section-selected").forEach(t=>t.classList.remove("section-selected"));
 const targets=key==="player"?[...table.tHead.rows[0].cells].slice(2,8):
   [...table.tHead.querySelectorAll('th[data-group="'+key+'"]')];
 targets.forEach(t=>t.classList.add("section-selected"));
}
menu.forEach(t=>t.addEventListener("click",()=>choose(t.dataset.target)));
// Initial menu state: player section, without changing initial horizontal scroll.
[...table.tHead.rows[0].cells].slice(2,8).forEach(t=>t.classList.add("section-selected"));
const sheet=root.querySelector(".sheet"),overlay=root.querySelector(".sheet-overlay");
const report={
 road:{title:"近180日・走路別成績",heads:["良2連対率","良3連対率","湿2連対率","湿3連対率"],values:p=>[...p.dry,...p.wet].map(v=>v.toFixed(1)+"%")},
 last90:{title:"近90日成績",heads:["出走","1着","2着","3着","着外","2連対率","3連対率"],values:p=>{const n=p.r90.reduce((a,b)=>a+b,0);const pct=x=>n?(100*x/n).toFixed(1)+"%":"—";return [n,...p.r90,pct(p.r90[0]+p.r90[1]),pct(p.r90[0]+p.r90[1]+p.r90[2])]}},
 good:{title:"良走路・近10走タイム",heads:["平均試走T","平均競走T","最高競走T"],values:p=>[p.trial,p.avg,p.best]}
};
function close(){sheet.hidden=true;overlay.hidden=true;}
function open(key){
 const it=report[key];if(!it)return;
 sheet.querySelector(".sheet-title").textContent=it.title;
 const detail=sheet.querySelector(".detail-table");
 detail.tHead.innerHTML='<tr><th class="dt-vehicle" rowspan="2">車番</th><th class="dt-auto-name" rowspan="2">選手名</th><th colspan="'+it.heads.length+'">'+it.title+'</th></tr><tr>'+
 it.heads.map(s=>'<th>'+safe(s)+'</th>').join("")+'</tr>';
 detail.tBodies[0].innerHTML=players.map((p,i)=>'<tr><td class="dt-vehicle"><div class="dt-vehicle-content"><span class="frame-cell f'+(i+1)+'">'+(i+1)+'</span><span class="dt-vehicle-short">'+safe(p.short)+'</span></div></td>'+
 '<td class="dt-auto-name">'+safe(p.name)+'</td>'+it.values(p).map(v=>'<td>'+v+'</td>').join("")+'</tr>').join("");
 sheet.hidden=false;overlay.hidden=false;
 sheet.querySelector(".sheet-close").focus({preventScroll:true});
}
root.querySelectorAll(".auto-detail-button").forEach(t=>t.addEventListener("click",()=>open(t.dataset.report)));
sheet.querySelector(".sheet-close").addEventListener("click",close);
sheet.querySelector(".sheet-handle").addEventListener("click",close);
overlay.addEventListener("click",close);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!sheet.hidden)close();});
let initialY=null;
sheet.querySelector(".sheet-handle").addEventListener("touchstart",e=>{initialY=e.touches[0]?.clientY??null;},{passive:true});
sheet.querySelector(".sheet-handle").addEventListener("touchend",e=>{if(initialY!==null&&(e.changedTouches[0]?.clientY??initialY)-initialY>35)close();initialY=null;},{passive:true});
const body=table.tBodies[0],order=[...body.rows],power=table.querySelector(".sort-power");
table.querySelector(".sort-car").addEventListener("click",()=>{order.forEach(tr=>body.appendChild(tr));power.setAttribute("aria-pressed","false");});
power.addEventListener("click",()=>{const high=power.getAttribute("aria-pressed")!=="true";
 [...body.rows].sort((a,b)=>high?Number(b.dataset.power)-Number(a.dataset.power):Number(a.dataset.vehicle)-Number(b.dataset.vehicle))
 .forEach(tr=>body.appendChild(tr));power.setAttribute("aria-pressed",String(high));});
root.querySelector('.race-tab[data-race="9"]')?.addEventListener("click",e=>e.preventDefault());
root.querySelector('.race-tab[data-race="9"]')?.setAttribute("aria-current","true");
})();
