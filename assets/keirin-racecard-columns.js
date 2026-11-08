/* Shared column renderer for SCR-210 防府5R: section order and cells stay aligned. */
(() => {
  "use strict";
  const escape = (x) => String(x ?? "").replace(/&/g, "&amp;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const waku = [1,2,3,4,4,5,5,6,6];
  const legCss = {"追":"leg-chase","逃":"leg-escape","両":"leg-both"};
  // All rank marks share one neutral stroke width and color rather than
  // relying on unequal glyph outlines and per-symbol font colors.
  const markShapes = {
    "◎": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
    "○": '<circle cx="12" cy="12" r="9"/>',
    "△": '<path d="M12 3 L21 21 H3 Z"/>',
    "×": '<path d="M5 5 L19 19 M19 5 L5 19"/>'
  };
  const marker = (x) => {
    if (!x) return "";
    const shape = markShapes[x];
    return shape
      ? '<span class="mk" role="img" aria-label="' + escape(x) +
        '"><svg class="mk-symbol" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        shape + '</svg></span>'
      : '<span class="mk">' + escape(x) + '</span>';
  };
  const placeGroups = ["ラインの先頭","2番手","3番手以降","単騎","競り"];
  const ranks = ["1着","2着","3着","着外"];
  // Section names live in the horizontal menu; only column headings remain.
  // Anchor each menu to the first column of its section.
  const sub = (label, klass) => '<th' + (klass ? ' class="' + klass + '"' : '') + '>' + label + '</th>';
  const makeHead = () => {
    const subheads = [
      sub("枠","c-waku player-section-start"),sub("車番","fx c-sha"),sub("選手名","c-name"),
      sub("級班","bl"),sub("脚質","bl"),sub("ギア比","bl"),
      sub("コメント","player-comment-heading"),
      ...["競走得点","失違","逃","捲","差","マ","B"].map((s,i)=>
        sub(s,i===0?"bl recent-section-start":(i===1?"bl":""))),
      ...[["1着","勝率"],["2着","2連対率"],["3着","3連対率"],["着外","着外率"]]
        .map(([placing, rate],i)=>sub(
          '<span class="recent4-heading-main">'+placing+'</span>'+
          '<span class="recent4-heading-rate">'+rate+'</span>',
          (i===0?"bl ":"")+"recent4-heading")),
      ...["今開催",...Array.from({length:7},(_,i)=>"直近"+(i+1)),"連対時<br>見なし上がり"].map((s,i)=>sub(s,i===0?"bl meeting-current-label meeting-section-start":"")),
      sub("並び","bl position-col position-current position-section-start"),
      ...placeGroups.flatMap(() => ranks.map((r,i)=>sub('<span class="position-result-name">'+r+'</span>','position-col'+(i===0?' position-first':'')))),
      ...["1着","2着","3着","着外"].map((label,i)=>
        sub(label,"position-col position-switch"+(i===0?" position-first":""))),
      ...["1着","2着","3着","着外"].map((label,i)=>
        sub(label,"position-col position-switch"+(i===0?" position-first":""))),
      ...["1着P","2着P","3着P","総合P","印"].map((label,i)=>
        sub(label,(i===0?"bl marutoku-section-start ":"")+
          "marutoku-score-label"+(i===4?" marutoku-mark-label":""))),
      sub("G指数","bl gindex-section-start"),
      sub("印","gindex-mark"),
      ...["周長","見なし<br>直線","レース<br>種別","レース<br>日程","グレ<br>ード","競輪場","車番","同県<br>選手"].map((label,i)=>
        sub('<button type="button" class="item-btn" data-item="'+i+'"><span>'+label+'</span></button>',
          'c-item'+(i===0?" bl mania-section-start mania-section-heading":""))),
      sub("総合","c-item mania-total")
    ];
    // Grouped first-row labels share the same physical columns as the
    // second-row labels. Un-grouped columns span both header rows.
    const groups = new Map([
      [9,  {span:4, label:"決まり手", klass:""}],
      [28, {span:4, label:"ラインの先頭", klass:"position-first"}],
      [32, {span:4, label:"2番手", klass:"position-first"}],
      [36, {span:4, label:"3番手以降", klass:"position-first"}],
      [40, {span:4, label:"単騎", klass:"position-first"}],
      [44, {span:4, label:"競り", klass:"position-first"}],
      [48, {span:4, label:"イン粘り回数", klass:"position-first"}],
      [52, {span:4, label:"追い上げ回数", klass:"position-first"}],
      [56, {span:5, label:"マル得ポイント", klass:"bl marutoku-section-start"}]
    ]);
    const top = [], lower = [];
    for (let i=0; i<subheads.length;) {
      const group = groups.get(i);
      if (group) {
        top.push('<th colspan="'+group.span+'" class="box-group '+
          group.klass+'">'+escape(group.label)+'</th>');
        lower.push(...subheads.slice(i, i+group.span));
        i += group.span;
      } else {
        top.push(subheads[i].replace('<th', '<th rowspan="2"'));
        i++;
      }
    }
    return '<thead><tr>'+top.join("")+'</tr><tr>'+lower.join("")+'</tr></thead>';
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
      return {date:month && day ? Number(month)+"/"+Number(day) : "—",venue:DATA.venue || "—",
        grade,kind:/^[GF]$/.test(grade[0]) ? grade[0].toLowerCase()+number : ""};
    }
    const match = String(period.date || "").match(/^(\d{1,2})\/(\d{1,2})\s+(.+?)([GF])([123])$/);
    if (!match) return {date:period.date || "—",venue:"—",grade:"—",kind:""};
    const [,month,day,code,kind,num] = match;
    return {date:Number(month)+"/"+Number(day),venue:venueNames[code] || code,grade:kind+romanGrade[num],
      kind:kind.toLowerCase()+num};
  };
  const raceCard = (record) => {
    // Render an explicit blank slot where a meeting day has no result.
    // Retaining .res makes the same 26px separators appear around empty days.
    if (!record) {
      return '<span class="res res-empty" aria-label="データなし">'+
        '<span class="res-note"></span><span class="res-rank"></span>'+
        '<span class="res-time"></span></span>';
    }
    // Three fixed-height rows: decision/B, placing, and time.
    const rank=record[0],time=record[1],
      note=String(record[2]||"").replace(/\s+/g,"");
    return '<span class="res"><span class="res-note">'+escape(note)+'</span>'+
      '<span class="res-rank">'+escape(rank)+'</span>'+
      '<span class="res-time">'+escape(time)+'</span></span>';
  };
  const renderMeeting = (period,index,DATA) => {
    // Keep the same five-area layout even if a meeting has no result data.
    const meeting=period||{date:"",results:[]};
    const meta=parseMeeting(meeting,index,DATA);
    const results=meeting.results||[];
    // Every meeting has four standard race-day cells, including blank ones.
    // Longer fixtures can specify meetingDays / scheduledDays / days even
    // before results arrive (e.g. a scheduled six-day meeting).
    const declaredDays=Number(meeting.meetingDays ?? meeting.scheduledDays ?? meeting.days);
    const scheduledDays=Number.isInteger(declaredDays)&&declaredDays>0?declaredDays:0;
    const slots=Array.from({length:Math.max(4,scheduledDays,results.length)},(_,i)=>raceCard(results[i]));
    return '<td class="res-cell meeting-cell'+(index===0?" bl":"")+'"><div class="meeting-entry">'+
      '<div class="meeting-meta">'+
      '<span class="grade-badge grade-'+escape(meta.kind)+'">'+escape(meta.grade)+'</span>'+
      '<span class="meeting-venue">'+escape(meta.venue)+'</span>'+
      '<span class="meeting-date">'+escape(meta.date)+'</span></div>'+
      '<div class="res-wrap">'+slots.join("")+'</div></div></td>';
  };
  const renderRow = (DATA,rider,i,gMark,scoreRank,rateRanks) => {
    const p=DATA.marutoku[i],position=DATA.positionStats.rows[i];
    const grade=rider.grade.split("/");
    // Display name / prefecture(home) / training class and age on three lines.
    const [home, cohort, age] = String(rider.meta || "").split("/");
    const prev=rider.history||[];
    const histories=Array.from({length:8},(_,x)=>
      prev[x]||(x===0?{date:"",results:rider.current}:x===1?{date:rider.prevDate,results:rider.previous}:null));
    const toneIndex={"先頭":1,"番手":2,"3番手":3,"単騎":4}[position.position]||0;
    const toneTag=(value)=>toneIndex
      ? '<span class="tone-tag tone-'+toneIndex+'">'+escape(value)+'</span>'
      : escape(value);
    const buildCounts=position.counts.map((v,k)=>{
      const group=Math.floor(k/4);
      const highlighted=(group===0&&position.position==="先頭")||
        (group===1&&position.position==="番手")||
        (group===2&&position.position==="3番手")||
        (group===3&&position.position==="単騎");
      const classes=["position-stat",k%4===0?"position-first":"",v===0?"position-zero":""].filter(Boolean);
      return '<td class="'+classes.join(" ")+'">'+(highlighted?toneTag(v):escape(v))+'</td>';
    });
    // Each switching action has its own 1st / 2nd / 3rd / outside counts.
    // switches[0] stores another mode; modes 1 and 2 are in-adhesion and follow-up.
    const switchCounts=[1,2].flatMap(mode=>
      Array.from({length:4},(_,index)=>Number(position.switches?.[mode]?.[index]??0)));
    return '<tr>'+
      '<td class="c-waku">'+waku[i]+'</td>'+
      '<td class="fx c-sha"><div class="frame-cell f'+rider.car+'">'+rider.car+
        '</div><span class="sha-nm">'+escape(rider.name.slice(0,3))+'</span></td>'+
      '<td class="c-name"><div class="rider-name">'+escape(rider.name)+
        '</div><div class="rider-meta rider-home">'+escape(home)+
        '</div><div class="rider-meta rider-age">'+escape(cohort)+'期 '+escape(age)+'歳</div></td>'+
      '<td class="bl cls"><span class="grade-current">'+escape(grade[0])+
        '</span><span class="grade-prev">前'+escape(grade[1] || "—")+'</span></td>'+
      '<td class="bl"><span class="leg-tag '+(legCss[rider.leg]||"leg-both")+'">'+escape(rider.leg)+'</span></td>'+
      '<td class="bl">'+escape(rider.gear||"—")+'</td>'+
      '<td class="player-comment">'+escape(p.comment)+'</td>'+
      '<td class="bl score"><span class="score-current'+(scoreRank?' score-rank-'+scoreRank:'')+'">'+escape(rider.score)+'</span>'+
        '<span class="score-previous">'+
        (rider.previousScore ? '前'+escape(rider.previousScore) : '前—')+
        '</span></td>'+
      rider.stats.map((v,k)=>'<td'+(k===0?' class="bl"':'')+'>'+escape(v)+'</td>').join("")+
      Array.from({length:4},(_,k)=>{
        const count=rider.recent4Months?.counts?.[k];
        const rate=rider.recent4Months?.rates?.[k];
        const rank=k<3?(rateRanks?.[k]||0):0;
        return '<td class="'+(k===0?"bl ":"")+'recent4-cell">'+
          '<span class="recent4-count">'+escape(count ?? "—")+'</span>'+
          '<span class="recent4-rate'+(rank?' recent4-rank-'+rank:'')+'">'+
          escape(rate === undefined || rate === null || rate === "" ? "—" : Math.trunc(Number(rate))+"%")+
          '</span></td>';
      }).join("")+
      histories.map((v,k)=>renderMeeting(v,k,DATA)).join("")+
      '<td class="meeting-cell meeting-avg">' + (rider.avgBest?.length === 2 ?
        '<span class="meeting-avg-line">平均' + escape(rider.avgBest[0]) + '</span>' +
        '<span class="meeting-avg-line">最高' + escape(rider.avgBest[1]) + '</span>' : "—") + "</td>" +
      '<td class="position-stat position-current position-first">'+toneTag(position.position)+'</td>'+
      buildCounts.join("")+
      switchCounts.map((count,k)=>'<td class="position-stat position-switch'+
        (k%4===0?' position-first':'')+(count===0?' position-zero':'')+
        '">'+escape(count)+'</td>').join("")+
      p.points.map((v,k)=>'<td class="'+(k===0?"bl ":"")+'marutoku-value'+
        (k===3?" marutoku-total":"")+
        (p.emphasis[k]?" marutoku-point-"+p.emphasis[k]:"")+'">'+escape(v)+'</td>').join("")+
      '<td class="marutoku-mark">'+marker(p.mark)+'</td>'+
      '<td class="bl c-g"><span class="g-val">'+escape(rider.g)+'</span></td>'+
      '<td class="gindex-mark">'+marker(gMark)+'</td>'+
      rider.ratings.items.map((v,k)=>'<td class="mania-eval'+(k===0?' bl':'')+
        '" data-item="'+k+'">'+marker(v)+'</td>').join("")+
      '<td class="mania-eval mania-total">'+marker(rider.ratings.overall)+'</td>'+
      '</tr>';
  };
  // Rank G-index values numerically, descending. The four highest riders
  // receive ◎, ○, △ and × respectively; all others have an empty mark.
  // In the event of equal values, retain the original rider order.
  const getGMarks = (riders) => {
    const marks = Array(riders.length).fill("");
    riders.map((rider, index) => ({
      index, text: String(rider.g ?? "").trim(), value: Number(rider.g)
    }))
      .filter(({text, value}) => text !== "" && Number.isFinite(value))
      .sort((a, b) => b.value - a.value || a.index - b.index)
      .slice(0, 4)
      .forEach(({index}, rank) => { marks[index] = ["◎","○","△","×"][rank]; });
    return marks;
  };
  // Current race scores in descending order, ties resolved by car number.
  const getScoreRanks=(riders)=>{
    const ranks=Array(riders.length).fill(0);
    riders.map((rider,index)=>({index,value:Number(rider.score)}))
      .filter(({value})=>Number.isFinite(value))
      .sort((a,b)=>b.value-a.value||a.index-b.index)
      .slice(0,3).forEach(({index},rank)=>{ranks[index]=rank+1;});
    return ranks;
  };
  // Rank each displayed percentage column independently; use car number to
  // break ties consistently. Outside rate (fourth column) is not ranked.
  const getRecentRateRanks = (riders) => {
    const result=Array.from({length:riders.length},()=>[0,0,0]);
    for(let k=0;k<3;k++){
      riders.map((rider,index)=>{
        const rate=rider.recent4Months?.rates?.[k];
        return {index,car:Number(rider.car),value:Math.trunc(Number(rate)),
          valid:rate!==undefined&&rate!==null&&rate!==""};
      })
        .filter(({value,valid})=>valid&&Number.isFinite(value))
        .sort((a,b)=>b.value-a.value||a.car-b.car||a.index-b.index)
        .slice(0,3)
        .forEach(({index},rank)=>{result[index][k]=rank+1;});
    }
    return result;
  };
  const toHTML = (DATA) => {
    const gMarks = getGMarks(DATA.basics);
    const scoreRanks=getScoreRanks(DATA.basics);
    const rateRanks=getRecentRateRanks(DATA.basics);
    return makeHead()+'<tbody>'+
      DATA.basics.map((r,i)=>renderRow(DATA,r,i,gMarks[i],scoreRanks[i],rateRanks[i])).join("")+'</tbody>';
  };
  const render=(table,DATA)=>{if(table&&DATA)table.innerHTML=toHTML(DATA);};
  window.GambooKeirinRacecardColumns={toHTML,render};
})();