'use strict';
// Layout/state verification only. The API repository verifier proves real tenant isolation.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require(process.env.PUPPETEER_MODULE || '/home/vinta/vintinuum-api/node_modules/puppeteer');
const root = path.resolve(__dirname, '../..');
const long = 'Council-' + 'long-label-'.repeat(20);
let state = 'empty';
let checks = 0;
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/owner/')) {
    res.setHeader('Content-Type', 'application/json');
    if (state === 'loading') return setTimeout(() => { if (!res.destroyed) res.end('{}'); }, 3000).unref();
    if (state === 'error') { res.statusCode = 503; return res.end(JSON.stringify({message:'Provider unavailable. ' + long})); }
    if (state === 'unauthenticated') { res.statusCode = 401; return res.end('{}'); }
    const full = state === 'long';
    const data = {
      session: { tenantLabel: full ? long : 'Alice’s council', csrfToken: 'fixture', providerConnected: full },
      packages: { packages: full ? [{name:long,version:long,digest:'a'.repeat(64),active:true,files:[long + '.md'],requestedCapabilities:['workspace.read',long],approvedCapabilities:[],warnings:['Review this imported definition. ' + long]}] : [] },
      tasks: { tasks: full ? [{id:long,title:long,status:'todo'}, {id:'second',title:'<img src=x onerror=alert(1)>',status:'todo'}] : [] },
      costs: { knownMicros:12340000,unknownCount:full ? 2 : 0,currency:'USD' }
    };
    return res.end(JSON.stringify(data[req.url.split('/').pop()] || {}));
  }
  const files = {
    '/tenant-onboarding.html':'text/html',
    '/body/tenant-onboarding/owner.css':'text/css',
    '/body/tenant-onboarding/owner.js':'text/javascript'
  };
  if (!files[req.url]) { res.statusCode=404; return res.end(); }
  res.setHeader('Content-Type',files[req.url]); res.end(fs.readFileSync(path.join(root,req.url)));
});
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    const page = await browser.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    for (const width of [320,375,768,1280,1920]) {
      await page.setViewport({width,height:1000});
      for (state of ['empty','long','error','loading','unauthenticated']) {
        await page.goto(`http://127.0.0.1:${server.address().port}/tenant-onboarding.html`,{waitUntil:'domcontentloaded'});
        if(state==='loading') await page.waitForSelector('body[aria-busy="true"]');
        else await page.waitForSelector('body[aria-busy="false"]');
        const result = await page.evaluate(() => {
          const visible = el => !!el.getClientRects().length && getComputedStyle(el).visibility!=='hidden';
          const els=[...document.querySelectorAll('h1,h2,h3,p,button,label,legend,input,textarea,a,li.empty')].filter(visible);
          const overflow=els.filter(el=>{const r=el.getBoundingClientRect();return r.left < -.5 || r.right > innerWidth+.5;}).map(el=>el.outerHTML.slice(0,100));
          const collisions=[];
          for(let i=0;i<els.length;i++)for(let j=i+1;j<els.length;j++){
            const a=els[i],b=els[j];if(a.contains(b)||b.contains(a))continue;
            const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();
            if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>.5&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>.5)collisions.push([a.outerHTML.slice(0,90),b.outerHTML.slice(0,90)]);
          }
          return {overflow,collisions,scroll:document.documentElement.scrollWidth,viewport:innerWidth,hidden:document.getElementById('workspace').hidden,text:document.body.innerText,images:document.querySelectorAll('#tasks img').length};
        });
        assert.deepEqual(result.overflow,[],`${width}/${state}: element overflow`);
        assert.deepEqual(result.collisions,[],`${width}/${state}: collisions`);
        assert.ok(result.scroll<=result.viewport,`${width}/${state}: page overflow`);
        assert.equal(result.hidden,!['empty','long'].includes(state));
        if(state==='long') { assert.equal(result.images,0);assert.match(result.text,/unknown cost/); }
        if(width===375&&state==='long')await page.screenshot({path:'/tmp/3CUERP2-owner-375.png',fullPage:true});
        checks++; console.log(`PASS ${width}px ${state}: no collisions/overflow, visibility correct`);
      }
    }
    // A failed refresh must remove previously loaded account data.
    state='long';await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('body[aria-busy="false"]');
    state='unauthenticated';await page.click('#refresh');await page.waitForSelector('#workspace[hidden]');
    assert.equal(await page.$eval('#secret',el=>el.value),'');checks++;
    assert.deepEqual(errors,[]);checks++;
    console.log(`${checks}/${checks} owner layout/state checks passed`);
  } finally {await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.closeAllConnections();server.close();process.exitCode=1;});
