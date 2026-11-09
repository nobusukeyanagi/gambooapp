/* Horizontal-only auto-fit for overflowing single-line text.
   Fonts, line heights, cell widths and horizontal scrollers are preserved. */
(() => {
  "use strict";
  const selector="body :is(span,small,strong,b,a,button,td,th,label,div,p)";
  const forced=".header-title-text,.fit-nav-label,.section-title,.vgroup-name";
  const widths=new Map(), states=new WeakMap();
  let queued=false;
  const meter=document.createElement("span");
  meter.setAttribute("aria-hidden","true");
  meter.style.cssText="position:fixed;left:-100000px;top:0;display:inline-block;visibility:hidden;pointer-events:none;white-space:nowrap;width:max-content;max-width:none;min-width:0;padding:0;margin:0;border:0;line-height:normal;z-index:-1";
  function naturalWidth(text,css) {
    const key=[css.fontFamily,css.fontSize,css.fontWeight,css.fontStyle,css.fontVariantNumeric,css.letterSpacing,css.wordSpacing,css.textTransform,text].join("\u0001");
    if(widths.has(key))return widths.get(key);
    meter.style.fontFamily=css.fontFamily;
    meter.style.fontSize=css.fontSize;
    meter.style.fontWeight=css.fontWeight;
    meter.style.fontStyle=css.fontStyle;
    meter.style.fontVariantNumeric=css.fontVariantNumeric;
    meter.style.letterSpacing=css.letterSpacing;
    meter.style.wordSpacing=css.wordSpacing;
    meter.style.textTransform=css.textTransform;
    meter.textContent=text;
    const width=meter.getBoundingClientRect().width;
    if(widths.size>2500)widths.clear();
    widths.set(key,width);
    return width;
  }
  function restore(el,s) {
    if(!s||s.inner.parentElement!==el)return;
    el.replaceChildren(document.createTextNode(s.text));
    el.style.whiteSpace=s.whiteSpace;
    el.style.overflow=s.overflow;
    states.delete(el);
  }
  function fit(el) {
    if(el===meter||meter.contains(el)||el.closest(".fit-text-inner"))return;
    const previous=states.get(el);
    if(previous&&previous.inner.parentElement!==el)states.delete(el);
    const state=states.get(el);
    if(!state&&el.childElementCount)return;
    const css=getComputedStyle(el);
    if(css.display==="none"||css.visibility==="hidden")return;
    const forcedLine=el.matches(forced);
    if(!forcedLine&&css.whiteSpace!=="nowrap")return;
    const text=state?state.text:el.textContent.trim();
    if(!text||!el.clientWidth)return;
    const room=el.clientWidth-(parseFloat(css.paddingLeft)||0)-(parseFloat(css.paddingRight)||0)-0.5;
    if(room<=1)return;
    if(!forcedLine&&!state&&el.scrollWidth<=el.clientWidth+1)return;
    const natural=naturalWidth(text,css);
    if(natural<=room+0.75){if(state)restore(el,state);return;}
    let current=state;
    if(!current){
      const inner=document.createElement("span");
      inner.className="fit-text-inner";
      inner.textContent=text;
      current={inner,text,whiteSpace:el.style.whiteSpace,overflow:el.style.overflow};
      states.set(el,current);
      el.replaceChildren(inner);
      el.style.whiteSpace="nowrap";
      if(forcedLine)el.style.overflow="hidden";
    }
    // Negative margin reclaims the layout space lost to scaleX.
    const ratio=Math.max(0.01,Math.min(1,room/natural));
    current.inner.style.cssText="display:inline-block;vertical-align:baseline;white-space:nowrap;font:inherit;letter-spacing:inherit;line-height:inherit;transform-origin:left center;max-width:none;min-width:0;width:"+natural.toFixed(3)+"px;margin-right:"+(room-natural).toFixed(3)+"px;transform:scaleX("+ratio.toFixed(6)+")";
  }
  function wrapNav(){
    for(const link of document.querySelectorAll(".bottom-tab .tab-item")){
      for(const node of [...link.childNodes]){
        if(node.nodeType!==Node.TEXT_NODE||!node.nodeValue.trim())continue;
        const label=document.createElement("span");
        label.className="fit-nav-label";
        label.textContent=node.nodeValue.trim();
        link.replaceChild(label,node);
      }
    }
  }
  function refresh(){
    wrapNav();
    for(const el of document.querySelectorAll(selector))fit(el);
  }
  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;refresh();});
  }
  function init(){
    document.body.appendChild(meter);
    refresh();
    new MutationObserver(records=>{
      if(records.some(r=>r.target!==meter&&!meter.contains(r.target)))schedule();
    }).observe(document.body,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:["class","hidden"]});
    if(typeof ResizeObserver!=="undefined"){
      const ro=new ResizeObserver(schedule);
      for(const el of document.querySelectorAll(".phone-inner,.shared-app-header,.bottom-tab"))ro.observe(el);
    }
    addEventListener("resize",schedule,{passive:true});
    if(document.fonts?.ready)document.fonts.ready.then(()=>{widths.clear();schedule();});
    window.GambooTextFit={refresh:schedule};
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
