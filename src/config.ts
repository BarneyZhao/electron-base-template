import { app } from 'electron';

export const IS_DEV = process.env.NODE_ENV === 'dev';

// 本地的前端开发服务
export const DEV_URL = 'http://localhost:3000';

// 前端项目构建后的 dist 文件夹改名 app 后放入项目根目录
export const PROD_URL = 'app/index.html';

export const WINDOW_OPS = {
    width: 1600,
    height: 900,
    minWidth: 1600,
    minHeight: 900,
    title: 'electron-base',
};

export const APP_MENUS = [
    {
        label: '窗口',
        role: 'window',
        submenu: [
            { label: '开启/关闭全屏', role: 'togglefullscreen' },
            { label: '重新加载', role: 'reload' },
            { label: '最小化', role: 'minimize' },
            { label: '关闭', role: 'close' },
        ],
    },
    {
        label: '帮助',
        role: 'help',
        submenu: [{ label: '开启/关闭开发者模式', role: 'toggledevtools' }],
    },
];
export const MAC_MENUS = {
    label: app.getName(),
    submenu: [
        { label: '关于 ' + app.getName(), role: 'about' },
        { type: 'separator' },
        { label: '服务', role: 'services', submenu: [] },
        { type: 'separator' },
        { label: '退出 ' + app.getName(), role: 'quit' },
    ],
};

export const POOL_SIZE = 4;
