import { defineConfig } from 'vite';
import { resolve } from 'path';
export default defineConfig({
    server: {
        open: '/src/index',
        fsServe: {
            root: resolve(__dirname, 'public')
        }
    },
});