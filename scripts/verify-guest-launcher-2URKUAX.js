#!/usr/bin/env node
'use strict';
// Real guest launcher click: no visibility override, token or API fixture.
// By default serve this checkout's world.html/economy-map.js on the public
// origin with real assets/API responses; --live tests the deployment unchanged.
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(process.env.HOME, 'vintinuum-api/node_modules/puppeteer'));
const live = process.argv.includes('--live');
const widths = (process.env.WIDTHS || process.env.GUEST_WIDTH || '320,375,768,1280,1920').split(',').map(Number);
if (widths.some(w=>!Number.isInteger(w)||w<1)) throw new Error('WIDTHS must be comma-separated positive pixel widths');
const heights = widths.map(w=>({320:568,375:667,768:1024,1280:800,1920:1080}[w]||800));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let passed = 0;
const failures = [];
function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ' '+JSON.stringify(detail) : ''}`);
  if (ok) passed++; else failures.push(label);
}
(async () => {
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  try {
    for (let i=0;i<widths.length;i++) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setBypassServiceWorker(true);
      await page.setCacheEnabled(false);
      await page.setViewport({width:widths[i],height:heights[i],isMobile:widths[i]<860,hasTouch:widths[i]<860});
      if (!live) {
        await page.setRequestInterception(true);
        page.on('request',req => {
          const url = new URL(req.url());
          const relative = url.pathname === '/world.html' ? 'world.html' : url.pathname === '/body/world/economy-map.js' ? 'body/world/economy-map.js' : null;
          if (url.hostname === 'vintinuum.com' && relative) req.respond({status:200,contentType:relative.endsWith('.html')?'text/html':'text/javascript',body:fs.readFileSync(path.join(__dirname,'..',relative))});
          else req.continue();
        });
      }
      for (const load of ['cold','warm']) {
        await page.goto('https://vintinuum.com/world.html',{waitUntil:'domcontentloaded',timeout:45000});
        await page.waitForSelector('#invite.show',{timeout:30000});
        await page.waitForSelector('#worldMapButton',{timeout:30000});
        await sleep(1200); // doorway animation + dock layout
        for (const state of ['show','min']) {
          const label = `${widths[i]} ${load} ${state}`;
          if (state === 'min') {
            if (!await page.$eval('#invite',el=>el.classList.contains('min'))) await page.click('#inviteWander');
            await sleep(400);
          }
          const measure = await page.evaluate(() => {
            const b=document.getElementById('worldMapButton'), r=b.getBoundingClientRect();
            const invite=document.getElementById('invite').getBoundingClientRect();
            const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
            return {rect:[r.x,r.y,r.width,r.height],hit:hit?.id,clear:hit===b||b.contains(hit),
              overlap:Math.max(0,Math.min(r.right,invite.right)-Math.max(r.left,invite.left))*Math.max(0,Math.min(r.bottom,invite.bottom)-Math.max(r.top,invite.top)),
              hidden:['saybar','movectl','btnView','btnMic'].every(id=>getComputedStyle(document.getElementById(id)).display==='none')};
          });
          check(label+' launcher visible and hit-tested',measure.rect[2]>0&&measure.rect[3]>0&&measure.clear,measure);
          check(label+' clears doorway',measure.overlap===0);
          check(label+' guest writes hidden',measure.hidden);
          if (!measure.clear) continue;
          await page.mouse.click(measure.rect[0]+measure.rect[2]/2,measure.rect[1]+measure.rect[3]/2);
          await sleep(900);
          const opened = await page.evaluate(() => {
            const p=document.getElementById('worldMapPanel');
            const cs=getComputedStyle(p),r=p.getBoundingClientRect();
            const obstacles=cs.visibility==='hidden'?[...document.querySelectorAll('body *')].filter(el=>{
              const s=getComputedStyle(el),b=el.getBoundingClientRect();
              return el!==p&&!p.contains(el)&&s.position==='fixed'&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0&&b.width>0&&b.height>0&&b.left<r.right&&b.right>r.left;
            }).map(el=>{const b=el.getBoundingClientRect();return {id:el.id,box:[b.x,b.y,b.width,b.height]};}):undefined;
            return {hidden:p.hidden,visibility:cs.visibility,height:r.height,top:r.top,floor:cs.getPropertyValue('--wmp-floor'),obstacles};
          });
          check(label+' real click opens visible panel',!opened.hidden&&opened.visibility==='visible'&&opened.height>0,opened);
          // The launcher above is a hit-tested user click. Disclosure setup uses
          // native details.open/toggle to load each real read-only band without
          // spending the whole bounded run animating three scrolls per scenario.
          if (!opened.hidden && opened.visibility==='visible') {
            await page.evaluate(() => {
              for (const id of ['worldStory','worldFolk','worldTreasury']) {
                const details=document.getElementById(id);
                if (!details.open) details.open=true;
                else details.dispatchEvent(new Event('toggle'));
              }
            });
            await page.waitForFunction(() => document.querySelector('#worldTreasBody .wd-treas li') && document.querySelector('#worldStoryBody .wd-day') && document.querySelector('#worldFolkBody button[data-agent]'),{timeout:30000});
            const bands = await page.evaluate(() => ({
              map:document.getElementById('worldMapCanvas').getContext('2d').getImageData(0,0,1,1).data[3]>0,
              story:document.querySelectorAll('#worldStoryBody .wd-day').length,
              folk:document.querySelectorAll('#worldFolkBody button[data-agent]').length,
              treasury:document.querySelectorAll('#worldTreasBody .wd-treas li').length
            }));
            check(label+' map/story/folk/treasury render',bands.map&&bands.story&&bands.folk&&bands.treasury>0,bands);
          }
          // Close with the actual launcher if clear; otherwise use the panel's close button.
          await page.evaluate(() => document.getElementById('worldMapPanel').scrollTop=0);
          const close = await page.$('#worldMapClose');
          if (close && await close.isVisible()) await close.click();
          else await page.click('#worldMapButton');
        }
      }
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(`${passed} passed; ${failures.length} failed (${live?'LIVE':'checkout HTML + live assets/API'})`);
  process.exitCode=failures.length?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
