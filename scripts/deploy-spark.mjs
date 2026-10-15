import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadEnv } from 'vite';
const env=loadEnv('production',process.cwd(),'VITE_');
const config=JSON.parse(readFileSync('firebase.spark.json','utf8'));
if(env.VITE_USE_EMULATORS!=='false'||env.VITE_FIREBASE_BACKEND!=='spark'||env.VITE_FIREBASE_PROJECT_ID!=='funka-joel-2026'||!env.VITE_FIREBASE_API_KEY||!env.VITE_FIREBASE_APP_ID||!env.VITE_FIREBASE_AUTH_DOMAIN)throw new Error('Configura el SDK web real, backend spark y emuladores false antes de publicar.');
if(config.functions||config.firestore.rules!=='firestore.spark.rules'||config.hosting.site!=='pendientesfunka')throw new Error('El despliegue debe contener solo reglas Spark, índices y el sitio pendientesfunka.');
for(const [command,args] of [['npm',['run','build']],['./node_modules/.bin/firebase',['deploy','--config','firebase.spark.json','--project','funka-joel-2026','--only','firestore:rules,firestore:indexes,hosting','--non-interactive']]]){
  const r=spawnSync(command,args,{stdio:'inherit',env:{...process.env,...env}});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status||1);
}
