(() => {
  const core = window.ConnectifiStudyCore;
  let active = null;
  function open(record = null) {
    if (!state.loggedIn) return;
    active?.close();
    const dialog = document.createElement('dialog');dialog.className='school-dialog study-notes-dialog';
    dialog.setAttribute('aria-labelledby','studyNotesHeading');
    // Static UI only. File names, extracted text and model output use textContent.
    dialog.innerHTML='<header class="school-dialog-heading"><div><h2 id="studyNotesHeading">Study notes</h2><p class="panel-note">Presentations and documents, processed on this device</p></div><button type="button" class="secondary-button" data-close>Close</button></header><p class="study-notes-intro">Create source-linked notes from PPTX, text-based PDF, DOCX, TXT, Markdown or CSV. Files stay on your device. Source notes work without a model download or paid API.</p><div class="study-notes-controls"><label>Choose a document<input type="file" accept=".pptx,.pdf,.docx,.txt,.md,.csv" data-file></label><label>Detail<select data-detail><option value="brief">Brief</option><option value="standard" selected>Standard</option><option value="detailed">Detailed</option></select></label></div><p class="panel-note">Up to 25 MB and 100 pages, slides or sections. Slide pictures, charts and scanned pages are not converted to text. Save old .ppt/.doc files as PPTX/DOCX first.</p><div class="button-row study-notes-actions"><button type="button" class="primary-button" data-make>Create source notes</button><button type="button" class="secondary-button" data-ai>Download free model and summarize</button><button type="button" class="secondary-button" data-stop hidden>Stop</button></div><p class="panel-note">Optional AI uses FLAN-T5 Small locally, with no API key or inference charge. First use downloads model files from Hugging Face and uses device memory. English summaries work best. Check AI-selected source pointss against the source.</p><div class="study-notes-progress"><progress max="1" value="0" aria-label="Document notes progress"></progress><p role="status" aria-live="polite" data-status>Choose a document to begin.</p></div><div class="study-notes-results-heading"><h3 data-source>No document selected</h3><div class="button-row"><button type="button" class="secondary-button" data-copy>Copy notes</button><button type="button" class="secondary-button" data-save>Download notes</button></div></div><div class="study-notes-results" data-results></div>';
    const get = selector => dialog.querySelector(selector);
    const picker=get('[data-file]'),detail=get('[data-detail]'),make=get('[data-make]'),ai=get('[data-ai]'),stop=get('[data-stop]'),copy=get('[data-copy]'),save=get('[data-save]'),status=get('[data-status]'),progress=get('progress'),results=get('[data-results]');
    let generation=0,closed=false,busy=false,extractWorker=null,aiWorker=null,download=null,timer=null,chosen=null,units=[],notes=[],name='';
    const valid=token=>!closed && token===generation && state.loggedIn;
    const buttons=()=>{make.disabled=busy || (!chosen && !units.length);ai.disabled=busy || !units.length;picker.disabled=detail.disabled=busy;copy.disabled=save.disabled=busy || !notes.length;stop.hidden=!busy;};
    const setStatus=(message,done=null,total=1)=>{status.textContent=message;if(done===null)progress.removeAttribute('value');else{progress.max=total;progress.value=done;}};
    function stopWork(message='Stopped. Any completed source notes remain available.') {
      ++generation;clearTimeout(timer);timer=null;extractWorker?.terminate();extractWorker=null;aiWorker?.terminate();aiWorker=null;download?.abort();download=null;busy=false;buttons();if(!closed)setStatus(message,0);
    }
    function finish(message){clearTimeout(timer);timer=null;busy=false;stop.hidden=true;buttons();setStatus(message,1);}
    function watchdog(token,ms,message){clearTimeout(timer);timer=setTimeout(()=>{if(valid(token))stopWork(message);},ms);}
    function renderNotes() {
      results.replaceChildren();
      for(const note of notes){
        const card=document.createElement('article');card.className='study-notes-card';
        const heading=document.createElement('h4');heading.textContent=`${note.ref}: ${note.title}`;card.append(heading);
        const list=document.createElement('ul');for(const point of note.bullets){const line=document.createElement('li');line.textContent=point;list.append(line);}card.append(list);
        if(note.aiSummary){const label=document.createElement('strong'),summary=document.createElement('p');label.textContent='AI-selected source points';summary.className='school-text';summary.textContent=note.aiSummary;card.append(label,summary);}
        if(note.terms.length){const terms=document.createElement('p');terms.className='panel-note';terms.textContent=`Key terms: ${note.terms.join(', ')}`;card.append(terms);}
        const source=document.createElement('details'),label=document.createElement('summary'),text=document.createElement('p');label.textContent='Source text';text.className='study-notes-source';text.textContent=note.text;source.append(label,text);card.append(source);results.append(card);
      }
    }
    function createNotes(){notes=core.makeSourceNotes(units,detail.value);renderNotes();finish(`${notes.length} source sections ready. Source points are extracts, not AI-generated text.`);}
    async function extract(file) {
      stopWork('Reading document text…');units=[];notes=[];results.replaceChildren();chosen=file;name=file.name;get('[data-source]').textContent=name;
      const token=generation;busy=true;buttons();
      try {
        core.validateFile(file.name,file.size);const buffer=await file.arrayBuffer();if(!valid(token))return;
        extractWorker=new Worker('/study-notes/extract-worker.js?v=260',{type:'module'});
        watchdog(token,45000,'Document processing stopped after 45 seconds. Try a smaller file.');
        extractWorker.onerror=()=>{if(valid(token))stopWork('Could not read this document on this device. Try a text-based PDF or TXT file.');};
        extractWorker.onmessage=({data})=>{
          if(!valid(token))return;
          if(data.type==='progress')setStatus(`Reading page ${data.done} of ${data.total}`,data.done,data.total);
          else if(data.type==='error')stopWork(data.message);
          else if(data.type==='result'){extractWorker.terminate();extractWorker=null;units=data.units.filter(unit=>core.cleanText(unit.text));createNotes();}
        };
        extractWorker.postMessage({name:file.name,buffer},[buffer]);
      } catch(error){if(valid(token))stopWork(error.message||'Could not open this file');}
    }
    async function readStoredFile(file) {
      stopWork('Fetching your document through Connectifi…');const token=generation;busy=true;buttons();download=new AbortController();
      watchdog(token,45000,'Download stopped after 45 seconds. You can choose a local copy instead.');
      try {
        core.validateFile(file.originalName,Number(file.size));
        const response=await fetch(`/api/files/${encodeURIComponent(file.id)}/download`,{credentials:'same-origin',redirect:'error',signal:download.signal});
        if(!response.ok)throw new Error(response.status===403?'You no longer have access to this file.':'This file could not be downloaded');
        const reader=response.body.getReader(),chunks=[];let size=0;
        while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>core.MAX_FILE_BYTES){await reader.cancel();throw new Error('This file is larger than 25 MB');}chunks.push(value);}
        if(!valid(token))return;await extract(new File(chunks,file.originalName));
      }catch(error){if(valid(token))stopWork(error.name==='AbortError'?'Download stopped.':error.message);}
    }
    function summarize() {
      if(!units.length || busy)return;
      const token=++generation;busy=true;buttons();setStatus('Loading the free local model. Document text is not sent to Hugging Face.');
      try {
        if(!aiWorker)aiWorker=new Worker('/study-notes/ai-worker.js?v=260',{type:'module'});
        watchdog(token,180000,'Local AI stopped after three minutes without progress. Source notes are still available.');
        aiWorker.onerror=()=>{if(valid(token))stopWork('Local AI could not start on this device. You can use or download the source notes.');};
        aiWorker.onmessage=({data})=>{
          if(!valid(token))return;
          watchdog(token,180000,'Local AI stopped after three minutes without progress. Source notes are still available.');
          if(data.type==='download'){
            const known=Number.isFinite(data.total)&&data.total>0&&Number.isFinite(data.loaded);
            setStatus(known?`Loading model: ${data.file} (${Math.round(data.loaded/1048576)} of ${Math.ceil(data.total/1048576)} MB)`:'Loading model files. Cached files will be reused when available.',known?data.loaded:null,known?data.total:1);
          }else if(data.type==='summary'){if(notes[data.index])notes[data.index].aiSummary=data.text;renderNotes();}
          else if(data.type==='progress')setStatus(`Summarized ${data.done} of ${data.total} text chunks`,data.done,data.total);
          else if(data.type==='complete')finish('AI-selected source pointss ready. Check details against the source text before using them.');
          else if(data.type==='error')stopWork(data.message);
        };
        aiWorker.postMessage({units});
      }catch(error){stopWork(error.message||'Local AI could not start');}
    }
    const close=()=>{dialog.close();};active={close};
    get('[data-close]').onclick=close;stop.onclick=()=>stopWork();
    picker.onchange=()=>{chosen=picker.files[0]||null;units=[];notes=[];results.replaceChildren();name=chosen?.name||'';get('[data-source]').textContent=name||'No document selected';setStatus(chosen?'Ready to create source notes.':'Choose a document to begin.',0);buttons();};
    make.onclick=()=>{if(units.length)createNotes();else if(chosen)void extract(chosen);};
    detail.onchange=()=>{if(units.length)createNotes();};ai.onclick=summarize;
    copy.onclick=async()=>{try{await navigator.clipboard.writeText(core.exportNotes(name,notes));setStatus('Notes copied.',1);}catch{setStatus('Clipboard access is unavailable. Use Download notes instead.',1);}};
    save.onclick=()=>{const url=URL.createObjectURL(new Blob([core.exportNotes(name,notes)],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=(name.replace(/\.[^.]+$/,'')||'document')+'-notes.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    dialog.addEventListener('close',()=>{closed=true;stopWork();chosen=null;units=[];notes=[];results.replaceChildren();dialog.remove();observer.disconnect();if(active?.close===close)active=null;},{once:true});
    const observer=new MutationObserver(()=>{if(!state.loggedIn || document.getElementById('appView').classList.contains('hidden'))close();});observer.observe(document.getElementById('appView'),{attributes:true,attributeFilter:['class']});
    document.body.append(dialog);dialog.showModal();buttons();if(record)void readStoredFile(record);
  }
  window.ConnectifiStudyNotes={open,supports:name=>core.SUPPORTED.test(name)};
  document.getElementById('openStudyNotesButton').onclick=()=>open();
})();

