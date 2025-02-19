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
            from: /^\/login$/,
            to: '/login.html'
        }, {
            from: /^\/logout$/,
            to: '/logout.html'
        }, {
            from: /^\/register$/,
            to: '/register.html'
        }, {
            from: /^\/password_reset$/,
            to: '/password_reset.html'
        }, {
            from: /^\/mail_confirm$/,
            to: '/mail_confirm.html'
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