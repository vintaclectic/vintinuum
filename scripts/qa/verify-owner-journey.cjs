'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const apiRoot = process.env.VINTINUUM_API_ROOT || '/home/vinta/vintinuum-api';
const puppeteer = require(path.join(apiRoot,'node_modules/puppeteer'));
const { createFixture } = require(path.join(apiRoot,'lib/owner-onboarding'));
const { pack } = require(path.join(apiRoot,'bin/verify-owner-onboarding-3CUERP2'));
(async()=>{
  const fixture = createFixture({frontendRoot:path.resolve(__dirname,'../..')});
  const base = await fixture.listen();
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'owner-browser-'));
  const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  let checks=0;
  const pass=(label,fn)=>{fn();checks++;console.log(`PASS ${label}`);};
  try {
    const owners=[];
    for(const account of ['alice','bob']) {
      const session=fixture.createSession(account);
      const context=await browser.createBrowserContext();
      await context.setCookie({name:session.cookieName,value:session.sessionId,url:base,httpOnly:true,sameSite:'Strict'});
      const page=await context.newPage();await page.setViewport({width:375,height:900});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base,{waitUntil:'domcontentloaded'});
      const settled=()=>page.waitForSelector('body[aria-busy="false"]');
      const submit=async(selector,endpoint)=>{
        const response=page.waitForResponse(r=>r.url()===base+'/api/owner/'+endpoint&&r.request().method()==='POST');
        await page.click(selector);const r=await response;await settled();return {status:r.status(),data:await r.json()};
      };
      await settled();
      const initialTasks=await page.$eval('#tasks',el=>el.textContent);
      const initiallyDisabled=await page.$eval('#create-task',el=>el.disabled);
      pass(`${account} starts with own empty workspace`,()=>{assert.equal(initialTasks,'No tasks yet. Your first assignment will appear here.');assert.equal(initiallyDisabled,true);});
      await page.type('#secret',`fixture-${account}-credential`);
      let response=await submit('#provider-form button','provider');
      pass(`${account} provider connection`,()=>assert.equal(response.status,200,JSON.stringify(response)));
      assert.equal(await page.$eval('#secret',el=>el.value),'');
      const archive=path.join(scratch,account+'.council-pack');fs.writeFileSync(archive,pack({content:`Private ${account} research agent.`}));
      await (await page.$('#archive')).uploadFile(archive);
      response=await submit('#package-form button','packages');
      pass(`${account} package import`,()=>assert.equal(response.status,200,JSON.stringify(response)));
      assert.equal(await page.$$eval('.capability input',els=>els.every(el=>!el.checked)),true);
      response=await submit('.package .actions button:last-child','packages/activate');
      pass(`${account} unapproved activation refused and readable error`,()=>assert.equal(response.status,400));
      assert.doesNotMatch(await page.$eval('#status',el=>el.textContent),/object Object/);
      // Approve exactly one requested capability through the UI.
      await page.click('.capability input');
      response=await submit('.package .actions button:first-child','packages/approve');
      pass(`${account} least privilege approval`,()=>{assert.equal(response.status,200);assert.deepEqual(response.data.packages[0].approvedCapabilities,['workspace.read']);});
      response=await submit('.package .actions button:last-child','packages/activate');
      pass(`${account} activation`,()=>assert.equal(response.status,200));
      await page.type('#title',`${account} private assignment`);await page.type('#detail',`Only ${account} should see this work.`);
      response=await submit('#create-task','tasks');
      pass(`${account} creates task through UI`,()=>assert.equal(response.status,200,JSON.stringify(response)));
      const taskId=response.data.task.id;
      await fixture.mockAttempt(session.sessionId,taskId,{costMicros:account==='alice'?1200000:3400000});
      await page.click('#refresh');await settled();
      const text=await page.$eval('#tasks',el=>el.textContent); const cost=await page.$eval('#cost',el=>el.textContent);
      pass(`${account} sees only own task/cost`,()=>{assert.match(text,new RegExp(account+' private assignment'));assert.doesNotMatch(text,new RegExp((account==='alice'?'bob':'alice')+' private assignment'));assert.equal(cost,account==='alice'?'$1.20':'$3.40');});
      pass(`${account} no browser errors`,()=>assert.deepEqual(errors,[]));
      owners.push({page,session});
    }
    await owners[0].page.click('#refresh');await owners[0].page.waitForSelector('body[aria-busy="false"]');
    const aliceText=await owners[0].page.$eval('#tasks',el=>el.textContent);
    pass('Alice remains isolated after Bob creates work',()=>assert.doesNotMatch(aliceText,/bob private assignment/));
    await owners[0].page.screenshot({path:'/tmp/3CUERP2-owner-real-375.png',fullPage:true});
    console.log(`${checks}/${checks} real-library browser journey checks passed`);
  } finally {await browser.close();await fixture.close();fs.rmSync(scratch,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
