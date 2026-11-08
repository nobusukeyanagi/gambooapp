/* Shared column renderer for SCR-210 防府5R: section order and cells stay aligned. */
(() => {
  "use strict";
  const escape = (x) => String(x ?? "").replace(/&/g, "&amp;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const waku = [1,2,3,4,4,5,5,6,6];
  const legCss = {"追":"leg-chase","逃":"leg-escape","両":"leg-both"};
  // All mark symbols use the same outline and four shared text-backdrop tints.
  const markShapes = {
    "◎": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
    "○": '<circle cx="12" cy="12" r="9"/>',
    "△": '<path d="M12 3 L21 21 H3 Z"/>',
    "×": '<path d="M5 5 L19 19 M19 5 L5 19"/>'
  };
  const marker = (x) => {
    if (!x) return "";
    const shape = markShapes[x];
    const kind = {"◎":"mk-dbl","○":"mk-o","△":"mk-tri","×":"mk-x"}[x] || "";
    return shape
      ? '<span class="mk ' + kind + '" role="img" aria-label="' + escape(x) +
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
      sub("枠","c-waku player-section-start"),
      sub('<button type="button" class="car-line-sort" aria-pressed="false" aria-label="ライン順に並べ替え">車番</button>',"fx c-sha"),
      sub("選手名","c-name"),
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
  // Keep the original result glyph (including circled placings and 棄),
  // but map its numeric placing to a consistently filled square.
  const circledRanks = Object.fromEntries([
    ...Array.from("①②③④⑤⑥⑦⑧⑨", (glyph, i) => [glyph, i + 1]),
    ...Array.from("❶❷❸❹❺❻❼❽❾", (glyph, i) => [glyph, i + 1])
  ]);
  const placingClass = (result) => {
    const number = /^[1-9]$/.test(String(result)) ? Number(result) : circledRanks[result];
    const tone = number >= 1 && number <= 3 ? "race-rank-" + number : "race-rank-other";
    return tone + (Object.prototype.hasOwnProperty.call(circledRanks, result) ? " res-rank-circled" : "");
  };
  const raceCard = (record) => {
    // Always keep a result tile, even for unreported meeting days.
    if (!record) {
      return '<span class="res res-empty" aria-label="データなし">'+
        '<span class="res-placement"><span class="res-rank"></span>'+
        '<span class="res-notes"></span></span><span class="res-time"></span></span>';
    }
    const rank = String(record[0] ?? "");
    const time = String(record[1] ?? "");
    const note = String(record[2] || "").replace(/\s+/g, "");
    // Each mark (B, 捲, 差, ...) occupies one line to the right of the box.
    const notes = Array.from(note, char => '<span class="res-note">' + escape(char) + '</span>').join("");
    return '<span class="res"><span class="res-placement">'+
      '<span class="res-rank ' + placingClass(rank) + '">' + escape(rank) + '</span>'+
      '<span class="res-notes">' + notes + '</span></span>'+
      '<span class="res-time">' + escape(time) + '</span></span>';
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
  const renderRow = (DATA,rider,i,gMark,scoreRank,rateRanks,pointRanks,gRank) => {
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
      '<td class="position-stat position-current position-first'+
        (toneIndex?' position-tone-'+toneIndex:'')+'">'+escape(position.position)+'</td>'+
      buildCounts.join("")+
      switchCounts.map((count,k)=>'<td class="position-stat position-switch'+
        (k%4===0?' position-first':'')+(count===0?' position-zero':'')+
        '">'+escape(count)+'</td>').join("")+
      p.points.map((v,k)=>{
        const rank=pointRanks[k]||0;
        const label=rank
          ? '<span class="rank-number rank-tint-'+rank+'">'+escape(v)+'</span>'
          : escape(v);
        return '<td class="'+(k===0?"bl ":"")+'marutoku-value'+
          (k===3?" marutoku-total":"")+'">'+label+'</td>';
      }).join("")+
      '<td class="marutoku-mark">'+marker(p.mark)+'</td>'+
      '<td class="bl c-g"><span class="g-val'+(gRank?' rank-number rank-tint-'+gRank:'')+'">'+escape(rider.g)+'</span></td>'+
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
  // Competition ranks (1, 1, 3, ...): equal values share one rank and
  // one tint. All riders tied for a top-three rank receive that tint.
  const topThreeRanks = (values) => {
    const ranks=Array(values.length).fill(0);
    let previousValue;
    let rank=0;
    values.map((value,index)=>({index,value}))
      .filter(({value})=>Number.isFinite(value))
      .sort((a,b)=>b.value-a.value||a.index-b.index)
      .forEach(({index,value},order)=>{
        if(order===0||value!==previousValue)rank=order+1;
        if(rank<=3)ranks[index]=rank;
        previousValue=value;
      });
    return ranks;
  };
  const getScoreRanks=(riders)=>topThreeRanks(
    riders.map(rider=>Number(rider.score))
  );
  // Rank each of the three percentage columns by the source's full
  // precision (e.g., 20.8 outranks 20.6 even if both display as 20%).
  // Outside rate (fourth column) is intentionally not ranked.
  const getRecentRateRanks = (riders) => {
    const result=Array.from({length:riders.length},()=>[0,0,0]);
    for(let k=0;k<3;k++){
      const values=riders.map(rider=>{
        const value=rider.recent4Months?.rates?.[k];
        return value===undefined||value===null||value===""
          ? NaN : Number(value);
      });
      topThreeRanks(values).forEach((rank,index)=>{result[index][k]=rank;});
    }
    return result;
  };
  const toHTML = (DATA) => {
    const gMarks = getGMarks(DATA.basics);
    const scoreRanks=getScoreRanks(DATA.basics);
    const rateRanks=getRecentRateRanks(DATA.basics);
    const pointRanks=DATA.basics.map(()=>[0,0,0,0]);
    for(let k=0;k<4;k++){
      const values=DATA.marutoku.map(entry=>{
        const value=entry?.points?.[k];
        return value===undefined||value===null||value===""?NaN:Number(value);
      });
      topThreeRanks(values).forEach((rank,i)=>{pointRanks[i][k]=rank;});
    }
    const gRanks=topThreeRanks(DATA.basics.map(rider=>{
      const value=rider.g;
      return value===undefined||value===null||value===""?NaN:Number(value);
    }));
    return makeHead()+'<tbody>'+
      DATA.basics.map((r,i)=>renderRow(DATA,r,i,gMarks[i],scoreRanks[i],rateRanks[i],pointRanks[i],gRanks[i])).join("")+'</tbody>';
  };
  // The vehicle-number header toggles between numeric car order and
  // the full predicted lineup. Reordering existing <tr> nodes retains all
  // values, links and scroll positions without regenerating the racecard.
  const bindLineupSort = (table, DATA) => {
    const button = table.querySelector("thead .car-line-sort");
    const tbody = table.tBodies[0];
    const lines = Array.isArray(DATA.lineup) ? DATA.lineup : [];
    if (!button || !tbody || !lines.length) return;
    const rows = Array.from(tbody.rows);
    const carOf = (row) => Number(row.querySelector("td.c-sha .frame-cell")?.textContent?.trim());
    const byCar = new Map(rows.map(row => [carOf(row), row]));
    const lineupCars = lines.flat().map(Number);
    if (byCar.size !== rows.length || lineupCars.length !== rows.length ||
        lineupCars.some(car => !byCar.has(car)) ||
        new Set(lineupCars).size !== rows.length) return;

    const carOrder = [...byCar.keys()].sort((a,b) => a-b);
    let isLineupOrder = false;
    button.addEventListener("click", () => {
      isLineupOrder = !isLineupOrder;
      const orderedCars = isLineupOrder ? lineupCars : carOrder;
      orderedCars.forEach(car => tbody.appendChild(byCar.get(car)));
      rows.forEach(row => row.classList.remove("line-group-start"));
      if (isLineupOrder) {
        lines.slice(1).forEach(line => {
          const firstCar = Number(line[0]);
          byCar.get(firstCar)?.classList.add("line-group-start");
        });
      }
      button.setAttribute("aria-pressed", String(isLineupOrder));
      button.setAttribute("aria-label", isLineupOrder ? "車番順に戻す" : "ライン順に並べ替え");
    });
  };
  const render=(table,DATA)=>{
    if (!table || !DATA) return;
    table.innerHTML=toHTML(DATA);
    bindLineupSort(table,DATA);
  };
  window.GambooKeirinRacecardColumns={toHTML,render};
})();