/* SCR-310 川口 2026-11-09 9R: record data distinct by statistical source.
   Gamboo Supercomputer deviations (all races, and top-2 finishes)
   must never be replaced by 良10走 / official site deviation data. */
(() => {
"use strict";
// Official race-day trial times supplied for Kawaguchi 9R (2026-11-09),
// indexed by vehicle number 1–8. Keep distinct from the 10-race average.
const raceDayTrials=["3.69","3.70","3.69","3.69","3.65","3.76","3.69","3.68"];
const raw=[
["五十嵐一夫","五十嵐","川口",21,60,"A-194","A-73","ボーリバージュ",0,"0.14","0.082","63.758",[1,4,1,4],[2,5,4,6],"3.38","3.462","3.439",[41.2,64.7],[50.0,66.7],[0,0,10],"1級"],
["長谷晴久","長谷","浜松",23,56,"A-90","A-126","フィールミー",10,"0.19","0.100","71.853",[1,2,3,4],[8,8,9,17],"3.37","3.470","3.444",[35.3,49.0],[61.1,88.9],[3,0,0],"1級"],
["井村淳一","井村","飯塚",28,43,"A-103","A-6","シャーロット",10,"0.21","0.095","71.279",[2,1,0,6],[4,8,3,29],"3.36","3.455","3.418",[30.2,39.7],[11.8,17.6],[2,0,10],"1級"],
["佐藤裕二","佐藤","川口",24,52,"A-17","S-43","ライキリ",20,"0.13","0.083","84.634",[3,1,2,4],[6,3,5,24],"3.37","3.453","3.422",[27.6,50.0],[20.0,20.0],[4,0,20],"1級"],
["田中茂","田中","飯塚",26,49,"A-84","A-23","レイリー",20,"0.16","0.091","73.386",[1,2,1,6],[5,9,10,24],"3.34","3.431","3.408",[25.4,46.0],[26.7,33.3],[1,0,49],"1級"],
["森且行","森","川口",25,52,"S-35","S-27","Ｍニジュウサン",20,"0.11","0.111","93.124",[1,3,0,4],[3,5,3,28],"3.33","3.441","3.414",[34.5,39.7],[28.6,50.0],[6,1,33],"1級"],
["若井友和","若井","川口",25,52,"S-17","S-18","モエルトウコン",20,"0.11","0.094","112.716",[0,1,3,6],[2,8,12,16],"3.34","3.434","3.413",[44.6,67.9],[56.3,62.5],[13,1,57],"1級"],
["中村雅人","中村","川口",28,45,"S-11","S-11","ＫＯモンソン",20,"0.16","0.093","117.010",[2,2,2,4],[8,6,9,12],"3.34","3.433","3.398",[60.4,72.9],[38.5,76.9],[10,1,71],"1級"]
];
// 2026-11-09 川口9R: near-180-day placing counts provided by the user,
// each array ordered 1st, 2nd, 3rd, unplaced; good/wet separately.
const roadRecord=[
 {good:[6,7,9,27],wet:[2,1,1,2]},
 {good:[4,14,7,26],wet:[9,2,5,2]},
 {good:[7,12,6,37],wet:[1,1,1,13]},
 {good:[7,9,13,29],wet:[0,2,0,8]},
 {good:[6,10,13,33],wet:[1,3,1,10]},
 {good:[9,11,3,32],wet:[1,3,3,7]},
 {good:[16,9,13,17],wet:[3,6,1,6]},
 {good:[22,7,6,13],wet:[2,3,5,3]}
];
// Gamboo trial deviations (normal/全R, top2/2連対時), car 1–8.
const superconDeviations=[
 {normal:"0.09",top2:"0.09"},
 {normal:"0.09",top2:"0.08"},
 {normal:"0.10",top2:"0.10"},
 {normal:"0.08",top2:"0.08"},
 {normal:"0.09",top2:"0.10"},
 {normal:"0.11",top2:"0.10"},
 {normal:"0.09",top2:"0.09"},
 {normal:"0.10",top2:"0.10"}
];
// Same rule as SCR-210: the first three characters of the full rider name.
const players=raw.map((a,i)=>({name:a[0],short:Array.from(a[0]).slice(0,3).join(""),loc:a[2],ki:a[3],age:a[4],todayTrial:raceDayTrials[i],
 rank:a[5],prev:a[6],car:a[7],h:a[8],st:a[9],good10Diff:a[10],
  deviationNormal:superconDeviations[i].normal,deviationTop2:superconDeviations[i].top2,
  power:a[11],
 r10:a[12],r90:a[13],trial:a[14],avg:a[15],best:a[16],
 dry:a[17],wet:a[18],roadRecord:roadRecord[i],thisYear:a[19],vehicleGrade:a[20]}));
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
// These section names appear in the menu, not in the box-table header.
const statHeader=(primary,rate,isFirst,key)=>'<th rowspan="2" data-group="'+key+'" class="auto-value auto-stat-heading'+(isFirst?' auto-start':'')+'">'+
 '<span class="recent4-heading-main">'+primary+'</span><span class="recent4-heading-rate">'+rate+'</span></th>';
const statHeaderGroup=key=>[
 statHeader("1着","勝率",true,key),
 statHeader("2着","2連対率",false,key),
 statHeader("3着","3連対率",false,key),
 statHeader("着外","着外率",false,key)
].join("");
const timeHeader=(a,b,first)=>'<th rowspan="2" data-group="good" class="auto-value auto-time-heading'+(first?' auto-start':'')+'"><span>'+a+'</span><span>'+b+'</span></th>';
const roadHeaders=()=>["良","湿"].flatMap((track,k)=>
 [["1着","勝率"],["2着","2連対率"],["3着","3連対率"],["着外","着外率"]]
 .map(([name,rate],i)=>'<th rowspan="2" data-group="road" class="auto-value auto-stat-heading auto-road-heading'+
 (i===0&&k===0?' auto-start':'')+'"><span class="recent4-heading-main">'+
 track+name+'</span><span class="recent4-heading-rate">'+rate+'</span></th>')
).join("");
const header='<tr>'+
'<th rowspan="2" class="col-sha">車番</th>'+
'<th rowspan="2" class="col-name">選手名</th>'+

'<th rowspan="2" class="col-h">ハンデ</th><th rowspan="2" class="col-t">平均ST</th>'+
'<th rowspan="2" class="col-t">試走T</th><th rowspan="2" class="col-t col-deviation">試走偏差</th>'+
'<th rowspan="2" class="col-rank"><button type="button" class="sort-power" aria-pressed="false" aria-label="審査ポイント順に並び替え"><span>ランク</span><span>審査P</span></button></th>'+
'<th rowspan="2" class="col-machine">競走車名</th>'+
statHeaderGroup("recent")+timeHeader("平均","試走T",true)+
timeHeader("平均","競走T",false)+timeHeader("最高","競走T",false)+
statHeaderGroup("last90")+roadHeaders()+group("titles","今年・通算優勝",3)+group("mania","マニア分析",3)+'</tr>';
const sub=(labels)=>labels.map((v,i)=>th(v,i===0?"auto-start":"")).join("");
const subhead='<tr>'+
 sub(["今年優出","今年V","通算V"])+
 sub(["走路別","近90日","タイム"])+'</tr>';
table.tHead.innerHTML=header+subhead;
const num=(values)=>values.map((v,i)=>'<td class="auto-value'+(i===0?" auto-start":"")+'">'+v+'</td>').join("");
/* Follow SCR-210: show integer rates, tint the three highest win /
   two-place / three-place percentages by exact (unrounded) rate.
   Ties receive competition ranks 1,1,3,...; outside rate is not ranked. */
const statValues=counts=>{
 const total=counts.reduce((n,v)=>n+v,0);
 return total?[
  100*counts[0]/total,
  100*(counts[0]+counts[1])/total,
  100*(counts[0]+counts[1]+counts[2])/total,
  100*counts[3]/total
 ]:[NaN,NaN,NaN,NaN];
};
const statRanks=selector=>{
 const ranks=players.map(()=>[0,0,0]);
 for(let k=0;k<3;k++){
  let previous=NaN,rank=0;
  players.map((p,index)=>({index,value:statValues(selector(p))[k]}))
   .filter(item=>Number.isFinite(item.value))
   .sort((a,b)=>b.value-a.value||a.index-b.index)
   .forEach(({index,value},order)=>{
     if(order===0||value!==previous)rank=order+1;
     if(rank<=3)ranks[index][k]=rank;
     previous=value;
   });
 }
 return ranks;
};
const recentRanks=statRanks(p=>p.r10),last90Ranks=statRanks(p=>p.r90);
const roadGoodRanks=statRanks(p=>p.roadRecord.good),roadWetRanks=statRanks(p=>p.roadRecord.wet);
const statCells=(counts,ranks,extraClass="")=>{
 const rates=statValues(counts);
 return counts.map((v,i)=>'<td class="auto-value recent4-cell auto-stat-cell'+
  (extraClass?' '+extraClass:'')+(i===0?' auto-start':'')+'"><span class="recent4-count">'+v+
  '</span><span class="recent4-rate'+(i<3&&ranks[i]?' recent4-rank-'+ranks[i]:'')+'">'+
  (Number.isFinite(rates[i])?Math.trunc(rates[i])+"%":"—")+'</span></td>').join("");
};
// SCR-210-style placing count, rate and rank highlighting, by road condition.
const roadCells=(p,i)=>
 statCells(p.roadRecord.good,roadGoodRanks[i],"auto-road-cell")+
 statCells(p.roadRecord.wet,roadWetRanks[i],"auto-road-cell");
const showDev=v=>v===null||v===undefined?"—":safe(v);
const deviationCell=p=>'<td class="col-t col-deviation" title="試走偏差（公式／Gamboo全R／Gamboo2連対）">'+
 '<div class="deviation-primary">'+safe(p.good10Diff)+'</div>'+
 '<div class="deviation-line"><span class="deviation-label">全R</span><span class="deviation-number">'+showDev(p.deviationNormal)+'</span></div>'+
 '<div class="deviation-line"><span class="deviation-label">2連対</span><span class="deviation-number">'+showDev(p.deviationTop2)+'</span></div>'+
 '</td>';
table.tBodies[0].innerHTML=players.map((p,i)=>{
  // 連対率: denominator = actual number of races in each window.
  const main='<td class="col-sha"><span class="frame-cell f'+(i+1)+'">'+(i+1)+'</span><span class="sha-nm">'+safe(p.short)+'</span></td>'+
  '<td class="col-name"><div class="rider-name">'+safe(p.name)+'</div><div class="rider-meta rider-home">'+safe(p.loc)+'</div><div class="rider-meta rider-age">'+p.ki+'期 '+p.age+'歳</div></td>'+
  '<td class="col-h">'+p.h+'</td><td class="col-t" title="平均ST">'+p.st+'</td>'+
  '<td class="col-t" title="当日試走タイム">'+safe(p.todayTrial)+'</td>'+
  deviationCell(p)+
  '<td class="col-rank"><span class="grade-current">'+safe(p.rank)+'</span><span class="grade-prev">前'+safe(p.prev)+'</span><span class="grade-power">'+safe(p.power)+'</span></td>'+
  '<td class="col-machine"><span class="machine-name">'+safe(p.car)+'</span><span class="machine-grade">'+safe(p.vehicleGrade)+'</span></td>';
  const fields=main+statCells(p.r10,recentRanks[i])+num([p.trial,p.avg,p.best])+statCells(p.r90,last90Ranks[i])+
  roadCells(p,i)+
  num(p.thisYear)+
  ['road','last90','good'].map((key,j)=>'<td class="auto-value'+(j===0?' auto-start':'')+'"><button type="button" class="item-btn auto-detail-button" data-report="'+key+'">'+["走路別","近90日","タイム"][j]+'</button></td>').join("");
  return '<tr data-vehicle="'+(i+1)+'" data-power="'+p.power+'">'+fields+'</tr>';
}).join("");
// Synchronize table drags, active menu and menu-strip position exactly as
// SCR-210: tap scrolls to a section; manual table scrolling follows the
// currently visible section, including automatic horizontal menu movement.
const menu=[...root.querySelectorAll(".race-menu-scroll .info-tab[data-target]")];
const menuScroller=root.querySelector(".race-menu-scroll .hscroll-inner");
const keys=menu.map(tab=>tab.dataset.target);
const tabsByKey=Object.fromEntries(menu.map(tab=>[tab.dataset.target,tab]));
const headingsByKey=Object.fromEntries(keys.map(key=>[
 key,key==="player"?table.tHead.querySelector(".col-name"):
 table.tHead.querySelector('tr:first-child th[data-group="'+key+'"]')
]));
const stickyColumnWidth=()=>table.tHead.querySelector(".col-sha")?.getBoundingClientRect().width||50;
const headingOffset=cell=>wrap.scrollLeft+cell.getBoundingClientRect().left-wrap.getBoundingClientRect().left;
const scrollBehavior=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches?"instant":"smooth";
let activeSection="",navigationTarget=null,selectedByUser=null;
function highlightHeader(key){
 table.tHead.querySelectorAll("th.section-selected").forEach(cell=>cell.classList.remove("section-selected"));
 const targets=key==="player"?[...table.tHead.rows[0].cells].slice(1,8):
 [...table.tHead.rows[0].querySelectorAll('th[data-group="'+key+'"]')];
 let offset=0;
 for(const heading of table.tHead.rows[0].querySelectorAll('th.auto-section[data-group]')){
   if(heading.dataset.group===key)
     targets.push(...[...table.tHead.rows[1].cells].slice(offset,offset+heading.colSpan));
   offset+=heading.colSpan;
 }
 targets.forEach(cell=>cell.classList.add("section-selected"));
}
function selectSection(key,animate=false){
 if(key===activeSection)return;
 activeSection=key;
 menu.forEach(tab=>tab.classList.toggle("active",tab.dataset.target===key));
 highlightHeader(key);
 const tab=tabsByKey[key];
 if(!tab||!menuScroller)return;
 const destination=key==="player"?0:Math.max(0,
   tab.offsetLeft-menuScroller.offsetLeft-Math.min(44,menuScroller.clientWidth/5));
 menuScroller.scrollTo({left:destination,behavior:animate?scrollBehavior:"instant"});
}
function navigateSection(key){
 const heading=headingsByKey[key];
 if(!heading)return;
 const maxLeft=Math.max(0,wrap.scrollWidth-wrap.clientWidth);
 const destination=key==="player"?0:Math.max(0,Math.min(maxLeft,
   headingOffset(heading)-stickyColumnWidth()));
 navigationTarget=destination;
 selectedByUser=key;
 selectSection(key,true);
 wrap.scrollTo({left:destination,behavior:scrollBehavior});
 if(Math.abs(wrap.scrollLeft-destination)<=2)navigationTarget=null;
}
function syncSection(){
 if(selectedByUser!==null)return;
 if(navigationTarget!==null){
   if(Math.abs(wrap.scrollLeft-navigationTarget)>2)return;
   navigationTarget=null;
 }
 const atRight=wrap.scrollWidth-wrap.clientWidth-wrap.scrollLeft<=12;
 const threshold=wrap.scrollLeft+stickyColumnWidth()+2;
 let key="player";
 if(atRight)key=keys[keys.length-1];
 else for(const next of keys.slice(1)){
   const heading=headingsByKey[next];
   if(heading&&threshold>=headingOffset(heading))key=next;
 }
 selectSection(key);
}
function unlockSection(){selectedByUser=null;navigationTarget=null;}
for(const tab of menu)tab.addEventListener("click",()=>navigateSection(tab.dataset.target));
wrap.addEventListener("pointerdown",unlockSection,{passive:true});
wrap.addEventListener("wheel",unlockSection,{passive:true});
wrap.addEventListener("touchstart",unlockSection,{passive:true});
wrap.addEventListener("scroll",syncSection,{passive:true});
window.addEventListener("resize",syncSection);
selectSection("player");
const sheet=root.querySelector(".sheet"),overlay=root.querySelector(".sheet-overlay");
const report={
 road:{title:"近180日・走路別成績",
 heads:["良1着","良2着","良3着","良着外","湿1着","湿2着","湿3着","湿着外"],
 values:p=>["good","wet"].flatMap(track=>{
   const counts=p.roadRecord[track],rates=statValues(counts);
   return counts.map((v,i)=>v+"（"+Math.trunc(rates[i])+"%）");
 })},
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
const body=table.tBodies[0],power=table.querySelector(".sort-power");
// Car numbers are fixed identifiers, not a sort control.
// The combined ランク / 審査P heading toggles between descending points and vehicle order.
power.addEventListener("click",()=>{const high=power.getAttribute("aria-pressed")!=="true";
 [...body.rows].sort((a,b)=>high?Number(b.dataset.power)-Number(a.dataset.power):Number(a.dataset.vehicle)-Number(b.dataset.vehicle))
 .forEach(tr=>body.appendChild(tr));power.setAttribute("aria-pressed",String(high));});
root.querySelector('.race-tab[data-race="9"]')?.addEventListener("click",e=>e.preventDefault());
root.querySelector('.race-tab[data-race="9"]')?.setAttribute("aria-current","true");
})();
