'use strict';
(() => {
  const $ = id => document.getElementById(id);
  let csrfToken = '';
  let ready = false;
  let busy = false;
  const node = (tag, text, cls) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  };
  const status = (text, error = false) => {
    $('status').textContent = text;
    $('status').parentElement.dataset.error = String(error);
  };
  function lock(value) {
    busy = value;
    document.body.setAttribute('aria-busy', String(value));
    document.querySelectorAll('button').forEach(button => { button.disabled = value; });
    if (!value) $('create-task').disabled = !ready;
  }
  async function api(path, data) {
    const response = await fetch('/api/owner/' + path, {
      method: data === undefined ? 'GET' : 'POST', credentials: 'same-origin',
      headers: data === undefined ? { Accept: 'application/json' } : {
        'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, Accept: 'application/json'
      }, body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(20000)
    });
    if (response.status === 401 || response.status === 403) {
      csrfToken = ''; ready = false; $('workspace').hidden = true;
      $('identity').textContent = 'Session verification required';
      throw new Error('Your session could not be verified. Sign in through your council host, then refresh.');
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || 'Your request could not be completed. Try again.');
    return result;
  }
  async function action(message, fn) {
    if (busy) return;
    lock(true); status(message);
    try { await fn(); await load(); }
    catch (error) { status(error.message || 'Connection unavailable. Try again.', true); }
    finally { lock(false); }
  }
  function renderPackages(packages) {
    $('packages').replaceChildren();
    if (!packages.length) $('packages').append(node('p', 'No packages yet. Upload your own council to begin.', 'muted'));
    for (const pack of packages) {
      const card = node('article', undefined, 'package');
      card.append(node('h3', pack.name), node('p', `Version ${pack.version} · ${pack.active ? 'Active' : 'Not active'}`, 'state'), node('p', pack.digest, 'digest'));
      const files = node('ul');
      for (const file of pack.files || []) files.append(node('li', typeof file === 'string' ? file : file.path));
      card.append(node('p', 'Included files'), files);
      for (const warning of pack.warnings || []) card.append(node('p', typeof warning === 'string' ? warning : JSON.stringify(warning)));
      const permissions = node('fieldset'); permissions.append(node('legend', 'Permissions you approve'));
      const checks = [];
      for (const cap of pack.requestedCapabilities || []) {
        const label = node('label', undefined, 'capability');
        const input = node('input'); input.type = 'checkbox'; input.value = cap;
        input.checked = (pack.approvedCapabilities || []).includes(cap);
        label.append(input, node('span', cap)); permissions.append(label); checks.push(input);
      }
      if (!checks.length) permissions.append(node('p', 'This package requests no tool permissions.', 'muted'));
      card.append(permissions);
      const actions = node('div', undefined, 'actions');
      const approve = node('button', 'Approve selected permissions', 'secondary'); approve.type = 'button';
      approve.addEventListener('click', () => action('Saving permission approval…', () => api('packages/approve', { digest: pack.digest, capabilities: checks.filter(c => c.checked).map(c => c.value) })));
      const activate = node('button', 'Activate package'); activate.type = 'button';
      activate.addEventListener('click', () => action('Activating your package…', () => api('packages/activate', { digest: pack.digest })));
      actions.append(approve, activate); card.append(actions); $('packages').append(card);
    }
  }
  async function load() {
    // Hide all prior tenant data while resolving a fresh session, including failed refreshes.
    $('workspace').hidden = true;
    const session = await api('session');
    csrfToken = session.csrfToken;
    $('identity').textContent = session.tenantLabel;
    const [packageData, taskData, costs] = await Promise.all([api('packages'), api('tasks'), api('costs')]);
    renderPackages(packageData.packages);
    $('provider-status').textContent = session.providerConnected ? 'Provider connected' : 'No provider connected yet';
    ready = session.providerConnected && packageData.packages.some(pack => pack.active);
    $('task-help').textContent = ready ? 'Your council is ready for an assignment.' : 'Connect a provider and activate an approved package to create a task.';
    $('tasks').replaceChildren();
    $('task-count').textContent = `${taskData.tasks.length} total`;
    if (!taskData.tasks.length) $('tasks').append(node('li', 'No tasks yet. Your first assignment will appear here.', 'empty'));
    for (const task of taskData.tasks) {
      const row = node('li'); row.append(node('h3', task.title), node('p', `${task.id} · ${task.status}`, 'state')); $('tasks').append(row);
    }
    $('cost').textContent = new Intl.NumberFormat(undefined, { style: 'currency', currency: costs.currency || 'USD', maximumFractionDigits: 4 }).format(costs.knownMicros / 1000000);
    $('unknown').textContent = costs.unknownCount ? `${costs.unknownCount} usage records have unknown cost and are excluded from this total.` : 'No unpriced usage recorded.';
    $('workspace').hidden = false; status('Your council is up to date.');
  }
  $('provider-form').addEventListener('submit', event => {
    event.preventDefault();
    const secret = $('secret').value;
    $('secret').value = '';
    action('Connecting your provider…', () => api('provider', { provider: document.querySelector('[name=provider]:checked').value, secret }));
  });
  $('package-form').addEventListener('submit', event => {
    event.preventDefault();
    action('Reviewing your package…', async () => {
      const file = $('archive').files[0];
      if (!file || file.size > 2 * 1024 * 1024) throw new Error('Choose a council package no larger than 2 MiB.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      await api('packages', { archiveBase64: btoa(binary) });
      $('archive').value = '';
    });
  });
  $('task-form').addEventListener('submit', event => {
    event.preventDefault(); if (!ready) return;
    action('Creating your task…', async () => {
      await api('tasks', { title: $('title').value.trim(), detail: $('detail').value.trim() });
      $('task-form').reset();
    });
  });
  $('refresh').addEventListener('click', () => action('Refreshing your council…', async () => {}));
  action('Loading your council…', async () => {});
})();
