#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const launch = require(path.join(root, 'dirrm-launch.js'));
const playerHtml = fs.readFileSync(path.join(root, 'dirrm-player.html'), 'utf8');

let failures = 0;
function ok(name, pass, detail = '') {
  if (pass) {
    console.log(`ok ${name}`);
  } else {
    failures++;
    console.error(`not ok ${name}${detail ? ' - ' + detail : ''}`);
  }
}

ok(
  'launcher does not force Kick channel pages into raw stream mode',
  launch.detectType('https://kick.com/lordvinta') === 'video',
  `got ${launch.detectType('https://kick.com/lordvinta')}`
);

ok(
  'launcher does not force Twitch channel pages into raw stream mode',
  launch.detectType('https://twitch.tv/lordvinta') === 'video',
  `got ${launch.detectType('https://twitch.tv/lordvinta')}`
);

ok(
  'launcher still recognizes direct HLS manifests as streams',
  launch.detectType('https://cdn.example/live/master.m3u8?token=1') === 'stream',
  `got ${launch.detectType('https://cdn.example/live/master.m3u8?token=1')}`
);

const kickGuard = "if (this._kickLiveChannel(url)) return 'kick-live';";
const tikTokGuard = "return 'tiktok-live';";
const embedGuard = 'const embedKind = this.detectEmbed(url);';
const typeHint = "if (providedType && providedType !== 'auto')";

ok(
  'player routes Kick live before embed detection',
  playerHtml.indexOf(kickGuard) > -1 && playerHtml.indexOf(kickGuard) < playerHtml.indexOf(embedGuard)
);

ok(
  'player routes Kick live before provided type hints',
  playerHtml.indexOf(kickGuard) > -1 && playerHtml.indexOf(kickGuard) < playerHtml.indexOf(typeHint)
);

ok(
  'player routes TikTok live before provided type hints',
  playerHtml.indexOf(tikTokGuard) > -1 && playerHtml.indexOf(tikTokGuard) < playerHtml.indexOf(typeHint)
);

if (failures) {
  console.error(`${failures} DirRM stream routing check(s) failed`);
  process.exit(1);
}

console.log('DirRM stream routing checks passed');
