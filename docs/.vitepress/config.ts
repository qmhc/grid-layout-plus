import { resolve } from 'node:path'

import { defineConfig } from 'vitepress'
import autoprefixer from 'autoprefixer'

import { writeLlmsBundles } from './llms'

const siteUrl = 'https://grid-layout-plus.netlify.app'

function toCanonicalUrl(relativePath: string) {
  const pagePath = relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')

  return new URL(pagePath, `${siteUrl}/`).toString()
}

export default defineConfig({
  vite: {
    logLevel: process.env.NODE_ENV === 'production' ? 'error' : undefined,
    resolve: {
      alias: {
        'grid-layout-plus': resolve(__dirname, '../../src'),
      },
    },
    css: {
      postcss: {
        plugins: [autoprefixer],
      },
    },
    server: {
      fs: {
        allow: ['..'],
      },
    },
  },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/grid-layout-plus.svg' }],
    [
      'link',
      {
        rel: 'alternate',
        type: 'text/plain',
        href: '/llms.txt',
        title: 'LLM documentation index',
      },
    ],
  ],
  title: 'Grid Layout Plus',
  cleanUrls: true,
  lastUpdated: true,
  sitemap: {
    hostname: siteUrl,
  },
  transformPageData(pageData) {
    pageData.frontmatter.head ??= []
    pageData.frontmatter.head.push([
      'link',
      { rel: 'canonical', href: toCanonicalUrl(pageData.relativePath) },
    ])
  },
  async buildEnd(siteConfig) {
    await writeLlmsBundles(resolve(__dirname, '..'), siteConfig.outDir)
  },
  themeConfig: {
    logo: '/grid-layout-plus.svg',
    outline: [2, 3],
    search: {
      provider: 'local',
    },
  },
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      description: 'A draggable and resizable grid layout for Vue 3.',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/', activeMatch: '/guide/' },
          { text: 'Examples', link: '/example/', activeMatch: '/example/' },
        ],
        sidebar: {
          '/guide/': [
            {
              text: 'Guide',
              items: [
                { text: 'Overview', link: '/guide/' },
                {
                  text: 'Get started',
                  items: [
                    { text: 'Installation', link: '/guide/installation' },
                    { text: 'Usage', link: '/guide/usage' },
                    { text: 'Common Tasks', link: '/guide/recipes' },
                  ],
                },
                {
                  text: 'API reference',
                  items: [
                    { text: 'API Index', link: '/guide/api-index' },
                    { text: 'Properties', link: '/guide/properties' },
                    { text: 'Events', link: '/guide/events' },
                    { text: 'Methods', link: '/guide/methods' },
                    { text: 'Composables', link: '/guide/composables' },
                    { text: 'Operation Contracts', link: '/guide/contracts' },
                    { text: 'Core API', link: '/guide/core-api' },
                  ],
                },
                {
                  text: 'Customize and migrate',
                  items: [
                    { text: 'Custom Styling', link: '/guide/custom-style' },
                    { text: 'Migration from v1', link: '/guide/migration' },
                  ],
                },
              ],
            },
          ],
          '/example/': [
            {
              text: 'Examples',
              items: [
                { text: 'Overview', link: '/example/' },
                {
                  text: 'Core layout',
                  items: [
                    { text: 'Basic Usage', link: '/example/basic' },
                    { text: 'Adding and Removing Items', link: '/example/dynamic-add-remove' },
                    { text: 'Content-driven Height', link: '/example/auto-height' },
                    { text: 'Move and Resize Events', link: '/example/events' },
                  ],
                },
                {
                  text: 'Interaction constraints',
                  items: [
                    { text: 'Drag and Resize Handles', link: '/example/drag-resize-handler' },
                    { text: 'Items Bounded to Container', link: '/example/bounded' },
                    { text: 'Drag Threshold', link: '/example/drag-threshold' },
                    { text: 'Prevent Collision', link: '/example/prevent-collision' },
                    { text: 'Allow Overlap', link: '/example/allow-overlap' },
                  ],
                },
                {
                  text: 'Responsive and placement',
                  items: [
                    { text: 'Responsive', link: '/example/responsive' },
                    { text: 'Predefined Responsive Layouts', link: '/example/responsive-layouts' },
                    { text: 'Mirrored Grid Layout', link: '/example/mirrored' },
                    { text: 'Horizontal Compaction', link: '/example/horizontal-compact' },
                    { text: 'No Compaction', link: '/example/no-compact' },
                    { text: 'Position Strategy', link: '/example/position-strategy' },
                  ],
                },
                {
                  text: 'Drag and drop',
                  items: [
                    { text: 'Native Drag & Drop', link: '/example/native-drop' },
                    { text: 'Drag From Outside', link: '/example/drag-from-outside' },
                  ],
                },
                {
                  text: 'Styling',
                  items: [
                    { text: 'Styling Grid Lines', link: '/example/styling-grid-lines' },
                    { text: 'Styling Placeholder', link: '/example/styling-placeholder' },
                    { text: 'Grid Background', link: '/example/grid-background' },
                  ],
                },
                {
                  text: 'Advanced API',
                  items: [
                    { text: 'Config Grouping', link: '/example/config-grouping' },
                    { text: 'Composable API', link: '/example/composable-api' },
                  ],
                },
              ],
            },
          ],
        },
        editLink: {
          pattern: 'https://github.com/qmhc/grid-layout-plus/edit/main/docs/:path',
          text: 'Edit this page on GitHub',
        },
        socialLinks: [{ icon: 'github', link: 'https://github.com/qmhc/grid-layout-plus' }],
        footer: {
          message: 'Released under the MIT License.',
          copyright: 'Copyright © 2023-present qmhc',
        },
      },
    },
    zh: {
      label: '中文',
      lang: 'zh',
      description: '适用于 Vue 3 的可拖拽、可缩放栅格布局组件',
      themeConfig: {
        nav: [
          { text: '指南', link: '/zh/guide/', activeMatch: '/zh/guide/' },
          { text: '示例', link: '/zh/example/', activeMatch: '/zh/example/' },
        ],
        sidebar: {
          '/zh/guide/': [
            {
              text: '指南',
              items: [
                { text: '总览', link: '/zh/guide/' },
                {
                  text: '开始使用',
                  items: [
                    { text: '安装', link: '/zh/guide/installation' },
                    { text: '用法', link: '/zh/guide/usage' },
                    { text: '常见任务', link: '/zh/guide/recipes' },
                  ],
                },
                {
                  text: 'API 参考',
                  items: [
                    { text: 'API 索引', link: '/zh/guide/api-index' },
                    { text: '属性', link: '/zh/guide/properties' },
                    { text: '事件', link: '/zh/guide/events' },
                    { text: '方法', link: '/zh/guide/methods' },
                    { text: '组合式函数', link: '/zh/guide/composables' },
                    { text: '操作契约', link: '/zh/guide/contracts' },
                    { text: 'Core API', link: '/zh/guide/core-api' },
                  ],
                },
                {
                  text: '定制与迁移',
                  items: [
                    { text: '定制样式', link: '/zh/guide/custom-style' },
                    { text: '从 v1 迁移', link: '/zh/guide/migration' },
                  ],
                },
              ],
            },
          ],
          '/zh/example/': [
            {
              text: '示例',
              items: [
                { text: '总览', link: '/zh/example/' },
                {
                  text: '基础布局',
                  items: [
                    { text: '基础用法', link: '/zh/example/basic' },
                    { text: '动态增减栅格项', link: '/zh/example/dynamic-add-remove' },
                    { text: '内容驱动高度', link: '/zh/example/auto-height' },
                    { text: '移动和缩放事件', link: '/zh/example/events' },
                  ],
                },
                {
                  text: '交互约束',
                  items: [
                    { text: '拖拽和缩放手柄', link: '/zh/example/drag-resize-handler' },
                    { text: '栅格项限制在容器内', link: '/zh/example/bounded' },
                    { text: '拖拽阈值', link: '/zh/example/drag-threshold' },
                    { text: '阻止碰撞', link: '/zh/example/prevent-collision' },
                    { text: '允许重叠', link: '/zh/example/allow-overlap' },
                  ],
                },
                {
                  text: '响应式与定位',
                  items: [
                    { text: '响应式', link: '/zh/example/responsive' },
                    { text: '预设响应式布局', link: '/zh/example/responsive-layouts' },
                    { text: '镜像栅格布局', link: '/zh/example/mirrored' },
                    { text: '水平压缩', link: '/zh/example/horizontal-compact' },
                    { text: '无压缩', link: '/zh/example/no-compact' },
                    { text: '定位策略', link: '/zh/example/position-strategy' },
                  ],
                },
                {
                  text: '拖放',
                  items: [
                    { text: '原生拖放', link: '/zh/example/native-drop' },
                    { text: '从外部拖入', link: '/zh/example/drag-from-outside' },
                  ],
                },
                {
                  text: '样式定制',
                  items: [
                    { text: '定制栅格线', link: '/zh/example/styling-grid-lines' },
                    { text: '定制占位符', link: '/zh/example/styling-placeholder' },
                    { text: '栅格背景', link: '/zh/example/grid-background' },
                  ],
                },
                {
                  text: '高级 API',
                  items: [
                    { text: '配置分组', link: '/zh/example/config-grouping' },
                    { text: '组合式 API', link: '/zh/example/composable-api' },
                  ],
                },
              ],
            },
          ],
        },
        editLink: {
          pattern: 'https://github.com/qmhc/grid-layout-plus/edit/main/docs/:path',
          text: '在 GitHub 上编辑此页',
        },
        socialLinks: [{ icon: 'github', link: 'https://github.com/qmhc/grid-layout-plus' }],
        docFooter: {
          prev: '上一页',
          next: '下一页',
        },
        footer: {
          message: '基于 MIT 许可证发布。',
          copyright: 'Copyright © 2023-present qmhc',
        },
        outlineTitle: '本页目录',
        darkModeSwitchLabel: '切换深色模式',
        returnToTopLabel: '返回顶部',
        langMenuLabel: '更换语言',
        sidebarMenuLabel: '菜单',
        lastUpdatedText: '最后更新日期',
      },
    },
  },
})
