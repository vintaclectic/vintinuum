/*
 * WORLD-SPEC Phase 2 viewer: the persistent economy clock and 64×64 parcel map.
 * The API owns state; this file is deliberately a read-only window into it.
 */
(function () {
  'use strict';
  var API = (window.VINT_API_BASE || '').replace(/\/$/, '');
  var clock = document.createElement('div');
  clock.id = 'worldClock';
  clock.setAttribute('aria-live', 'polite');
  clock.textContent = 'world · tick —';
  document.body.appendChild(clock);

  var mapButton = document.createElement('button');
  mapButton.id = 'worldMapButton';
  mapButton.type = 'button';
  mapButton.textContent = '🗺 map';
  mapButton.setAttribute('aria-expanded', 'false');
  mapButton.setAttribute('aria-controls', 'worldMapPanel');
  var top = document.getElementById('topctl');
  if (top) top.appendChild(mapButton);

  var panel = document.createElement('section');
  panel.id = 'worldMapPanel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'World parcel map');
  panel.innerHTML = '<div class="world-map-head"><strong>the land</strong><span id="worldMapMeta">64 × 64</span></div>' +
    '<canvas id="worldMapCanvas" width="512" height="512" aria-label="64 by 64 parcel terrain map"></canvas>' +
    '<div class="world-map-legend"><span><i class="terrain-f"></i>flat</span><span><i class="terrain-e"></i>fertile</span><span><i class="terrain-o"></i>forest</span><span><i class="terrain-r"></i>ore</span><span><i class="terrain-w"></i>water</span></div>';
  document.body.appendChild(panel);
  var canvas = panel.querySelector('canvas');
  var ctx = canvas.getContext('2d');
  var colors = { f: '#92785d', e: '#a9a76a', o: '#4d755d', r: '#967070', w: '#4c7190' };
  function draw(grid) {
    if (!grid || !grid.terrain || !ctx) return;
    var w = Number(grid.w) || 64, h = Number(grid.h) || 64;
    var sx = canvas.width / w, sy = canvas.height / h;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      ctx.fillStyle = colors[grid.terrain[y * w + x]] || colors.f;
      ctx.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
    }
    (grid.claims || []).forEach(function (claim) {
      ctx.fillStyle = '#f4c79a';
      ctx.fillRect(claim.x * sx + sx * .25, claim.y * sy + sy * .25, sx * .5, sy * .5);
    });
    var meta = document.getElementById('worldMapMeta');
    if (meta) meta.textContent = w + ' × ' + h + ' · ' + (grid.claims || []).length + ' claimed';
  }
  function get(path) {
    return fetch(API + path, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('world api ' + r.status);
      return r.json();
    });
  }
  function refreshClock() {
    get('/api/world/health').then(function (data) {
      clock.textContent = 'world · tick ' + (data.economy_tick == null ? '—' : data.economy_tick);
      clock.dataset.tick = String(data.economy_tick == null ? '' : data.economy_tick);
    }).catch(function () { clock.textContent = 'world · sleeping'; });
  }
  mapButton.addEventListener('click', function () {
    var open = !panel.hidden;
    panel.hidden = open;
    mapButton.setAttribute('aria-expanded', String(!open));
    if (!open) get('/api/world/parcels').then(draw).catch(function () {
      var meta = document.getElementById('worldMapMeta'); if (meta) meta.textContent = 'map unavailable';
    });
  });
  refreshClock();
  setInterval(refreshClock, 15000);
}());
