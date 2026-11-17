import { pipeline, env } from '../tools/study-notes/node_modules/@huggingface/transformers/dist/transformers.web.js';
import { splitText, groundedSummary } from './core.mjs';
const MODEL='Xenova/flan-t5-small', REVISION='311454e83bc784267fd7eef5940ee854144abbec';
env.allowLocalModels=false;
env.useBrowserCache=true;
env.useWasmCache=false;
env.backends.onnx.wasm.numThreads=1;
env.backends.onnx.wasm.proxy=false;
env.backends.onnx.wasm.wasmPaths={mjs:new URL('../vendor/study-notes/ort-wasm-simd-threaded.mjs',self.location.href).href,wasm:new URL('../vendor/study-notes/ort-wasm-simd-threaded.wasm',self.location.href).href};
let model=null, busy=false;
self.onmessage=async({data})=>{
  if(busy)return;busy=true;
  try{
    const chunks=data.units.flatMap((unit,index)=>splitText(unit.text,1200).map(text=>({index,text})));
    if(chunks.length>60)throw new Error('AI mode supports up to 60 text chunks. Split this document, or keep the source notes.');
    if(!model)model=await pipeline('text2text-generation',MODEL,{revision:REVISION,dtype:'q8',device:'wasm',progress_callback:event=>self.postMessage({type:'download',file:event.file||'',status:event.status,loaded:event.loaded,total:event.total})});
    const summaries=new Map();
    for(let index=0;index<chunks.length;index++){
      const chunk=chunks[index];
      const result=await model(`Summarize this text:\n\n${chunk.text}`,{max_new_tokens:100,do_sample:false,num_beams:1,no_repeat_ngram_size:3,repetition_penalty:1.1});
      const text=result[0]?.generated_text?.trim();if(!text)throw new Error('The model returned no summary. Your source notes are still available.');
      const list=summaries.get(chunk.index)||[];list.push(groundedSummary(text,chunk.text));summaries.set(chunk.index,list);
      self.postMessage({type:'summary',index:chunk.index,text:list.join('\n')});self.postMessage({type:'progress',done:index+1,total:chunks.length});
    }
    self.postMessage({type:'complete',model:MODEL});
  }catch(error){self.postMessage({type:'error',message:error.message||'Local AI could not run on this device. Source notes remain available.'});}
  finally{busy=false;}
};

