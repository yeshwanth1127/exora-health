import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],server:{host:'127.0.0.1',port:5250,strictPort:true,proxy:Object.fromEntries(['/public','/website-config.js','/sarvam-runtime'].map(path=>[path,{target:process.env.HMS_PUBLIC_BOOKING_PROXY||'http://127.0.0.1:3038',changeOrigin:true}]))}});
