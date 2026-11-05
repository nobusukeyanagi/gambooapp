/* Shared column renderer for SCR-03 防府5R: section order and cells stay aligned. */
(() => {
  "use strict";
  const escape = (x) => String(x ?? "").replace(/&/g, "&amp;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const waku = [1,2,3,4,4,5,5,6,6];
  const legCss = {"追":"leg-chase","逃":"leg-escape","両":"leg-both"};
  const marker = (x) => !x ? "" :
    '<span class="mk ' + ({"◎":"mk-dbl","○":"mk-o","△":"mk-tri","×":"mk-x"}[x]||"") +
    '">' + escape(x) + '</span>';
  const placeGroups = ["ラインの先頭","2番手","3番手以降","単騎","競り"];
  const ranks = ["1着","2着","3着","着外"];
  // Section names live in the horizontal menu; only column headings remain.
  // Anchor each menu to the first column of its section.
  const sub = (label, klass) => '<th' + (klass ? ' class="' + klass + '"' : '') + '>' + label + '</th>';
  const makeHead = () => {
    const subheads = [
      sub("枠","c-waku player-section-start"),sub("車番","fx c-sha"),sub("選手名","c-name"),
      sub("級班","bl"),sub("脚質","bl"),sub("ギア比","bl"),
      ...["1着P","2着P","3着P","総合P","印"].map((s,i)=>sub(s,(i===0?"bl marutoku-section-start ":"")+"marutoku-score-label")),
      sub("選手コメント","bl marutoku-comment-heading"),
      ...["競走得点","失違","逃","捲","差","マ","B","勝","2連対","3連対","着外"].map((s,i)=>
        sub(s,i===0?"bl recent-section-start":(i===1||i===7?"bl":""))),
      ...["今開催",...Array.from({length:7},(_,i)=>"直近"+(i+1)),"連対時<br>見なし上がり"].map((s,i)=>sub(s,i===0?"bl meeting-current-label meeting-section-start":"")),
      sub("並び","bl position-col position-current position-section-start"),
      ...placeGroups.flatMap((g)=>ranks.map((r,i)=>sub('<span class="position-group-name">'+escape(g)+'</span><span class="position-result-name">'+r+'</span>','position-col'+(i===0?' position-first':'')))),
      sub("イン粘り<br>回数","bl position-col position-count"),
      sub("追い上げ<br>回数","position-col position-count"),
      sub("G指数","bl gindex-section-start"),
      sub("総合<br>評価","bl c-item mania-section-start mania-section-heading"),
      ...["周長","見なし<br>直線","レース<br>種別","レース<br>日程","グレード","競輪場","車番","同県選手"].map((s,i)=>
        sub('<button type="button" class="item-btn" data-item="'+i+'">'+s+'</button>','c-item'+(i===0?" bl":"")))
    ];
    return '<thead><tr>'+subheads.join("")+'</tr></thead>';
  };
  // Expand one-letter venue codes to their full keirin-track names.
  const venueNames = {
    "四":"四日市","玉":"玉野","青":"青森","宮":"大宮","垣":"大垣",
    "前":"前橋","知":"高知","小":"小倉","別":"別府","岐":"岐阜",
    "豊":"豊橋","奈":"奈良","熊":"熊本","塚":"平塚","川":"川崎",
    "武":"武雄","弥":"弥彦","閣":"京王閣","園":"西武園","戸":"松戸",
    "立":"立川","富":"富山","阪":"松阪","伊":"伊東温泉","函":"函館",
    "名":"名古屋","宇":"宇都宮","防":"防府"
  };
  const romanGrade = {"1":"Ⅰ","2":"Ⅱ","3":"Ⅲ"};
  const parseMeeting = (period, index, DATA) => {
    if (index === 0) {
      const [,month,day] = String(DATA.date || "").match(/^\d{4}-(\d{2})-(\d{2})$/) || [];
      const grade = String(DATA.grade || "");
      const number = {"Ⅰ":"1","Ⅱ":"2","Ⅲ":"3"}[grade.slice(1)] || "";
      return {date:month && day ? month+"/"+day : "—",venue:DATA.venue || "—",
        grade,kind:/^[GF]$/.test(grade[0]) ? grade[0].toLowerCase()+number : ""};
    }
    const match = String(period.date || "").match(/^(\d{1,2}\/\d{2})\s+(.+?)([GF])([123])$/);
    if (!match) return {date:period.date || "—",venue:"—",grade:"—",kind:""};
    const [,date,code,kind,num] = match;
    return {date,venue:venueNames[code] || code,grade:kind+romanGrade[num],
      kind:kind.toLowerCase()+num};
  };
  const raceCard = (record) => {
    // Three fixed-height rows: decision/B on top, placing second, time last.
    // Keep the empty top row so every result is vertically aligned.
    const rank=record[0],time=record[1],
      note=String(record[2]||"").replace(/\s+/g,"");
    return '<span class="res"><span class="res-note">'+escape(note)+'</span>'+
      '<span class="res-rank">'+escape(rank)+'</span>'+
      '<span class="res-time">'+escape(time)+'</span></span>';
  };
  const renderMeeting = (period,index,DATA) => {
    if(!period || (!period.results?.length && !period.date))
      return '<td class="res-cell meeting-cell'+(index===0?" bl":"")+'">—</td>';
    const meta=parseMeeting(period,index,DATA);
    return '<td class="res-cell meeting-cell'+(index===0?" bl":"")+'"><div class="meeting-entry">'+
      '<div class="meeting-meta">'+
      '<span class="meeting-date">'+escape(meta.date)+'</span>'+
      '<span class="grade-badge grade-'+escape(meta.kind)+'">'+escape(meta.grade)+'</span>'+
      '<span class="meeting-venue">'+escape(meta.venue)+'</span></div>'+
      '<div class="res-wrap">'+(period.results||[]).map(raceCard).join("")+'</div></div></td>';
  };
  const renderRow = (DATA,rider,i) => {
    const p=DATA.marutoku[i],position=DATA.positionStats.rows[i];
    const grade=rider.grade.split("/");
    // Display name / prefecture(home) / training class and age on three lines.
    const [home, cohort, age] = String(rider.meta || "").split("/");
    const prev=rider.history||[];
    const histories=Array.from({length:8},(_,x)=>
      prev[x]||(x===0?{date:"",results:rider.current}:x===1?{date:rider.prevDate,results:rider.previous}:null));
    const emphasis=position.position==="先頭"?"position-highlight-lead":
      position.position==="番手"?"position-highlight-follow":"position-highlight-other";
    const buildCounts=position.counts.map((v,k)=>{
      const group=Math.floor(k/4);
      const highlighted=(group===0&&position.position==="先頭")||
        (group===1&&position.position==="番手")||
        (group===2&&position.position==="3番手")||
        (group===3&&position.position==="単騎");
      const classes=["position-stat",k%4===0?"position-first":"",v===0?"position-zero":"",highlighted?emphasis:""].filter(Boolean);
      return '<td class="'+classes.join(" ")+'">'+escape(v)+'</td>';
    });
    const totals=[1,2].map(mode=>position.switches[mode].reduce((sum,n)=>sum+Number(n||0),0));
    return '<tr>'+
      '<td class="c-waku">'+waku[i]+'</td>'+
      '<td class="fx c-sha"><div class="frame-cell f'+rider.car+'">'+rider.car+
        '</div><span class="sha-nm">'+escape(rider.name.slice(0,3))+'</span></td>'+
      '<td class="c-name"><div class="rider-name">'+escape(rider.name)+
        '</div><div class="rider-meta rider-home">'+escape(home)+
        '</div><div class="rider-meta rider-age">'+escape(cohort)+'期 '+escape(age)+'歳</div></td>'+
      '<td class="bl cls">'+escape(grade[0])+'<small>/'+escape(grade[1])+'</small></td>'+
      '<td class="bl"><span class="leg-tag '+(legCss[rider.leg]||"leg-both")+'">'+escape(rider.leg)+'</span></td>'+
      '<td class="bl">'+escape(rider.gear||"—")+'</td>'+
      p.points.map((v,k)=>'<td class="'+(k===0?"bl ":"")+'marutoku-value'+
        (p.emphasis[k]?" marutoku-point-"+p.emphasis[k]:"")+'">'+escape(v)+'</td>').join("")+
      '<td class="marutoku-mark">'+marker(p.mark)+'</td>'+
      '<td class="bl marutoku-comment">'+escape(p.comment)+'</td>'+
      '<td class="bl score">'+escape(rider.score)+'</td>'+
      rider.stats.map((v,k)=>'<td'+(k===0||k===6?' class="bl"':'')+'>'+escape(v)+'</td>').join("")+
      histories.map((v,k)=>renderMeeting(v,k,DATA)).join("")+
      '<td class="meeting-cell meeting-avg">' + (rider.avgBest?.length === 2 ?
        '<span class="meeting-avg-line">平均' + escape(rider.avgBest[0]) + '</span>' +
        '<span class="meeting-avg-line">最高' + escape(rider.avgBest[1]) + '</span>' : "—") + "</td>" +
      '<td class="position-stat position-current position-first '+emphasis+'">'+escape(position.position)+'</td>'+
      buildCounts.join("")+
      '<td class="position-stat position-count bl">'+totals[0]+'</td>'+
      '<td class="position-stat position-count">'+totals[1]+'</td>'+
      '<td class="bl c-g"><span class="g-val">'+escape(rider.g)+'</span></td>'+
      '<td class="mania-eval bl">'+marker(rider.ratings.overall)+'</td>'+
      rider.ratings.items.map((v,k)=>'<td class="mania-eval'+(k===0?' bl':'')+
        '" data-item="'+k+'">'+marker(v)+'</td>').join("")+
      '</tr>';
  };
  const toHTML=DATA=>makeHead()+'<tbody>'+DATA.basics.map((r,i)=>renderRow(DATA,r,i)).join("")+'</tbody>';
  const render=(table,DATA)=>{if(table&&DATA)table.innerHTML=toHTML(DATA);};
  window.GambooKeirinRacecardColumns={toHTML,render};
})();