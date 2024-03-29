# electron-base-template

Only node with `TS` & `eslint` & `prettier` etc, using `pnpm`, required `nodejs:v16.13.1` or higher.
<br><br>
纯 `TS` Electron 开发模板，集成 `eslint`、`prettier` 等实用工具。

## Integrated 集成

-   typescript
-   ts-node
-   eslint
-   prettier
-   nodemon
-   electron-builder
-   node-worker-threads-pool

## Development 开发

```shell
pnpm i

pnpm run dev-ts // TS compiler and hot update
pnpm run dev-el // Electron and hot update
```

## Build 构建

```shell
pnpm run build-mac
pnpm run build-win
```
