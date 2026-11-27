'use strict';
// Independent OpenAI review: execute exact committed source against hermetic failures.
// No production DB, credentials, network, or filesystem mutations.
const {execFileSync}=require('node:child_process');
const vm=require('node:vm');
const express=require('/home/vinta/vintinuum-api/node_modules/express');
const repo=process.env.REVIEW_REPO||'/home/vinta/dirhaven';
const ref=process.env.REVIEW_REF||'edc1f1b';
const control=process.argv.includes('--control-fixed');
const source=p=>{
 let s=execFileSync('git',['-C',repo,'show',`${ref}:${p}`],{encoding:'utf8',maxBuffer:8<<20});
 // Synthetic positive control ONLY: repair the four source predicates in memory.
 if(control) {
  s=s.replace('catch { return false; }\n    },','catch { throw new Error("block state unavailable"); }\n    },');
  s=s.replace('catch { /* default visible */ }','catch { showFollowing = 0; }');
  s=s.replace('/^\\/dirmods(\\/|$)/.test','/^\\/dirmods(\\/|$)/i.test');
  s=s.replace('/^\\/mediaservers(\\/|$)/.test','/^\\/mediaservers(\\/|$)/i.test');
  const at=s.indexOf('const getFollowingFeedUnseenCount =');
  if(at>=0) s=s.slice(0,at)+s.slice(at).replace('AND c.is_public = 1','AND c.is_public = 1 AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id = f.follower_id AND b.blocked_id = c.user_id) OR (b.blocker_id = c.user_id AND b.blocked_id = f.follower_id))');
 }
 return s;
};
let checks=0, defects=0;
function check(label, expected, actual) {checks++; const good=JSON.stringify(expected)===JSON.stringify(actual); if(!good)defects++; console.log(`${good?'PASS':'DEFECT'} ${label}: expected ${JSON.stringify(expected)}, observed ${JSON.stringify(actual)}`);}
const service=source('server/social/follow-service.js').replace(/export default[\s\S]*$/,'').replace(/export /g,'');
const policies=vm.runInNewContext(service+';({createChurnGuard,evaluateFollow,evaluateUnfollow,canViewFollowList,canReadRelationship,milestoneFor,milestoneKarma})');
function factory(file) {
 const routes=new Map();
 const router={};
 for(const method of ['get','post','put','delete','patch','use']) router[method]=(p,...fns)=>routes.set(`${method} ${p}`,fns.at(-1));
 const code=source(file).replace(/^import[\s\S]*?;\n/gm,'').replace('export default function','function');
 const name=code.match(/function (create\w+)\(/)[1];
 const context={express:{Router:()=>router},console:{error(){}},socialLimiter(){},uploadLimiter(){},...policies};
 const create=vm.runInNewContext(code+`;${name}`,context);
 return {create,routes};
}
const social=factory('server/routes/social.core.routes.js');
let writes=0;
social.create({dbModule:{userAccountExists:()=>true,isUserBlocked(){throw Error('unreadable blocks');},followUser(){writes++;return true;},getFollowerCount:()=>1,getUserPrivacySettings(){throw Error('unreadable privacy');},getFollowers:()=>[{id:2,username:'private-follower'}],getFollowing:()=>[{id:3,username:'private-followee'}]},userOptedIn:()=>true,isSuperAdmin:()=>false,watchPartyCoverUpload:{single:()=>()=>{}},fs:{}});
function call(handler,req){const res={statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;},set(){return this;}};handler(req,res);return res;}
let r=call(social.routes.get('post /api/social/follow'),{verifiedSession:{userId:1},body:{followingId:2}});
check('block-store exception must prevent follow mutation',0,writes);
check('block-store exception must refuse success',false,r.body.success===true);
r=call(social.routes.get('get /api/social/followers/:userId'),{params:{userId:'1'}});
check('privacy-store exception must withhold private followers',false,Array.isArray(r.body.followers)&&r.body.followers.length>0);
for(const [file,prefix] of [['server/routes/dirmods.routes.js','dirmods'],['server/mediaservers/router.js','mediaservers']]) {
 const s=source(file);const match=s.match(/if \(!\/(\^\\\/[^\n]+?)\.test\(req\.path\)\) return next\(\);/);
 if(!match)throw Error(`guard extraction failed ${file}`);
 const expr=match[0].match(/if \(!(.+)\.test/)[1];
 const rx=vm.runInNewContext(expr);
 check(`${prefix} quarantine applies to lowercase namespace`,true,rx.test(`/${prefix}/connectors`));
 check(`${prefix} quarantine applies to uppercase namespace`,true,rx.test(`/${prefix.toUpperCase()}/connectors`));
 const router=express.Router(); router.get(`/${prefix}/connectors`,()=>{});
 check(`${prefix} Express still matches uppercase route`,true,router.stack[0].match(`/${prefix.toUpperCase()}/connectors`));
}
const database=source('server/database.js');
const start=database.indexOf('const getFollowingFeedUnseenCount =');
const end=database.indexOf('\n};',start)+3;
const body=database.slice(start,end);
const sql=body.match(/const row = db\.prepare\(`([\s\S]+?)`\)/)[1].replace("${since ? 'AND c.created_at > ?' : ''}",'');
const python=`import sqlite3,sys,json\nc=sqlite3.connect(':memory:')\nc.executescript('CREATE TABLE user_follows(follower_id, following_id); CREATE TABLE user_index_cards(id,user_id,is_public,created_at); CREATE TABLE user_privacy_settings(user_id,show_index_card); CREATE TABLE user_blocks(blocker_id,blocked_id); INSERT INTO user_follows VALUES(1,2); INSERT INTO user_index_cards VALUES(1,2,1,"2026-11-26"); INSERT INTO user_blocks VALUES(2,1);')\nprint(c.execute(sys.stdin.read(),(1,)).fetchone()[0])`;
const unseen=Number(execFileSync('python3',['-c',python],{input:sql,encoding:'utf8'}).trim());
check('blocked author must contribute zero unseen posts',0,unseen);
console.log(`RESULT ${checks} probes: ${checks-defects} pass, ${defects} defects reproduced against ${ref}`);
process.exitCode=defects?1:0;
