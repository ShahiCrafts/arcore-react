import os from 'os'; for(const xs of Object.values(os.networkInterfaces())) for(const x of xs||[]) if(x.family==='IPv4'&&!x.internal) console.log(`Open on phone: https://${x.address}:5173`);
