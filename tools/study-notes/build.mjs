import { build } from 'esbuild';
import { mkdir,copyFile,cp,writeFile,readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),vendor=path.join(root,'public/vendor/study-notes'),out=path.join(root,'public/study-notes');
await mkdir(vendor,{recursive:true});await mkdir(out,{recursive:true});
const dependencies=path.join(here,'node_modules');
const common={bundle:true,platform:'browser',format:'esm',target:'es2022',minify:true,legalComments:'linked'};
await build({...common,entryPoints:[path.join(root,'study-notes-src/core.mjs')],outfile:path.join(out,'core.js'),format:'iife',globalName:'ConnectifiStudyCore'});
await build({...common,entryPoints:[path.join(root,'study-notes-src/extract-worker.mjs')],outfile:path.join(out,'extract-worker.js'),external:['/vendor/*']});
await build({...common,entryPoints:[path.join(root,'study-notes-src/ai-worker.mjs')],outfile:path.join(out,'ai-worker.js'),minify:false,alias:{'onnxruntime-web/webgpu':path.join(dependencies,'onnxruntime-web/dist/ort.wasm.bundle.min.mjs')}});
for(const file of ['ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm'])await copyFile(path.join(dependencies,'onnxruntime-web/dist',file),path.join(vendor,file));
for(const file of ['pdf.min.mjs','pdf.worker.min.mjs'])await copyFile(path.join(dependencies,'pdfjs-dist/build',file),path.join(vendor,file));
for(const folder of ['cmaps','standard_fonts'])await cp(path.join(dependencies,'pdfjs-dist',folder),path.join(vendor,folder),{recursive:true});
await copyFile(path.join(here,'licenses/saxes-LICENSE.txt'),path.join(dependencies,'saxes/LICENSE'));
const licenses=['@huggingface/transformers','@huggingface/jinja','@huggingface/tokenizers','onnxruntime-web','onnxruntime-common','pdfjs-dist','fflate','saxes','xmlchars'];
const notices=['# Study notes dependencies','Generated with pinned versions in tools/study-notes/package-lock.json.','Model: Xenova/flan-t5-small, revision 311454e83bc784267fd7eef5940ee854144abbec, Apache-2.0. Model weights are downloaded by the user, not bundled.'];
for(const name of licenses){const pkg=JSON.parse(await readFile(path.join(dependencies,name,'package.json'),'utf8'));let license='';for(const file of ['LICENSE','LICENSE.txt','LICENSE.md','LICENSE-MIT.txt']){try{license=await readFile(path.join(dependencies,name,file),'utf8');break;}catch{}}if(!license && name.startsWith('onnxruntime-'))license=await readFile(path.join(here,'licenses/onnxruntime-LICENSE.txt'),'utf8');if(!license)throw new Error('Missing license for '+name);notices.push(`\n## ${name} ${pkg.version}\n\n${license}`);}
await writeFile(path.join(vendor,'THIRD_PARTY_NOTICES.md'),notices.join('\n\n'));
console.log('Built study notes workers, runtime assets and license notices. Model weights are not bundled.');

// This T5-only worker does not need Mistral model registration. Its class-name
// string is misidentified as an API key by GitHub push protection.
const aiFile=path.join(out,'ai-worker.js');
await writeFile(aiFile,(await readFile(aiFile,'utf8')).split('\n').filter(line=>!line.trim().startsWith('["mistral3",')).join('\n'));
