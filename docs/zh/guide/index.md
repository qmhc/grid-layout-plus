---
aside: false
pageClass: guide-overview-page
title: 指南
description: 先创建第一个 Grid Layout Plus 布局，再逐步了解 API 和高级配置。
---

# 指南

<p class="guide-overview-lede">
  布局数据由应用维护。拖拽或缩放时，<code>GridLayout</code> 会发出有效的布局变更，并等待新值通过属性传回。
</p>

<section class="guide-journey" aria-labelledby="guide-journey-title">
  <h2 id="guide-journey-title">构建第一个栅格</h2>

  <div class="guide-step-list">
    <a href="/zh/guide/installation">
      <span>01</span>
      <strong>安装并引入</strong>
      <small>添加依赖，再选择局部或全局注册组件。</small>
    </a>
    <a href="/zh/guide/usage">
      <span>02</span>
      <strong>绑定受控布局</strong>
      <small>定义栅格项坐标，绑定 <code>v-model:layout</code>，再选择插槽。</small>
    </a>
    <a href="/zh/example/basic">
      <span>03</span>
      <strong>运行基础示例</strong>
      <small>拖拽和缩放栅格项，再打开并复制最简示例。</small>
    </a>
  </div>
</section>

<section class="guide-reference" aria-labelledby="guide-reference-title">
  <div class="guide-overview-heading">
    <h2 id="guide-reference-title">查询 API</h2>
    <p>需要确认类型、默认值或事件签名时，直接查看参考页。</p>
  </div>

  <div class="guide-reference-list">
    <a href="/zh/guide/properties">
      <strong>属性</strong>
      <span>GridLayout 与 GridItem 的输入、默认值、类型、压缩器和定位策略。</span>
      <span aria-hidden="true">→</span>
    </a>
    <a href="/zh/guide/events">
      <strong>事件</strong>
      <span>布局更新，以及移动和缩放栅格项时的交互生命周期事件。</span>
      <span aria-hidden="true">→</span>
    </a>
  </div>
</section>

<section class="guide-beyond" aria-labelledby="guide-beyond-title">
  <div class="guide-overview-heading">
    <h2 id="guide-beyond-title">定制样式或迁移旧版本</h2>
  </div>

  <div class="guide-beyond-links">
    <a href="/zh/guide/custom-style"><strong>定制样式</strong><span>设置栅格项状态和交互反馈。</span></a>
    <a href="/zh/example/"><strong>按任务看示例</strong><span>每个功能都有一个可运行的小示例。</span></a>
    <a href="/zh/guide/migration"><strong>迁移指南</strong><span>替换已移除的 API，并核对行为变化。</span></a>
  </div>
</section>
