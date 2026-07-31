---
layout: home

hero:
  name: Grid Layout Plus
  text: 适用于 Vue 3 的可拖拽、可缩放栅格布局组件
  tagline: 一个组件就能支持拖拽、缩放和响应式布局，并提供碰撞处理与定位策略。
  image: /grid-layout-plus.svg
  actions:
    - theme: brand
      text: 开始使用
      link: /zh/guide/
    - theme: alt
      text: 浏览示例
      link: /zh/example/
    - theme: alt
      text: GitHub
      link: https://github.com/qmhc/grid-layout-plus
---

<section class="home-routes" aria-labelledby="home-routes-title">
  <div class="home-section-heading">
    <h2 id="home-routes-title">你想先做什么？</h2>
  </div>

  <div class="home-route-list">
    <a class="home-route" href="/zh/guide/">
      <span class="home-route__index">01 / 指南</span>
      <strong>搭一个布局</strong>
      <span>安装组件并绑定 <code>v-model:layout</code>，就能渲染可拖拽、可缩放的栅格布局。</span>
      <span class="home-route__link">阅读指南 <span aria-hidden="true">→</span></span>
    </a>
    <a class="home-route" href="/zh/example/">
      <span class="home-route__index">02 / 示例</span>
      <strong>找一个相近的示例</strong>
      <span>示例按功能分类，每个页面都提供可以直接复制的最简示例。</span>
      <span class="home-route__link">浏览示例 <span aria-hidden="true">→</span></span>
    </a>
    <a class="home-route" href="/zh/guide/properties">
      <span class="home-route__index">03 / API</span>
      <strong>查属性和事件</strong>
      <span>查询组件属性、默认值、类型和事件。</span>
      <span class="home-route__link">打开 API 参考 <span aria-hidden="true">→</span></span>
    </a>
  </div>
</section>

<section class="home-capabilities" aria-labelledby="home-capabilities-title">
  <div class="home-section-heading">
    <h2 id="home-capabilities-title">控制栅格的交互方式</h2>
    <p>布局数据保存在应用状态中，响应式布局、碰撞处理、拖放和定位方式都可以按需配置。</p>
  </div>

  <div class="home-capability-list">
    <a href="/zh/example/responsive">
      <strong>响应式布局</strong>
      <span>在不同断点下调整列数和栅格项位置。</span>
    </a>
    <a href="/zh/example/prevent-collision">
      <strong>碰撞控制</strong>
      <span>可以推开其他栅格项、阻止碰撞，也可以允许重叠。</span>
    </a>
    <a href="/zh/example/drag-from-outside">
      <strong>拖放</strong>
      <span>移动已有栅格项，或从外部拖入新项。</span>
    </a>
    <a href="/zh/example/position-strategy">
      <strong>定位策略</strong>
      <span>可根据渲染需求选择 transform 定位或绝对定位。</span>
    </a>
    <a href="/zh/example/styling-grid-lines">
      <strong>样式定制</strong>
      <span>设置栅格线、占位符、背景和栅格项状态。</span>
    </a>
    <a href="/zh/example/composable-api">
      <strong>组合式 API</strong>
      <span>只使用布局引擎，自行决定页面结构。</span>
    </a>
  </div>
</section>
