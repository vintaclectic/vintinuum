#!/usr/bin/env node
/* verify-soil-band.js — THE FORCED-VISIBLE PROOF (AETHERHOLD 2026-08-08)
   ────────────────────────────────────────────────────────────────────────────
   WHY THIS EXISTS SEPARATELY FROM verify-no-collision.js.

   The soil band (#cvBand, body/world/covenants-hud.js) is the surface that keeps
   the covenant feature's central promise: a player must ALWAYS be able to read
   what ground they are on and what it can cost them. It only paints when the
   server has answered `world:soil`, which needs a live authenticated socket — so
   in the standard sweep it is `display:none` and the sweep passes it trivially.
   A clean run there proves only that a HIDDEN element is harmless.

   This forces the band visible with WORST-CASE content (longest label + a 5-digit
   carry + every escalation class at once) and asserts it collides with nothing and
   overflows nothing, at all five breakpoints, in both auth states.

   It caught two real bugs that the standard sweep could not see:
     · the original `left:50%; translateX(-50%)` centring landed 30-52px on top of
       #editHeadBtn at 320/375/414px (a centred box cannot clear two corner stacks
       of different widths);
     · the first fix trusted `--vint-dock-reach-top`, which is 0px on this page
       because #editHeadBtn is draggable and never dock-registered — collapsing the
       guard to nothing. The reserve is now max(measured, real reach).

   It applies the SAME exemptions as the canonical verifier (>=90% viewport is a
   designed overlay; an unpainted wrapper is measured through to its children), so
   it is neither laxer nor stricter than the law it enforces.

   USAGE:  node scripts/verify-soil-band.js
   Exits non-zero on any collision or overflow, so it can gate a commit.
*/
const path=require('path'), fs=require('fs'), http=require('http');
const puppeteer=require('/home/vinta/vintinuum-api/node_modules/puppeteer');
const ROOT=path.resolve('/home/vinta/vintinuum');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const srv=http.createServer((rq,rs)=>{let p=decodeURIComponent(rq.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){rs.writeHead(404);return rs.end();}
 rs.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(rs);});
(async()=>{
 await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
 const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 let fails=0;
 for (const w of [320,375,768,1280,1920]) {
  for (const auth of ['guest','signed']) {
   const pg=await b.newPage(); await pg.setViewport({width:w,height:w<500?667:900});
   if(auth==='signed') await pg.evaluateOnNewDocument(()=>{localStorage.setItem('vint_access_token','test.tok.tok');});
   pg.on('pageerror',()=>{});
   await pg.goto(`http://127.0.0.1:${port}/world.html`,{waitUntil:'domcontentloaded',timeout:30000});
   await new Promise(r=>setTimeout(r,3500));
   // Force the band on with the WORST-CASE content (longest label + 5-digit carry)
   const res=await pg.evaluate(()=>{
     const el=document.getElementById('cvBand');
     if(!el) return {missing:true};
     el.querySelector('.cv-txt').textContent='the commons · nothing can be taken here';
     el.querySelector('.cv-num').textContent='99999';
     el.classList.add('show','march','risk','heavy');
     const vis=n=>{const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'||+s.opacity===0)return false;
       const r=n.getBoundingClientRect();return r.width>1&&r.height>1&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth;};
     // CANONICAL RULES, matching scripts/verify-no-collision.js exactly, so this
     // probe is neither laxer nor stricter than the law it enforces:
     //  · a >=90% x >=90% viewport element is a DESIGNED overlay (#stage, scrims)
     //  · an element with no painted surface of its own and no direct text is a
     //    bare layout wrapper (#dvRail) and is measured through to its children
     const vw=innerWidth, vh=innerHeight;
     const painted=n=>{const cs=getComputedStyle(n);
       const ownText=[...n.childNodes].filter(x=>x.nodeType===3).map(x=>x.nodeValue).join('').trim();
       if(cs.backgroundColor==='rgba(0, 0, 0, 0)'&&cs.backgroundImage==='none'&&cs.borderStyle==='none'&&cs.boxShadow==='none'&&!ownText)return false;
       return true;};
     const fixed=[...document.querySelectorAll('body *')].filter(n=>{
       if(getComputedStyle(n).position!=='fixed'||!vis(n))return false;
       const r=n.getBoundingClientRect();
       if(r.width>=vw*0.9&&r.height>=vh*0.9)return false;   // designed overlay
       return painted(n);});
     const br=el.getBoundingClientRect();
     const hits=[];
     for(const n of fixed){
       if(n===el||el.contains(n)||n.contains(el))continue;
       const r=n.getBoundingClientRect();
       const ox=Math.min(br.right,r.right)-Math.max(br.left,r.left);
       const oy=Math.min(br.bottom,r.bottom)-Math.max(br.top,r.top);
       if(ox>1&&oy>1) hits.push({id:n.id||n.className||n.tagName,ox:Math.round(ox),oy:Math.round(oy)});
     }
     return {rect:{l:Math.round(br.left),r:Math.round(br.right),t:Math.round(br.top),b:Math.round(br.bottom)},
             overflowRight:br.right>innerWidth+1, overflowLeft:br.left<-1, hits};
   });
   if(res.missing){console.log(`✗ ${w}/${auth}: #cvBand not mounted`);fails++;}
   else if(res.hits.length){console.log(`✗ ${w}/${auth}: band collides →`,JSON.stringify(res.hits));fails++;}
   else if(res.overflowRight||res.overflowLeft){console.log(`✗ ${w}/${auth}: band overflows viewport`,JSON.stringify(res.rect));fails++;}
   else console.log(`✓ ${w}/${auth}: band clear  [${res.rect.l}..${res.rect.r}]`);
   await pg.close();
  }
 }
 await b.close(); srv.close();
 console.log(fails?`\n${fails} FAILED`:'\n✓ soil band collides with nothing, at every breakpoint, forced visible');
 process.exit(fails?1:0);
})();
