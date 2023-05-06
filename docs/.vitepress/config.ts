import { resolve } from 'node:path'
import { defineConfig } from 'vitepress'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  vite: {
    logLevel: process.env.NODE_ENV === 'production' ? 'error' : undefined,
    resolve: {
      alias: {
        'grid-layout-plus': resolve(__dirname, '../../src')
      }
    },
    css: {
      postcss: {
        plugins: [autoprefixer]
      }
    },
    server: {
      fs: {
        allow: ['..']
      }
    }
  },
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/grid-layout-plus.svg' }]],
  title: 'Grid Layout Plus',
  lastUpdated: true,
  themeConfig: {
    logo: '/grid-layout-plus.svg',
    outline: [2, 3]
  },
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      description: 'A draggable and resizable grid layout for Vue 3.',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/installation', activeMatch: '/guide/' }
          // { text: 'Playground', link: '/markdown-examples' }
        ],
        sidebar: [
          {
            text: 'Introduction',
            items: [
              { text: 'Installation', link: '/guide/installation' },
              { text: 'Usage', link: '/guide/usage' },
              { text: 'Properties', link: '/guide/properties' },
              { text: 'Events', link: '/guide/events' },
              { text: 'Custom Style', link: '/guide/custom-style' }
            ]
          },
          {
            text: 'Example',
            items: [
              { text: 'Basic Usage', link: '/example/basic' },
              { text: 'Move and Resize Events', link: '/example/events' },
              { text: 'Multiple Grid Layouts', link: '/example/multiple-grids' },
              { text: 'Drag and Resize Handler', link: '/example/drag-resize-handler' },
              { text: 'Mirrored Grid Layout', link: '/example/mirrored' },
              { text: 'Responsive', link: '/example/responsive' },
              { text: 'Prevent Collision', link: '/example/prevent-collision' },
              { text: 'Predefined Responsive Layouts', link: '/example/responsive-layouts' },
              { text: 'Dynamic Add or Remove', link: '/example/dynamic-add-remove' },
              { text: 'Drag From Outside', link: '/example/drag-from-outside' },
              { text: 'Items Bounded to Container', link: '/example/bounded' },
              { text: 'Styling Grid Lines', link: '/example/styling-grid-lines' },
              { text: 'Styling Placeholder', link: '/example/styling-placeholder' },
              { text: 'Swappable', link: '/example/swappable' }
            ]
          }
        ],
        editLink: {
          pattern: 'https://github.com/qmhc/grid-layout-plus/edit/main/docs/en/:path',
          text: 'Edit this page on GitHub'
        },
        socialLinks: [{ icon: 'github', link: 'https://github.com/qmhc/grid-layout-plus' }],
        footer: {
          message: 'Released under the MIT License.',
          copyright: 'Copyright © 2023-present qmhc'
        }
      }
    },
    zh: {
      label: '中文',
      lang: 'zh',
      description: '一个 Vue 3 的可拖拽、可缩放的布局',
      themeConfig: {
        nav: [
          { text: '指南', link: '/zh/guide/installation', activeMatch: '/zh/guide/' }
          // { text: '游乐场', link: '/zh/markdown-examples' }
        ],
        sidebar: [
          {
            text: '介绍',
            items: [
              { text: '安装', link: '/zh/guide/installation' },
              { text: '用法', link: '/zh/guide/usage' },
              { text: '属性', link: '/zh/guide/properties' },
              { text: '事件', link: '/zh/guide/events' },
              { text: '定制样式', link: '/zh/guide/custom-style' }
            ]
          },
          {
            text: '示例',
            items: [
              { text: '基础用法', link: '/zh/example/basic' },
              { text: '移动和缩放事件', link: '/zh/example/events' },
              { text: '多个栅格布局', link: '/zh/example/multiple-grids' },
              { text: '拖拽和缩放手柄', link: '/zh/example/drag-resize-handler' },
              { text: '镜像栅格布局', link: '/zh/example/mirrored' },
              { text: '响应式', link: '/zh/example/responsive' },
              { text: '阻止碰撞', link: '/zh/example/prevent-collision' },
              { text: '预设响应式布局', link: '/zh/example/responsive-layouts' },
              { text: '动态增减元素', link: '/zh/example/dynamic-add-remove' },
              { text: '从外部拖入', link: '/zh/example/drag-from-outside' },
              { text: '元素绑定容器', link: '/zh/example/bounded' },
              { text: '定制栅格线', link: '/example/styling-grid-lines' },
              { text: '定制占位符', link: '/example/styling-placeholder' }
            ]
          }
        ],
        editLink: {
          pattern: 'https://github.com/qmhc/grid-layout-plus/edit/main/docs/:path',
          text: '在 GitHub 上编辑此页'
        },
        socialLinks: [{ icon: 'github', link: 'https://github.com/qmhc/grid-layout-plus' }],
        docFooter: {
          prev: '上一页',
          next: '下一页'
        },
        footer: {
          message: '在 MIT 协议下发布。',
          copyright: 'Copyright © 2023-present qmhc'
        },
        outlineTitle: '在这一页',
        darkModeSwitchLabel: '切换暗黑模式',
        returnToTopLabel: '返回顶部',
        langMenuLabel: '更换语言',
        sidebarMenuLabel: '菜单',
        lastUpdatedText: '最后更新日期'
      }
    }
  }
})
