import {defineConfig} from 'vite';
import {resolve} from 'path';
import config from "./config.js";

export default defineConfig({
    root: 'src',
    server: {
        allowedHosts: config.prod ? config.allowHost : ['localhost'],
        rewrite: [{
            from: /^\/preview$/,
            to: '/preview.html'
        }, {
            from: /^\/editor$/,
            to: '/editor.html'
        }],
        proxy: {
            '/api': {
                target: config.apiUrl,
                changeOrigin: true,
            },
            '/ws': {
                target: config.wsUrl,
                changeOrigin: true,
                ws: true
            }
        },
        host: config.prod ? '0.0.0.0' : 'localhost',
        port: config.prod ? 5174 : 5173,
    },
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'src/index.html'),
                calendar: resolve(__dirname, 'src/apps-calendar.html'),
                chat: resolve(__dirname, 'src/apps-chat.html')
            }
        },
        outDir: '../dist'
    },
    publicDir: 'assets',
});