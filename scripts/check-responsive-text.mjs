import { chromium } from "playwright";
const origin=process.env.CURRENT_URL||"http://127.0.0.1:4173";
const pages=[
  "SCR-100_bet.html","SCR-200_keirin.html","SCR-210_racecardkeirin.html",
  "SCR-300_autorace.html","SCR-310_racecardautorace.html",
  "SCR-400_campaign.html","SCR-500_mypage.html","index.html"
];
const browser=await chromium.launch({headless:true});
const failures=[];
for(const file of pages){
 const page=await browser.newPage({viewport:{width:296,height:900}});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto(origin+"/"+file,{waitUntil:"load"});
  for(const width of [296,375,768]){
   await page.setViewportSize({width,height:900});
   const value=await page.evaluate(async()=>{
    await document.fonts.ready;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const fitLoaded=!!window.GambooTextFit;
    const title=document.querySelector(".shared-app-header .header-title-text");
    const transformed=title?.querySelector(".fit-text-inner");
    const titleExtra=transformed?transformed.getBoundingClientRect().right-title.getBoundingClientRect().right:0;
    const actions=[...document.querySelectorAll(".shared-app-header .header-actions :is(.icon-btn,.cta-btn)")].map(x=>Math.round(x.getBoundingClientRect().width));
    const navCount=document.querySelectorAll(".bottom-tab .tab-item > .fit-nav-label").length;
    const sample=document.createElement("div");
    sample.style.cssText="position:fixed;top:0;left:0;z-index:-1;width:75px;white-space:nowrap;";
    sample.textContent="日本語長い見出し ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    document.body.appendChild(sample);
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const inner=sample.querySelector(".fit-text-inner");
    const fitted=!!inner && inner.getBoundingClientRect().width<=sample.clientWidth+1;
    const unchanged=sample.textContent==="日本語長い見出し ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    sample.remove();
    return {fitLoaded,actions,navCount,fitted,unchanged,titleExtra,
      title:title?.textContent?.trim()||null};
   });
   const label=file+" "+width+"px";
   if(!value.fitLoaded||!value.fitted||!value.unchanged)
    failures.push(label+" text fit unavailable, clipped or altered: "+JSON.stringify(value));
   if(file!=="index.html"){
    if(value.actions.join(",")!=="80,80"||value.navCount!==5||value.titleExtra>1)
     failures.push(label+" header/nav mismatch: "+JSON.stringify(value));
   }
   console.log(label,JSON.stringify(value));
  }
  if(errors.length)failures.push(file+" JS errors: "+JSON.stringify(errors));
 }catch(e){failures.push(file+" exception: "+e.message);}
 finally{await page.close();}
}
await browser.close();
if(failures.length){console.error(failures.join("\n"));process.exitCode=1;}
else console.log("Responsive horizontal text fitting verified on all 8 screens and entry page.");
