<p align="center">
  <a href="https://grid-layout-plus.netlify.app/" target="_blank" rel="noopener noreferrer">
    <img src="./docs/public/grid-layout-plus.svg" width="180" style="width: 120px;" />
  </a>
</p>

<h1 align="center">Grid Layout Plus</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/grid-layout-plus" target="_blank">
    <img src="https://img.shields.io/github/package-json/v/qmhc/grid-layout-plus" alt="npm version"/>
  </a>
</p>

## Version 2 Beta

> [!IMPORTANT]
> Grid Layout Plus v2 is currently in beta and includes breaking changes from v1.

Install the v2 beta:

```sh
pnpm add grid-layout-plus@beta
```

Version 2 introduces a controlled `Layout` model, explicit stylesheet imports, headless composables, and a DOM-free Core API.

If you are upgrading an existing project, read the [Migration from v1](https://docs-next--grid-layout-plus.netlify.app/guide/migration) guide first. A [Chinese migration guide](https://docs-next--grid-layout-plus.netlify.app/zh/guide/migration) is also available.

To remain on the stable v1 release:

```sh
pnpm add grid-layout-plus@^1
```

## What is Grid Layout Plus?

Grid Layout Plus is a draggable and resizable grid layout system for Vue 3. It was originally migrated from [Vue Grid Layout](https://github.com/jbaysolutions/vue-grid-layout).

> It is constructed with `<script setup>` and normalized TypeScript.

<details>
  <summary>About Vue Grid Layout</summary>
  
## What is Vue Grid Layout?

Vue Grid Layout is a grid layout system for Vue 2, like [Gridster](http://dsmorse.github.io/gridster.js/).

**Heavily inspired by [React Grid Layout](https://github.com/STRML/react-grid-layout).**

</details>

## Features

- Draggable widgets
- Resizable widgets
- Static widgets
- Bounds checking for dragging and resizing
- Widgets may be added or removed without rebuilding grid
- Layout can be serialized and restored
- Automatic RTL support
- Responsive

## Documentation

Check out the online documentation [here](https://grid-layout-plus.netlify.app/).

## License

All in [MIT](./LICENSE.md) license.
