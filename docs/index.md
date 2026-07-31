---
layout: home

hero:
  name: Grid Layout Plus
  text: A draggable and resizable grid layout for Vue 3
  tagline: Drag, resize, responsive layouts, collision handling, and configurable positioning in one Vue 3 component.
  image: /grid-layout-plus.svg
  actions:
    - theme: brand
      text: Start building
      link: /guide/
    - theme: alt
      text: Explore examples
      link: /example/
    - theme: alt
      text: GitHub
      link: https://github.com/qmhc/grid-layout-plus
---

<section class="home-routes" aria-labelledby="home-routes-title">
  <div class="home-section-heading">
    <h2 id="home-routes-title">What do you need?</h2>
  </div>

  <div class="home-route-list">
    <a class="home-route" href="/guide/">
      <span class="home-route__index">01 / BUILD</span>
      <strong>Build a layout</strong>
      <span>Install the package, bind <code>v-model:layout</code>, and render a working grid.</span>
      <span class="home-route__link">Read the guide <span aria-hidden="true">→</span></span>
    </a>
    <a class="home-route" href="/example/">
      <span class="home-route__index">02 / EXPLORE</span>
      <strong>Find an example</strong>
      <span>Browse by task and copy the smallest example that matches your case.</span>
      <span class="home-route__link">Browse examples <span aria-hidden="true">→</span></span>
    </a>
    <a class="home-route" href="/guide/properties">
      <span class="home-route__index">03 / REFERENCE</span>
      <strong>Check the API</strong>
      <span>Look up component properties, defaults, types, and events.</span>
      <span class="home-route__link">Open API reference <span aria-hidden="true">→</span></span>
    </a>
  </div>
</section>

<section class="home-capabilities" aria-labelledby="home-capabilities-title">
  <div class="home-section-heading">
    <h2 id="home-capabilities-title">Choose how the grid should behave</h2>
    <p>The layout stays in your application state. Configure responsive behavior, collision handling, external drops, and positioning as needed.</p>
  </div>

  <div class="home-capability-list">
    <a href="/example/responsive">
      <strong>Responsive layouts</strong>
      <span>Change columns and item positions at each breakpoint.</span>
    </a>
    <a href="/example/prevent-collision">
      <strong>Collision control</strong>
      <span>Push items aside, reject collisions, or allow overlap.</span>
    </a>
    <a href="/example/drag-from-outside">
      <strong>Drag and drop</strong>
      <span>Move existing items or drag new items into the grid.</span>
    </a>
    <a href="/example/position-strategy">
      <strong>Position strategy</strong>
      <span>Choose between transform-based and absolute positioning to suit your rendering requirements.</span>
    </a>
    <a href="/example/styling-grid-lines">
      <strong>Styling hooks</strong>
      <span>Style grid lines, placeholders, backgrounds, and item states.</span>
    </a>
    <a href="/example/composable-api">
      <strong>Composable API</strong>
      <span>Use the layout engine without the built-in component markup.</span>
    </a>
  </div>
</section>
