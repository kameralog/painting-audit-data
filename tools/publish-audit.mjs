import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const source='catalogue-review-compact.json',dir='generated-audit',limit=20000;
const raw=fs.readFileSync(source,'utf8').replace(/^\uFEFF/,''),data=JSON.parse(raw);
if(!Array.isArray(data.rows))throw Error('Expected rows');
fs.mkdirSync(dir,{recursive:true});
for(const name of fs.readdirSync(dir))if(/^(summary|index-\d+|record-\d+(?:-part-\d+)?)\.json$/.test(name))fs.unlinkSync(path.join(dir,name));
const written=[];
function put(name,value){const text=JSON.stringify(value);if(Buffer.byteLength(text)>limit)throw Error('Output too large: '+name);fs.writeFileSync(path.join(dir,name),text,'utf8');written.push(name);}
function record(value,number){const stem='record-'+String(number).padStart(4,'0'),text=JSON.stringify(value);if(Buffer.byteLength(text)<=limit){put(stem+'.json',value);return [stem+'.json'];}
 const chunks=[];let current='',bytes=0;for(const char of text){const size=Buffer.byteLength(char);if(bytes+size>8500){chunks.push(current);current='';bytes=0;}current+=char;bytes+=size;}if(current)chunks.push(current);
 return chunks.map((fragment,i)=>{const name=stem+'-part-'+String(i+1).padStart(3,'0')+'.json';put(name,{format:'json-text-fragment',record:number,part:i+1,total:chunks.length,text:fragment});return name;});
}
const input=[...data.rows.map(row=>({kind:'work',row})),...(data.textTasks||[]).map(row=>({kind:'text',row}))];
const indexes=[];for(const[itemNumber,item]of input.entries()){const r=item.row,candidates=r.candidates||[],buckets={};for(const c of candidates){const b=c.review?.bucket||c.review?.reason||'unclassified';buckets[b]=(buckets[b]||0)+1;}
 indexes.push({number:itemNumber+1,kind:item.kind,id:r.id,artist:r.artist,work:r.work,key:r.key||'',source:r.source||r.museum||'',keyMissing:!r.key,status:r.status,candidateCount:candidates.length,buckets,files:record(r,itemNumber+1)});
}
const indexFiles=[];let page=[];function flush(){if(!page.length)return;const name='index-'+String(indexFiles.length+1).padStart(3,'0')+'.json';put(name,{records:page});indexFiles.push(name);page=[];}
for(const item of indexes){if(Buffer.byteLength(JSON.stringify({records:[...page,item]}))>limit)flush();page.push(item);}flush();
put('summary.json',{generatedBy:'publish-audit-v1',source,sourceSha256:createHash('sha256').update(raw).digest('hex'),snapshot:data.snapshot||null,exportedAt:data.exportedAt||null,sourceCounts:data.counts||null,structuredRecords:data.rows.length,textTasks:(data.textTasks||[]).length,existingWorks:(data.existingWorks||[]).length,candidates:input.reduce((n,x)=>n+(x.row.candidates||[]).length,0),indexFiles,recordsPublished:indexes.length,reassembly:'Read indexes; ordinary record JSON is complete. For json-text-fragment concatenate text fields in part order, then parse JSON. Source remains unchanged.'});
console.log(JSON.stringify({records:indexes.length,files:written.length,indexFiles}));
