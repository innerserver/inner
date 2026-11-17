import { extractFile } from './extract.mjs';
self.onmessage=async({data})=>{
  try { const units=await extractFile(data.name,data.buffer,(done,total)=>self.postMessage({type:'progress',done,total}));self.postMessage({type:'result',units}); }
  catch(error){self.postMessage({type:'error',message:error.name==='PasswordException'?'This PDF is password-protected. Save an unlocked copy first.':error.message||'Could not extract document text'});}
};
