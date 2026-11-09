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
const last5RaceResults=[[["11/8","川口","良","5R予選","2","3.439","3.35","0.22","20",""],["11/7","川口","良","8R予選","1","3.452","3.37","0.21","20",""],["10/25","伊勢崎","湿","4R一般","2","3.729","3.66","0.12","0",""],["10/24","伊勢崎","湿","8R一般","4","3.732","3.66","0.08","0",""],["10/23","伊勢崎","良","1R予選","5","3.468","3.40","0.16","0",""]],[["11/8","川口","良","1R予選","4","3.460","3.36","0.29","30",""],["11/7","川口","良","3R予選","3","3.455","3.36","0.10","40",""],["11/4","川口","湿","6R選抜","2","3.923","3.78","0.19","20",""],["11/3","川口","良","5R準決","6","3.452","3.36","0.15","20",""],["11/2","川口","湿","7R予選","1","3.767","3.68","0.19","30",""]],[["11/8","川口","良","11R予選","4","3.431","3.33","0.39","30","戒"],["11/7","川口","良","4R予選","1","3.443","3.37","0.30","40",""],["11/2","浜松","湿","5R一般","自落","-","3.63","0.42","0",""],["11/1","浜松","良","3R一般","7","3.477","3.38","0.28","0",""],["10/31","浜松","斑","1R予選","8","3.513","3.40","0.26","0",""]],[["11/8","川口","良","2R予選","1","3.422","3.38","0.25","50",""],["11/7","川口","良","11R予選","1","3.424","3.34","0.25","40",""],["11/3","浜松","斑","3R一般","2","3.413","3.34","0.08","0",""],["11/2","浜松","湿","3R一般","6","3.832","3.61","0.09","0",""],["11/1","浜松","良","5R予選","6","3.435","3.35","0.09","0",""]],[["11/8","川口","良","4R予選","1","3.413","3.29","0.25","50",""],["11/7","川口","良","10R予選","2","3.408","3.33","0.26","40",""],["11/3","浜松","良","4R一般","5","3.426","3.33","0.08","0",""],["11/2","浜松","斑","1R一般","7","3.442","3.35","0.03","0",""],["11/1","浜松","良","11R予選","4","3.410","3.32","0.14","0",""]],[["11/8","川口","良","8R予選","2","3.414","3.34","0.18","40",""],["11/7","川口","良","5R予選","1","3.416","3.30","0.19","50",""],["11/3","浜松","良","11R特選","8","3.426","3.31","0.04","0",""],["11/2","浜松","湿","12R準決","","不成立","-","-","-",""],["11/1","浜松","良","5R予選","4","3.432","3.32","0.02","0",""]],[["11/8","川口","良","3R予選","2","3.419","3.32","0.15","50",""],["11/7","川口","良","8R予選","3","3.436","3.36","0.18","40",""],["11/3","浜松","良","10R選抜","7","3.445","3.37","0.05","0",""],["11/2","浜松","湿","9R準決","7","3.651","3.64","0.12","0",""],["11/1","浜松","良","8R予選","3","3.432","3.34","0.09","0",""]],[["11/8","川口","良","12R予選","2","3.398","3.33","0.24","40",""],["11/7","川口","良","10R予選","1","3.401","3.31","0.24","40",""],["11/2","浜松","湿","3R一般","3","3.716","3.66","0.36","0",""],["11/1","浜松","良","3R一般","3","3.442","3.35","0.20","0",""],["10/31","浜松","風","11R予選","5","3.448","3.37","0.16","0",""]]];
/* Highest race time within 90 days and its venue from the supplied
   2026-11-09 川口9R Gamboo supercomputer program3 (近90日), car order 1-8.
   This differs from the "良10走" fastest time already in raw[]. */
const best90Races=[
 ["3.439","川口"],["3.444","川口"],["3.418","飯塚"],["3.413","浜松"],
 ["3.408","川口"],["3.408","山陽"],["3.412","伊勢崎"],["3.398","川口"]
];
/* 2026-11-09 川口9R. Fixed race snapshot from the user-supplied
   スパコン直前予想 (良・走路温度:全) and スパコン前日予想.
   Columns: predicted finish (order), ◎/○/△/× (mark), predicted race
   time rounded to 3 decimals; strong point, form, passing/overtaking
   ability, escape ability, and starting ability from the day-before page.
   Row order is 1–8 (car number), independent of sorting. */
const superconForecast=[
 {order:1,mark:"◎",time:"3.724",strong:38.5,form:"up",handling:62,escape:69,start:54},
 {order:7,mark:"",time:"3.783",strong:34.8,form:"flat",handling:81,escape:78,start:40},
 {order:5,mark:"",time:"3.768",strong:42.6,form:"down",handling:59,escape:62,start:38},
 {order:6,mark:"",time:"3.768",strong:52.6,form:"flat",handling:71,escape:83,start:58},
 {order:3,mark:"△",time:"3.724",strong:49.1,form:"flat",handling:74,escape:78,start:45},
 {order:8,mark:"",time:"3.923",strong:56.9,form:"flat",handling:77,escape:88,start:58},
 {order:4,mark:"×",time:"3.736",strong:61.7,form:"flat",handling:90,escape:94,start:61},
 {order:2,mark:"○",time:"3.709",strong:63.8,form:"up",handling:91,escape:96,start:65}
];
const players=raw.map((a,i)=>({name:a[0],short:Array.from(a[0]).slice(0,3).join(""),loc:a[2],ki:a[3],age:a[4],todayTrial:raceDayTrials[i],
 rank:a[5],prev:a[6],car:a[7],h:a[8],st:a[9],good10Diff:a[10],
  deviationNormal:superconDeviations[i].normal,deviationTop2:superconDeviations[i].top2,
  power:a[11],
 r10:a[12],r90:a[13],best90:best90Races[i],trial:a[14],avg:a[15],best:a[16],
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

/* Grade follows the past meeting, not the individual rider or result.
   Use the same category names as SCR-210's grade badges. */
const last5Grade=(place,month,day)=>{
 const d=Number(day);
 if(place==="川口"&&month==="11"&&((d>=1&&d<=4)||(d>=7&&d<=10)))
   return ["普通","grade-normal"];
 if(place==="伊勢崎"&&month==="10"&&d>=21&&d<=25)
   return ["GⅡ","grade-g2"];
 if(place==="浜松"&&((month==="10"&&d>=29)||(month==="11"&&d<=3)))
   return ["SG","grade-sg"];
 return ["—","grade-unknown"];
};
const last5Headers=()=>["前走","2走前","3走前","4走前","5走前"]
 .map((label,index)=>'<th rowspan="2" data-group="last5" class="auto-last5-heading'+
 (index===0?' auto-start':'')+'">'+label+'</th>').join("");
/* Link to Gamboo's racecard for the historical race itself.
   Do not route the recent-race cards to the ticket window or official result. */
const placePid={"川口":"2","伊勢崎":"3","浜松":"4","飯塚":"5","山陽":"6"};
const last5Cells=playerIndex=>last5RaceResults[playerIndex].map((entry,index)=>{
 const [date,place,road,race,rank,finishTime,trialTime,st,handicap,flag]=entry;
 const [month,day]=date.split("/");
 const [grade,gradeClass]=last5Grade(place,month,day);
 const raceNo=/^(\d+)R/.exec(race)?.[1];
 const destination=raceNo&&placePid[place]?
  "https://gamboo.jp/autorace/program?pid="+placePid[place]+
  "&rdt=2026"+month.padStart(2,"0")+day.padStart(2,"0")+
  "&rno="+raceNo+"&pt=1":null;
 const abnormal=finishTime==="不成立"?"不成立":!/^[0-9]+$/.test(rank)?(rank||"—"):"";
 const result=abnormal?"-":rank;
 const rankClass=/^[1-3]$/.test(rank)?" auto-last5-rank-"+rank:"";
 const note=[abnormal,flag].filter(Boolean).join(" ");
 // One-digit/three-glyph notes occupy the same 30px width as the rank tile.
 // Only compress when necessary; full-width glyphs are approximately 12px.
 const noteUnits=Array.from(note).reduce((sum,ch)=>sum+(ch===" "?0.35:1),0);
 const noteScale=noteUnits>0?Math.min(1,29/(noteUnits*12)):1;
 const label=place+" "+date+" "+race+" "+road+"走路 "+(abnormal||rank||"-")+
  (flag?" "+flag:"")+" 競走T "+finishTime+" 試走T "+trialTime+" ST "+st+" H"+handicap;
 const numOrUnknown=value=>/^[0-9]+(?:\.[0-9]+)?$/.test(String(value))?
  '<strong class="auto-last5-number">'+safe(value)+'</strong>':
  '<span class="auto-last5-label">'+safe(value)+'</span>';
 const inner='<div class="auto-last5-entry">'+
  '<div class="auto-last5-meta"><span class="auto-last5-grade grade-badge '+gradeClass+'">'+grade+
  '</span><span class="auto-last5-venue">'+safe(place)+'</span><span class="auto-last5-date">'+safe(date)+'</span></div>'+
  '<div class="auto-last5-finish'+rankClass+'">'+
  '<span class="auto-last5-rank">'+safe(result)+'</span>'+
  '<span class="auto-last5-flag"><span class="auto-last5-flag-text" style="--note-scale:'+
  noteScale.toFixed(3)+'">'+safe(note)+'</span></span></div>'+
  '<div class="auto-last5-detail">'+
  '<div class="auto-last5-race">'+safe(race)+'</div>'+
  '<div class="auto-last5-data-row"><span class="auto-last5-label">試走</span>'+
  numOrUnknown(trialTime)+
  '<span class="auto-last5-group"><span class="auto-last5-label">H</span>'+
  numOrUnknown(handicap)+'</span>'+
  '<strong class="auto-last5-track">'+safe(road)+'</strong></div>'+
  '<div class="auto-last5-data-row"><span class="auto-last5-label">競</span>'+
  numOrUnknown(finishTime)+
  '<span class="auto-last5-group"><span class="auto-last5-label">ST</span>'+
  numOrUnknown(st)+'</span></div></div></div>';
 return '<td class="auto-last5-cell'+(index===0?' auto-start':'')+'">'+
  (destination?'<a href="'+destination+'" target="_blank" rel="noopener noreferrer" class="auto-last5-link" title="'+safe(label)+'" aria-label="'+safe(label)+'">'+inner+'</a>':inner)+'</td>';
}).join("");
/* Source: user-supplied Gamboo 2026-11-09 川口9R スパコン前日予想
   HTML "対戦成績表（近360日）". Each row is a vehicle 1–8 and each pair is
   [wins, losses] from the row rider's perspective. The symmetrical
   outcomes were checked across all 28 pairs; null is self matchup. */
const headToHead360=[
 [null,[0,1],[1,0],[0,5],[0,0],[4,2],[1,4],[0,2]],
 [[1,0],null,[0,2],[2,3],[1,2],[3,1],[0,1],[1,0]],
 [[0,1],[2,0],null,[1,3],[6,4],[2,3],[0,5],[1,4]],
 [[5,0],[3,2],[3,1],null,[0,4],[7,3],[3,7],[2,5]],
 [[0,0],[2,1],[4,6],[4,0],null,[4,1],[0,2],[0,4]],
 [[2,4],[1,3],[3,2],[3,7],[1,4],null,[4,6],[4,4]],
 [[4,1],[1,0],[5,0],[7,3],[2,0],[6,4],null,[4,6]],
 [[2,0],[0,1],[4,1],[5,2],[4,0],[4,4],[6,4],null]
];
const headToHeadHeaders=()=>Array.from({length:8},(_,i)=>
  '<th rowspan="2" data-group="matchup" class="auto-matchup-heading'+
  (i===0?' auto-start':'')+'" aria-label="対戦相手 車番'+(i+1)+'">'+
  '<span class="auto-matchup-heading-label">vs</span>'+
  '<span class="frame-cell f'+(i+1)+'">'+(i+1)+'</span></th>').join("");
const headToHeadCells=playerIndex=>headToHead360[playerIndex].map((record,j)=>{
 const wins=record?.[0],losses=record?.[1],total=wins+losses;
 const verified=playerIndex!==j&&Number.isInteger(wins)&&Number.isInteger(losses)&&
   wins>=0&&losses>=0;
 const score=verified?wins+'-'+losses:'—';
 const percent=verified&&total>0?Math.round(wins*100/total)+'%':'—';
 return '<td class="auto-matchup-cell'+(j===0?' auto-start':'')+
  '" title="'+(verified?'対戦成績：'+score+' 勝率：'+percent:'対戦成績未確認')+'">'+
  '<span class="auto-matchup-score">'+score+'</span>'+
  '<span class="auto-matchup-percent">'+percent+'</span></td>';
}).join("");
/* Descending competition ranking: tied values share the same rank.
   Only top three ranks receive the common gold/blue/bronze text background. */
const superconRanks=key=>{
 const ranks=Array(8).fill(0);
 const data=superconForecast.map((p,i)=>({i,value:p[key]}))
   .sort((a,b)=>b.value-a.value||a.i-b.i);
 let previous=null,rank=0;
 for(let i=0;i<data.length;i++){
  if(i===0||data[i].value!==previous)rank=i+1;
  if(rank<=3)ranks[data[i].i]=rank;
  previous=data[i].value;
 }
 return ranks;
};
const superconRanking={
 strong:superconRanks("strong"),handling:superconRanks("handling"),
 escape:superconRanks("escape"),start:superconRanks("start")
};
const superconNumber=(value,rank)=>'<span class="auto-sp-number'+
 (rank?' auto-sp-rank-'+rank:'')+'">'+safe(value)+'</span>';
const superconCells=i=>{
 const p=superconForecast[i];
 const formLabel={up:"上向き",flat:"横ばい",down:"下降"}[p.form];
 const formArrow={up:"↑",flat:"→",down:"↓"}[p.form];
 return '<td class="auto-sp-cell auto-sp-prediction auto-start">'+
    '<span class="auto-sp-mark">'+safe(p.mark)+'</span>'+
    '<span class="auto-sp-order">'+p.order+'着</span></td>'+
  '<td class="auto-sp-cell auto-sp-racetime">'+safe(p.time)+'</td>'+
  '<td class="auto-sp-cell">'+superconNumber(p.strong,superconRanking.strong[i])+'</td>'+
  '<td class="auto-sp-cell auto-sp-form" aria-label="調子 '+formLabel+
    '" title="調子 '+formLabel+'"><span class="auto-sp-form-'+p.form+'">'+formArrow+'</span></td>'+
  '<td class="auto-sp-cell auto-sp-handling">'+superconNumber(p.handling,superconRanking.handling[i])+'</td>'+
  '<td class="auto-sp-cell auto-sp-escape">'+superconNumber(p.escape,superconRanking.escape[i])+'</td>'+
  '<td class="auto-sp-cell">'+superconNumber(p.start,superconRanking.start[i])+'</td>';
};
/* Source: uploaded 2026-11-09 川口9R Gamboo
   「データ解析の予想印」 HTML. Eight categories: total first,
   followed by the seven data-lab analyses. The source only includes
   marks and links to detail pages, not their numerical detail tables.
   Therefore no numerical results or rankings are invented here.
   ハンデ and スパコン columns from the source are deliberately excluded. */
const analyzerCategories=[
 {name:"総合",label:"総合",path:null},
 {name:"走路状況",label:"走路状況",condition:"濡走路",path:"situation"},
 {name:"走路温度",label:"走路温度",condition:"20℃未満",path:"roadtemp"},
 {name:"試走タイム",label:"試走タイム",condition:"試走T順位",path:"trialrun"},
 {name:"レース場",label:"レース場",condition:"川口",path:"place"},
 {name:"競走車",label:"競走車",path:"motorcycle"},
 {name:"レース種別・日程",label:"レース種別／日程",path:"raceclass"},
 {name:"勝ち上がり・優勝戦",label:"勝ち上がり／優勝戦",path:"racewin"}
];
const analyzerMarks=[
 ["○","△","","◎","△","","",""],
 ["×","◎","○","","○","○","×",""],
 ["","","","","","","",""],
 ["","","","","","","◎","×"],
 ["","","","×","","","",""],
 ["","","△","","","△","○","△"],
 ["◎","○","◎","○","◎","◎","△","○"],
 ["△","×","×","△","×","×","","◎"]
];
const analyzerSourceBase="https://gamboo.jp/autorace/analyzer/";
const analyzerSourceQuery="?rdt=20261109&rno=9&pid=2&rsp=3&rspl=02&rsrt=1&rsst=1";
const analyzerSourceUrl=entry=>analyzerSourceBase+
 (entry.path?entry.path+"/program":"marklist/")+analyzerSourceQuery;
const analyzerHeaders=()=>analyzerCategories.map((entry,index)=>
 '<th rowspan="2" class="auto-analyzer-heading'+(index===0?' auto-start':'')+
 '" data-group="analyzer"'+(index===0?' data-analyzer-first="true"':'')+'>'+
 '<button type="button" class="item-btn auto-analyzer-btn" data-analyzer-item="'+index+
 '" aria-label="'+safe(entry.name)+'の詳細を表示">'+safe(entry.label)+'</button></th>').join("");
const analyzerCells=playerIndex=>analyzerMarks[playerIndex].map((value,index)=>
 '<td class="auto-analyzer-cell'+(index===0?' auto-start':'')+
 '" aria-label="'+safe(analyzerCategories[index].name)+': '+(value||"印なし")+'">'+
 '<span class="auto-analyzer-mark">'+safe(value)+'</span></td>').join("");
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
'<th rowspan="2" class="auto-titles-column">優出・優勝</th>'+
last5Headers()+statHeaderGroup("recent")+timeHeader("平均","試走T",true)+
timeHeader("平均","競走T",false)+timeHeader("最高","競走T",false)+
statHeaderGroup("last90")+
'<th rowspan="2" class="auto-best90-heading" data-group="last90">最高競走T</th>'+
roadHeaders()+headToHeadHeaders()+
'<th rowspan="2" data-group="supercon" class="auto-supercon-heading auto-start">予想着順</th>'+
'<th rowspan="2" data-group="supercon" class="auto-supercon-heading">予想競走T</th>'+
'<th rowspan="2" data-group="supercon" class="auto-supercon-heading">ストロングP</th>'+
'<th rowspan="2" data-group="supercon" class="auto-supercon-heading auto-sp-h-short">調子</th>'+
'<th rowspan="2" data-group="supercon" class="auto-supercon-heading auto-sp-h-short">捌き力</th>'+
'<th rowspan="2" data-group="supercon" class="auto-supercon-heading auto-sp-h-short">逃げ力</th>'+
'<th rowspan="2" data-group="supercon" class="auto-supercon-heading">スタート力</th>'+
analyzerHeaders()+'</tr>';
const sub=(labels)=>labels.map((v,i)=>th(v,i===0?"auto-start":"")).join("");
const subhead='<tr></tr>';
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
/* Small average starting time / trial time are better. Competition ranking
   handles ties consistently with existing top-3 percentage highlights. */
const topTimeRanks=selector=>{
 const ranks=players.map(()=>0);
 let previous=NaN,rank=0;
 players.map((p,index)=>({index,value:Number(selector(p))}))
  .filter(item=>Number.isFinite(item.value))
  .sort((a,b)=>a.value-b.value||a.index-b.index)
  .forEach(({index,value},order)=>{
    if(order===0||value!==previous)rank=order+1;
    if(rank<=3)ranks[index]=rank;
    previous=value;
  });
 return ranks;
};
const stRanks=topTimeRanks(p=>p.st),trialRanks=topTimeRanks(p=>p.todayTrial);
const highlightedTime=(value,rank)=>'<span class="auto-top-time'+
 (rank?' auto-top-time-'+rank:'')+'">'+safe(value)+'</span>';
const best90Cell=p=>'<td class="auto-best90-cell">'+
 '<span class="auto-best90-time">'+safe(p.best90[0])+'</span>'+
 '<span class="auto-best90-venue">'+safe(p.best90[1])+'</span></td>';
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
const titlesCell=p=>'<td class="auto-titles-column auto-titles-cell">'+
 ["今年優出","今年優勝","通算優勝"].map((name,i)=>
 '<div class="auto-titles-line"><span class="auto-titles-label">'+name+
 '</span><span class="auto-titles-count">'+safe(p.thisYear[i])+'</span></div>').join("")+
 '</td>';
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
  '<td class="col-h">'+p.h+'</td><td class="col-t" title="平均ST">'+
  highlightedTime(p.st,stRanks[i])+'</td>'+
  '<td class="col-t" title="当日試走タイム">'+
  highlightedTime(p.todayTrial,trialRanks[i])+'</td>'+
  deviationCell(p)+
  '<td class="col-rank"><span class="grade-current">'+safe(p.rank)+'</span><span class="grade-prev">前'+safe(p.prev)+'</span><span class="grade-power">'+safe(p.power)+'</span></td>'+
  '<td class="col-machine"><span class="machine-name">'+safe(p.car)+'</span><span class="machine-grade">'+safe(p.vehicleGrade)+'</span></td>';
  const fields=main+titlesCell(p)+last5Cells(i)+
  statCells(p.r10,recentRanks[i])+num([p.trial,p.avg,p.best])+
  statCells(p.r90,last90Ranks[i])+best90Cell(p)+roadCells(p,i)+
  headToHeadCells(i)+superconCells(i)+analyzerCells(i);
  return '<tr data-vehicle="'+(i+1)+'" data-power="'+p.power+'">'+fields+'</tr>';
}).join("");
/* SCR-210-style analysis sheets. Each item opens its own real source
   marks for all eight entrants; the category's separate source page is
   linked for numerical breakdowns absent from this uploaded marklist. */
const analyzerSheet=root.querySelector(".auto-analyzer-sheet");
const analyzerOverlay=root.querySelector(".auto-analyzer-overlay");
let analyzerOpenedBy=null;
function closeAnalyzer(){
 if(!analyzerSheet||analyzerSheet.hidden)return;
 analyzerSheet.hidden=true;
 analyzerOverlay.hidden=true;
 analyzerOpenedBy?.focus({preventScroll:true});
 analyzerOpenedBy=null;
}
function openAnalyzer(index,button){
 const entry=analyzerCategories[index];
 if(!entry||!analyzerSheet||!analyzerOverlay)return;
 analyzerOpenedBy=button;
 analyzerSheet.querySelector(".sheet-title").textContent=
  index===0?"データ解析ラボ：総合":"データ解析ラボ："+entry.name;
 const head=analyzerSheet.querySelector(".detail-table thead");
 const tbody=analyzerSheet.querySelector(".detail-table tbody");
 const markHeader=value=>'<th>'+safe(value)+'</th>';
 // Total shows all seven factor marks. Individual views show the
 // selected factor and the overall mark side by side.
 head.innerHTML='<tr><th class="dt-vehicle">車番</th><th class="auto-analyzer-detail-name">選手名</th>'+
  (index===0?analyzerCategories.map(x=>markHeader(x.name)).join(""):
   markHeader(entry.name)+markHeader("総合"))+'</tr>';
 tbody.innerHTML=players.map((p,car)=>{
   const vehicle='<td class="dt-vehicle"><span class="frame-cell f'+(car+1)+
    '">'+(car+1)+'</span><span class="sha-nm">'+safe(p.short)+'</span></td>';
   const name='<td class="auto-analyzer-detail-name">'+safe(p.name)+'</td>';
   const values=index===0?analyzerMarks[car]:[analyzerMarks[car][index],analyzerMarks[car][0]];
   return '<tr>'+vehicle+name+values.map(v=>
    '<td class="auto-analyzer-detail-mark">'+safe(v)+'</td>').join("")+'</tr>';
 }).join("");
 const note=analyzerSheet.querySelector(".auto-analyzer-source-note");
 note.textContent="添付HTMLに収録された印を表示しています。"+
  "項目別の詳細成績値は元HTMLに含まれないため、元データの詳細ページをご参照ください。";
 const link=analyzerSheet.querySelector(".auto-analyzer-source-link");
 link.href=analyzerSourceUrl(entry);
 link.textContent="Gambooの"+entry.name+"の詳細を見る";
 analyzerSheet.hidden=false;
 analyzerOverlay.hidden=false;
 analyzerSheet.querySelector(".sheet-close").focus({preventScroll:true});
}
table.tHead.querySelectorAll(".auto-analyzer-btn").forEach(button=>{
 button.addEventListener("click",()=>{
  const index=Number(button.dataset.analyzerItem);
  openAnalyzer(index,button);
 });
});
analyzerSheet?.querySelector(".sheet-close").addEventListener("click",closeAnalyzer);
analyzerSheet?.querySelector(".sheet-handle").addEventListener("click",closeAnalyzer);
analyzerOverlay?.addEventListener("click",closeAnalyzer);
analyzerSheet?.querySelector(".sheet-body").addEventListener("scroll",event=>
 analyzerSheet.classList.toggle("scrolled",event.currentTarget.scrollLeft>1),{passive:true});
document.addEventListener("keydown",event=>{
 if(event.key==="Escape"&&!analyzerSheet?.hidden)closeAnalyzer();
});
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
 const targets=key==="player"?[...table.tHead.rows[0].cells].slice(1,9):
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
const body=table.tBodies[0],power=table.querySelector(".sort-power");
// Car numbers are fixed identifiers, not a sort control.
// The combined ランク / 審査P heading toggles between descending points and vehicle order.
power.addEventListener("click",()=>{const high=power.getAttribute("aria-pressed")!=="true";
 [...body.rows].sort((a,b)=>high?Number(b.dataset.power)-Number(a.dataset.power):Number(a.dataset.vehicle)-Number(b.dataset.vehicle))
 .forEach(tr=>body.appendChild(tr));power.setAttribute("aria-pressed",String(high));});
root.querySelector('.race-tab[data-race="9"]')?.addEventListener("click",e=>e.preventDefault());
root.querySelector('.race-tab[data-race="9"]')?.setAttribute("aria-current","true");
})();
