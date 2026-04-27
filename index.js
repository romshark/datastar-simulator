import { sim, html } from './datasim.js';

// Exposed so index.html's data-effect can call sim.setLatency / etc.
window.sim = sim;

sim.post('/sim/increment', async (ctx, sse) => {
  sse.patchSignals({ count: (Number(ctx.signals.count) || 0) + 1 });
});

sim.post('/sim/reset', async (_ctx, sse) => {
  sse.patchSignals({ count: 0 });
});

sim.post('/sim/greet', async (ctx, sse) => {
  const name = String(ctx.signals.name ?? '').trim();
  if (!name) {
    sse.patchElements(html`<p id="greeting" class="error">please tell me your name</p>`);
    return;
  }
  sse.patchElements(html`
    <div id="greeting">
      <p>hello, <strong>${name}</strong> — nice to meet you.</p>
      <p class="muted">processed at ${new Date().toLocaleTimeString()}</p>
    </div>
  `);
});

// useViewTransition pairs with the ::view-transition-* and #log li CSS rules.
sim.post('/sim/process', async (_ctx, sse) => {
  sse.patchSignals({ progress: 0 });
  sse.patchElements(html`<ul id="log"></ul>`, { useViewTransition: true });
  const steps = [
    'connecting…',
    'authenticating…',
    'fetching records',
    'crunching numbers',
    'finalizing report',
  ];
  for (let i = 0; i < steps.length; i++) {
    await sse.delay(700);
    sse.patchSignals({ progress: Math.round(((i + 1) / steps.length) * 100) });
    sse.patchElements(
      html`<li>${steps[i]}</li>`,
      { selector: '#log', mode: 'append', useViewTransition: true },
    );
  }
  await sse.delay(300);
  sse.patchElements(
    html`<li class="done">complete.</li>`,
    { selector: '#log', mode: 'append', useViewTransition: true },
  );
});

// Counter ticks on a wall-clock timer so gaps during "server unreachable"
// show up as skipped entry numbers when the stream reopens.
let liveLogSse = null;
let liveLogIndex = 0;

// Toggled by a checkbox in the section's data-effect. Counter keeps ticking
// when paused so unpausing shows the gap as skipped entry numbers.
let liveLogPaused = true;
window.setLiveLogPaused = (paused) => { liveLogPaused = !!paused; };

setInterval(() => {
  liveLogIndex++;
  if (liveLogPaused) return;
  liveLogSse?.patchElements(
    html`<li>[${new Date().toLocaleTimeString()}] entry ${liveLogIndex}</li>`,
    { selector: '#live-log', mode: 'prepend' },
  );
}, 1000);

sim.get('/sim/log', async (_ctx, sse) => {
  liveLogSse = sse;
  try {
    while (!sse.signal.aborted) {
      try { await sse.delay(60_000); } catch { return; }
    }
  } finally {
    if (liveLogSse === sse) liveLogSse = null;
  }
});

sim.post('/sim/log/burst', async (ctx) => {
  if (!liveLogSse) return;
  const n = Math.max(1, Number(ctx.signals.burst_n) || 0);
  for (let k = 1; k <= n; k++) {
    liveLogSse.patchElements(
      html`<li>[burst ${k}/${n}] entry ${++liveLogIndex}</li>`,
      { selector: '#live-log', mode: 'prepend' },
    );
  }
});

sim.delete('/sim/items/:id', async (ctx, sse) => {
  sse.removeElements(`#item-${ctx.params.id}`);
});

const initialItems = html`
  <div id="item-1" class="item">
    <span>item one</span>
    <button data-on:click="@delete('/sim/items/1')"
      data-indicator:deleting1 data-attr:disabled="$deleting1">
      delete
      <span class="spinner spinner-sm" data-show="$deleting1"></span>
    </button>
  </div>
  <div id="item-2" class="item">
    <span>item two</span>
    <button data-on:click="@delete('/sim/items/2')"
      data-indicator:deleting2 data-attr:disabled="$deleting2">
      delete
      <span class="spinner spinner-sm" data-show="$deleting2"></span>
    </button>
  </div>
  <div id="item-3" class="item">
    <span>item three</span>
    <button data-on:click="@delete('/sim/items/3')"
      data-indicator:deleting3 data-attr:disabled="$deleting3">
      delete
      <span class="spinner spinner-sm" data-show="$deleting3"></span>
    </button>
  </div>
`;

sim.post('/sim/items/reset', async (_ctx, sse) => {
  sse.patchElements(initialItems, { selector: '#items', mode: 'inner' });
});

// Returning { html | json | script } sends a non-SSE response of that shape.
sim.post('/sim/non-sse/html', async () => ({
  html: html`
    <div id="non-sse-out">
        text/html response — patched at
        <strong>${new Date().toLocaleTimeString()}</strong>
    </div>`,
  selector: '#non-sse-out',
  mode: 'outer',
}));

sim.post('/sim/non-sse/json', async () => ({
  json: { nonSseJson: `set via application/json at ${new Date().toLocaleTimeString()}` },
}));

sim.post('/sim/non-sse/script', async () => ({
  script: `(() => {
    window.nonSseScriptRan = (window.nonSseScriptRan || 0) + 1;
    const el = document.getElementById('non-sse-script');
    if (el) {
        el.textContent = 'ran ' +
            window.nonSseScriptRan +
            ' time(s) — last at ' +
            new Date().toLocaleTimeString();
    }
    console.log('[non-sse script] ran', window.nonSseScriptRan, 'time(s)');
  })();`,
}));

const initialPatchStage = html`
  <div class="patch-overlay" data-show="$patching">
    <div class="spinner"></div>
  </div>
  <div id="patch-target" class="patch-target">
    <p>existing child</p>
  </div>
`;

sim.post('/sim/patch/:mode', async (ctx, sse) => {
  const t = new Date().toLocaleTimeString();
  switch (ctx.params.mode) {
    case 'outer':
      // default mode — Idiomorph morph keyed by id
      sse.patchElements(html`
        <div id="patch-target" class="patch-target">
          <p>morphed via outer @ ${t}</p>
        </div>
      `);
      break;
    case 'inner':
      sse.patchElements(html`<p>inner content @ ${t}</p>`,
        { selector: '#patch-target', mode: 'inner' });
      break;
    case 'replace':
      // destroys the element instead of morphing
      sse.patchElements(html`
        <div id="patch-target" class="patch-target">
          <p>replaced (no morph) @ ${t}</p>
        </div>
      `, { selector: '#patch-target', mode: 'replace' });
      break;
    case 'prepend':
      sse.patchElements(html`<p>prepended child @ ${t}</p>`,
        { selector: '#patch-target', mode: 'prepend' });
      break;
    case 'append':
      sse.patchElements(html`<p>appended child @ ${t}</p>`,
        { selector: '#patch-target', mode: 'append' });
      break;
    case 'before':
      sse.patchElements(html`<div class="sibling">before-sibling @ ${t}</div>`,
        { selector: '#patch-target', mode: 'before' });
      break;
    case 'after':
      sse.patchElements(html`<div class="sibling">after-sibling @ ${t}</div>`,
        { selector: '#patch-target', mode: 'after' });
      break;
    case 'reset':
      sse.patchElements(initialPatchStage,
        { selector: '#patch-stage', mode: 'inner' });
      break;
  }
});
