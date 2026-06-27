# Datastar Simulator

[![DEMO](https://img.shields.io/badge/DEMO-live-2ea44f?style=for-the-badge)](https://romshark.github.io/datastar-simulator/)

A client-side simulator for [Datastar](https://data-star.dev) backends intercepts `window.fetch` for routes you register and answers them locally with the same wire formats Datastar's action plugins accept — no server required, fully CDN-hostable.

## Why

I wanted to prototype and demo Datastar-friendly UI web components but share the demos via CDN without actually hosting a server. So I wrote `datasim.js` that lets me easily define a simulated Datastar server in JavaScript right in the browser.

## Usage

```html
<script type="module" src="./handlers.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/gh/starfederation/datastar@v1.0.2/bundles/datastar.js"></script>
```

```js
// handlers.js
import { sim, html } from './datasim.js';

sim.post('/api/increment', async (ctx, sse) => {
  sse.patchSignals({ count: (ctx.signals.count ?? 0) + 1 });
});

sim.post('/api/greet', async (ctx, sse) => {
  sse.patchElements(html`<div id="msg">hi, ${ctx.signals.name}</div>`);
});
```

Handler scripts must load **before** the Datastar bundle so routes are registered before any `data-init` fires.

## AI Usage Disclosure

This code was written with the help of Opus 4.7 under my guidance and supervision.
It's manually tested and reviewed.
