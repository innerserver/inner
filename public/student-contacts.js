(() => {
  const forms=['signupForm','accountRequestForm','profileForm','createAccountForm'].map(id=>document.getElementById(id)).filter(Boolean);
  function isStudent(form){return form.id==='profileForm'?state.user?.role==='member':form.id==='createAccountForm'?document.getElementById('newAccountRole').value==='member':true;}
  for(const form of forms){
    const group=document.createElement('fieldset');group.className='student-parent-emails';
    const legend=document.createElement('legend');legend.textContent='Parent contact emails';group.append(legend);
    const hint=document.createElement('p');hint.className='panel-note';hint.textContent='Add one to three different parent emails. The first is required for student accounts. These do not create parent accounts or grant account access.';group.append(hint);
    for(let i=0;i<3;i++){const label=document.createElement('label');label.textContent=`Parent email ${i+1}${i?' (optional)':' (required)'}`;const input=document.createElement('input');input.type='email';input.maxLength=254;input.autocomplete='off';input.dataset.parentEmail=String(i);input.required=i===0;label.append(input);group.append(label);}
    const submit=form.querySelector('[type=submit]');if(submit)submit.before(group);else form.append(group);
    form.addEventListener('submit',event=>{group.hidden=!isStudent(form);group.disabled=group.hidden;if(!group.disabled && ![...group.querySelectorAll('input')].every(input=>input.reportValidity())){event.preventDefault();event.stopImmediatePropagation();}},true);
  }
  function sync(){for(const form of forms){const group=form.querySelector('.student-parent-emails');group.hidden=!isStudent(form);group.disabled=group.hidden;}}
  document.getElementById('newAccountRole')?.addEventListener('change',sync);
  function fill(user){sync();const form=document.getElementById('profileForm');for(const input of form.querySelectorAll('[data-parent-email]'))setInputIfNotFocused(input,user?.parentEmails?.[Number(input.dataset.parentEmail)]||'');}
  function read(form){if(!form || !isStudent(form))return [];return [...form.querySelectorAll('[data-parent-email]')].map(input=>input.value.trim()).filter(Boolean);}
  window.ConnectifiStudentContacts={fill,read};sync();
})();
