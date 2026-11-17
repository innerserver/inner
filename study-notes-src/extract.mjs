import { Unzip, UnzipInflate, strFromU8 } from '../tools/study-notes/node_modules/fflate/esm/browser.js';
import { SaxesParser } from '../tools/study-notes/node_modules/saxes/saxes.js';
import { cleanText, splitText, checkUnits, validateFile, MAX_TEXT } from './core.mjs';
const MAX_XML = 2 * 1024 * 1024, MAX_EXPANDED = 8 * 1024 * 1024;
function xmlEvents(source, handlers) {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('Document XML declarations are not supported');
  const parser = new SaxesParser({ xmlns: true });
  for (const [event,handler] of Object.entries(handlers)) parser.on(event,handler);
  parser.write(source).close();
}
export function xmlText(source) {
  let result = '', inText = 0;
  xmlEvents(source, {
    opentag(tag) { if (tag.local === 't') inText++; if (['tab','br'].includes(tag.local)) result += ' '; },
    text(value) { if (inText) result += value; },
    closetag(tag) { if (tag.local === 't') inText--; if (tag.local === 'p') result += '\n'; },
  });
  return cleanText(result);
}
function relations(source) {
  const result = new Map();
  xmlEvents(source, { opentag(tag) {
    if (tag.local !== 'Relationship') return;
    const attr = (key) => Object.values(tag.attributes).find(value => value.local === key)?.value;
    if (attr('TargetMode') !== 'External') result.set(attr('Id'), { target: attr('Target'), type: attr('Type') });
  } });
  return result;
}
function resolvePart(base, target) {
  if (!target || /^[a-z]+:|^[/\\]/i.test(target)) throw new Error('Invalid embedded document reference');
  const parts = base.split('/');parts.pop();
  for (const part of target.split('/')) { if (part === '..') parts.pop(); else if (part && part !== '.') parts.push(part); }
  const result = parts.join('/');if (!result.startsWith('ppt/')) throw new Error('Invalid presentation part');return result;
}
export function readOfficeZip(bytes) {
  const files = new Map();let total=0, entries=0;
  const unzip = new Unzip(entry => {
    if (++entries > 2000) throw new Error('This document contains too many ZIP entries');
    if (!/^(ppt\/(presentation\.xml|_rels\/presentation\.xml\.rels|slides\/slide\d+\.xml|slides\/_rels\/slide\d+\.xml\.rels|notesSlides\/notesSlide\d+\.xml)|word\/document\.xml)$/.test(entry.name)) return;
    if (files.has(entry.name)) throw new Error('Duplicate document part');
    if (entry.originalSize > MAX_XML) throw new Error('A document text part exceeds 2 MB');
    const chunks=[];let size=0;
    entry.ondata=(error,data,final)=>{
      if (error) throw error;
      size+=data.length;total+=data.length;
      if (size>MAX_XML || total>MAX_EXPANDED) throw new Error('The document expands beyond the safe text limit');
      chunks.push(data);
      if (final) { const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}files.set(entry.name,strFromU8(all)); }
    };entry.start();
  });unzip.register(UnzipInflate);
  for (let offset=0;offset<bytes.length;offset+=4096) unzip.push(bytes.subarray(offset,offset+4096),offset+4096>=bytes.length);
  return files;
}
export function officeUnits(name, bytes) {
  if (bytes[0]!==0x50 || bytes[1]!==0x4b) throw new Error('This is not a valid Office document');
  const files=readOfficeZip(bytes);
  if (/\.docx$/i.test(name)) {
    if (!files.has('word/document.xml')) throw new Error('DOCX document text is missing');
    return checkUnits(splitText(xmlText(files.get('word/document.xml')),2200).map((text,index)=>({ref:`Section ${index+1}`,title:text.split('\n')[0].slice(0,90),text})));
  }
  const presentation=files.get('ppt/presentation.xml'),rels=files.get('ppt/_rels/presentation.xml.rels');
  if (!presentation || !rels) throw new Error('PPTX slide order is missing');
  const links=relations(rels), paths=[];
  xmlEvents(presentation,{opentag(tag){if(tag.local==='sldId'){const id=Object.values(tag.attributes).find(attr=>attr.local==='id' && /relationships/.test(attr.uri))?.value;const link=links.get(id);if(!link)throw new Error('PPTX slide reference is missing');paths.push(resolvePart('ppt/presentation.xml',link.target));}}});
  return checkUnits(paths.map((path,index)=>{
    if(!/^ppt\/slides\/slide\d+\.xml$/.test(path) || !files.has(path))throw new Error('PPTX slide text is missing');
    const body=xmlText(files.get(path));let text=body;
    const relPath=path.replace('slides/','slides/_rels/')+'.rels';
    if(files.has(relPath)){
      const note=[...relations(files.get(relPath)).values()].find(link=>link.type?.endsWith('/notesSlide'));
      if(note){const noteText=files.get(resolvePart(path,note.target));if(noteText){const extracted=xmlText(noteText);if(extracted)text+='\n\nSpeaker notes:\n'+extracted;}}
    }
    return{ref:`Slide ${index+1}`,title:body.split('\n')[0].slice(0,90)||'No slide text',text:cleanText(text)};
  }));
}
export async function extractFile(name, buffer, progress=()=>{}) {
  validateFile(name,buffer.byteLength);const bytes=new Uint8Array(buffer);
  if (/\.(pptx|docx)$/i.test(name)) return officeUnits(name,bytes);
  if (/\.(txt|md|csv)$/i.test(name)) {
    if (bytes.includes(0)) throw new Error('Save this text file as UTF-8 first');
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    return checkUnits(splitText(text,2200).map((text,index)=>({ref:`Section ${index+1}`,title:text.split('\n')[0].slice(0,90),text})));
  }
  if (!new TextDecoder().decode(bytes.subarray(0,5)).startsWith('%PDF-')) throw new Error('This is not a valid PDF');
  const pdfjs = await import('/vendor/study-notes/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc='/vendor/study-notes/pdf.worker.min.mjs';
  const task=pdfjs.getDocument({data:bytes,isEvalSupported:false,useWasm:false,disableFontFace:true,useSystemFonts:false,cMapUrl:'/vendor/study-notes/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/study-notes/standard_fonts/'});
  try {
    const pdf=await task.promise;if(pdf.numPages>100)throw new Error('Maximum 100 PDF pages. Split this file first.');
    const units=[];let length=0;
    for(let index=1;index<=pdf.numPages;index++){
      const page=await pdf.getPage(index),content=await page.getTextContent();let text='';
      for(const item of content.items)if(typeof item.str==='string')text+=item.str+(item.hasEOL?'\n':' ');
      text=cleanText(text);length+=text.length;if(length>MAX_TEXT)throw new Error('Maximum 200,000 extracted characters. Split this PDF first.');
      units.push({ref:`Page ${index}`,title:text.split('\n')[0].slice(0,90)||'No selectable text',text});page.cleanup();progress(index,pdf.numPages);
    }
    return checkUnits(units);
  } finally { await task.destroy(); }
}
