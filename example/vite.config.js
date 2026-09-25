import {defineConfig} from 'vite'; import react from '@vitejs/plugin-react'; import fs from 'fs'; import path from 'path';
const cert=path.resolve('certs/server.crt'), key=path.resolve('certs/server.key');
export default defineConfig({plugins:[react()],server:{host:'0.0.0.0',port:5173,strictPort:true,https:fs.existsSync(cert)&&fs.existsSync(key)?{cert:fs.readFileSync(cert),key:fs.readFileSync(key)}:undefined},build:{outDir:'dist',emptyOutDir:true}});
