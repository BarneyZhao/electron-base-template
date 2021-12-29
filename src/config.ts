import { app } from 'electron';

export default {
    WINDOW_OPS: {
        width: 1600,
        height: 900,
        title: 'electron-base',
    },
    DEV_URL: 'https://barneyzhao.github.io/wallpaper-engine-video-viewer/',
    // DEV_URL: 'http://localhost:3000',
    // 前端项目构建后的 dist 文件夹改名 app 后放入项目根目录
    // PROD_URL: 'app/index.html',
    PROD_URL: 'https://barneyzhao.github.io/wallpaper-engine-video-viewer/',
    APP_MENUS: [
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
    ],
    MAC_MENUS: {
        label: app.getName(),
        submenu: [
            { label: '关于 ' + app.getName(), role: 'about' },
            { type: 'separator' },
            { label: '服务', role: 'services', submenu: [] },
            { type: 'separator' },
            { label: '退出 ' + app.getName(), role: 'quit' },
        ],
    },
};

export const POOL_SIZE = 4;
