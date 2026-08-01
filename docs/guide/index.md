---
aside: false
pageClass: guide-overview-page
title: Guide
description: Build your first Grid Layout Plus layout, then learn the API and advanced options.
---

# Guide

<p class="guide-overview-lede">
  Your application owns the layout data. During drag and resize interactions, <code>GridLayout</code> emits a valid update and waits for the new value to come back through its props.
</p>

<section class="guide-journey" aria-labelledby="guide-journey-title">
  <h2 id="guide-journey-title">Build your first grid</h2>

  <div class="guide-step-list">
    <a href="/guide/installation">
      <span>01</span>
      <strong>Install and import</strong>
      <small>Add the package and choose local or global component registration.</small>
    </a>
    <a href="/guide/usage">
      <span>02</span>
      <strong>Bind a controlled layout</strong>
      <small>Define the item coordinates, bind <code>v-model:layout</code>, and choose a slot.</small>
    </a>
    <a href="/example/basic">
      <span>03</span>
      <strong>Run the basic example</strong>
      <small>Drag and resize the items, then open and copy the minimal example.</small>
    </a>
    <a href="/guide/recipes">
      <span>04</span>
      <strong>Apply a complete pattern</strong>
      <small>Copy the controlled, responsive, programmatic, headless, or Core API workflow.</small>
    </a>
  </div>
</section>

<section class="guide-reference" aria-labelledby="guide-reference-title">
  <div class="guide-overview-heading">
    <h2 id="guide-reference-title">Check the API</h2>
    <p>Look here when you need the exact type, default value, or event signature.</p>
  </div>

  <div class="guide-reference-list">
    <a href="/guide/api-index">
      <strong>API index</strong>
      <span>Find a public v2 symbol or choose the right API for a task.</span>
      <span aria-hidden="true">→</span>
    </a>
    <a href="/guide/properties">
      <strong>Properties</strong>
      <span>GridLayout, GridItem, and GridBackground inputs, defaults, types, compactors, and position strategies.</span>
      <span aria-hidden="true">→</span>
    </a>
    <a href="/guide/events">
      <strong>Events</strong>
      <span>Layout updates and interaction lifecycle events for moving and resizing items.</span>
      <span aria-hidden="true">→</span>
    </a>
    <a href="/guide/methods">
      <strong>Methods</strong>
      <span>Programmatic component commands and controlled transaction receipts.</span>
      <span aria-hidden="true">→</span>
    </a>
    <a href="/guide/composables">
      <strong>Composables</strong>
      <span>Headless layout, responsive state, and container-width observation.</span>
      <span aria-hidden="true">→</span>
    </a>
    <a href="/guide/contracts">
      <strong>Operation contracts</strong>
      <span>Result statuses, rejection reasons, revisions, and structured errors.</span>
      <span aria-hidden="true">→</span>
    </a>
    <a href="/guide/core-api">
      <strong>Core API</strong>
      <span>DOM-free validation, normalization, collision, compaction, and geometry.</span>
      <span aria-hidden="true">→</span>
    </a>
  </div>
</section>

<section class="guide-beyond" aria-labelledby="guide-beyond-title">
  <div class="guide-overview-heading">
    <h2 id="guide-beyond-title">Customize or migrate</h2>
  </div>

  <div class="guide-beyond-links">
    <a href="/guide/custom-style"><strong>Custom style</strong><span>Style item states and interaction feedback.</span></a>
    <a href="/example/"><strong>Examples by task</strong><span>Open a small, runnable example for each feature.</span></a>
    <a href="/guide/migration"><strong>Migration guide</strong><span>Replace removed APIs and check behavior changes.</span></a>
  </div>
</section>
