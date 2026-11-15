(() => {
  const el = (id) => document.getElementById(id), panel=el('gradeProgressionPanel'), status=el('gradeProgressionStatus');
  let plan=null, busy=false, generation=0;
  const identity=()=>`${state.user?.username}:${state.csrfToken}`;
  const text=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;return node;};
  const now=new Date();el('gradeProgressionCycle').value=`${now.getFullYear()}-${now.getFullYear()+1}`;
  function tab(grades){
    panel.hidden=!grades;el('gradeAdminControls').hidden=grades;
    el('adminControlsTab').setAttribute('aria-selected',String(!grades));el('gradeProgressionTab').setAttribute('aria-selected',String(grades));
    el('adminControlsTab').tabIndex=grades?-1:0;el('gradeProgressionTab').tabIndex=grades?0:-1;
    if(grades)void refresh();
  }
  el('adminControlsTab').onclick=()=>tab(false);el('gradeProgressionTab').onclick=()=>tab(true);
  for(const button of [el('adminControlsTab'),el('gradeProgressionTab')])button.onkeydown=(event)=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const grades=event.key==='End'||(event.key!=='Home'&&button===el('adminControlsTab'));tab(grades);el(grades?'gradeProgressionTab':'adminControlsTab').focus();}};
  function render(next){
    plan=next;el('gradeProgressionPreview').replaceChildren();el('gradeProgressionConfirm').checked=false;
    el('approveGradeProgression').disabled=true;el('gradeProgressionApproval').hidden=!plan||plan.status!=='preview';
    if(!plan)return;
    const root=el('gradeProgressionPreview');root.append(text('h4',`${plan.cycle}: ${plan.moves.length} students${plan.status==='applied'?' updated':''}`));
    for(let year=6;year<=12;year++){
      const group=plan.moves.filter(move=>window.ConnectifiGrades.gradeYear(move.from)===String(year));if(!group.length)continue;
      const section=document.createElement('section');section.className='grade-roster-section';section.append(text('h4',year===12?'Grade 12 graduation':`Grade ${year} to Grade ${year+1}`));
      if(year===12){section.append(text('p',plan.deleteAfter?`Export deadline and account deletion: ${new Date(plan.deleteAfter).toLocaleString()}`:'These accounts will have one calendar month from approval to export chats.'));const list=document.createElement('ul');group.forEach(move=>list.append(text('li',`${move.username} (${move.from})`)));section.append(list);}
      else{
        const totals=(plan.destinationCounts||[]).find(entry=>entry.grade===String(year+1));
        if(totals){section.append(text('p',`Total students after this update: ${year+1}A: ${totals.after.A}, ${year+1}B: ${totals.after.B}, ${year+1}C: ${totals.after.C}. Students already staying in these classes keep their placement.`));if(Math.max(...Object.values(totals.after))-Math.min(...Object.values(totals.after))>3)section.append(text('p','The existing class imbalance still exceeds 3 students. New arrivals have been placed in the smallest classes. Review the totals before approval.'));}
        const columns=document.createElement('div');columns.className='grade-roster-columns';
        for(const letter of 'ABC'){const members=group.filter(move=>move.to===`${year+1}${letter}`),column=document.createElement('div');column.append(text('h5',`${year+1}${letter} (${members.length} students)`));const list=document.createElement('ul');members.forEach(move=>list.append(text('li',`${move.username} (${move.from})`)));if(!members.length)list.append(text('li','No students'));column.append(list);columns.append(column);}section.append(columns);
      }root.append(section);
    }
  }
  async function refresh(){
    if(!state.loggedIn||!hasAdminPanelAccess())return;
    const request=++generation,who=identity();
    try{const data=await api('/api/admin/grade-progression');if(request!==generation||who!==identity())return;
      const graduates=el('gradeGraduates');graduates.replaceChildren();if(!data.graduates.length)graduates.append(text('p','No accounts are scheduled for graduation deletion.'));
      for(const item of data.graduates)graduates.append(text('p',`${item.username}: ${new Date(item.deleteAfter).toLocaleString()}`));
      if(!busy)render(data.plans[0]||null);
    }catch(error){if(who===identity())status.textContent=error.message;}
  }
  async function action(button,fn){if(busy)return;busy=true;button.disabled=true;status.textContent='';const who=identity();try{await fn(who);}catch(error){if(who===identity()){status.textContent=error.message;if(error.status===409)render(null);}}finally{busy=false;button.disabled=button===el('approveGradeProgression')?!el('gradeProgressionConfirm').checked:false;}}
  el('gradeProgressionForm').onsubmit=(event)=>{event.preventDefault();void action(event.submitter||el('gradeProgressionForm').querySelector('button'),async(who)=>{const data=await api('/api/admin/grade-progression/preview',{method:'POST',json:{cycle:el('gradeProgressionCycle').value.trim(),scope:el('gradeProgressionScope').value}});if(who!==identity())return;render(data.plan);status.textContent='Preview ready. Review every class below. No accounts have moved.';});};
  el('gradeProgressionConfirm').onchange=()=>{el('approveGradeProgression').disabled=busy||!el('gradeProgressionConfirm').checked;};
  el('approveGradeProgression').onclick=()=>{if(!plan||!el('gradeProgressionConfirm').checked)return;void action(el('approveGradeProgression'),async(who)=>{const data=await api('/api/admin/grade-progression/approve',{method:'POST',json:{id:plan.id}});if(who!==identity())return;render(data.plan);status.textContent='Approved. Grades updated and Grade 12 export deadlines scheduled.';await refresh();});};
  function updateBanner(){const info=state.user?.graduation;el('graduationExportPanel').classList.toggle('hidden',!info);if(info)el('graduationExportDeadline').textContent=`Export by ${new Date(info.deleteAfter).toLocaleString()}. Your account will be deleted after this deadline.`;}
  el('exportGraduationChats').onclick=async()=>{const button=el('exportGraduationChats');button.disabled=true;const who=identity();try{const data=await api('/api/chats/export');if(who!==identity())return;const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='connectifi-chats.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);el('graduationExportStatus').textContent='Chat export downloaded. Download attachment files separately before your deadline.';}catch(error){el('graduationExportStatus').textContent=error.message;}finally{button.disabled=false;}};
  window.ConnectifiGradesAdmin={updateBanner};
  new MutationObserver(()=>{if(el('appView').classList.contains('hidden')){generation++;render(null);el('gradeGraduates').replaceChildren();status.textContent='';el('graduationExportPanel').classList.add('hidden');tab(false);}}).observe(el('appView'),{attributes:true,attributeFilter:['class']});
})();
