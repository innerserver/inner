(() => {
  const view = document.getElementById("notesView");
  const form = view.querySelector("form");
  const list = view.querySelector("[data-notes-list]");
  const status = view.querySelector("[role=status]");
  const title = form.elements.noteTitle;
  const content = form.elements.noteContent;
  const save = form.querySelector("[type=submit]");
  const remove = form.querySelector("[data-delete-note]");
  const create = view.querySelector("[data-new-note]");
  let identity = "", notes = [], selected = null, busy = false, loaded = false;

  const account = () => state.loggedIn && state.user ? state.user.username : "";
  const dirty = () => title.value !== (selected?.title || "") || content.value !== (selected?.content || "");
  const canReplace = () => !dirty() || window.confirm("Discard unsaved changes to this note?");

  function updateControls() {
    title.disabled = content.disabled = save.disabled = create.disabled = !loaded || busy;
    remove.disabled = !loaded || busy || !selected;
    for (const button of list.querySelectorAll("button")) button.disabled = busy;
  }

  function renderList() {
    list.replaceChildren();
    if (!notes.length) {
      const empty = document.createElement("p");
      empty.className = "panel-note";
      empty.textContent = "No saved notes yet.";
      list.append(empty);
    }
    for (const note of notes) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary-button";
      button.setAttribute("aria-pressed", String(note.id === selected?.id));
      button.textContent = note.title;
      button.addEventListener("click", () => {
        if (note.id === selected?.id || !canReplace()) return;
        choose(note);
        title.focus();
      });
      list.append(button);
    }
    updateControls();
  }

  function choose(note) {
    selected = note;
    title.value = note?.title || "";
    content.value = note?.content || "";
    status.textContent = note ? "Saved " + new Date(note.updatedAt).toLocaleString() : "";
    renderList();
  }

  async function load() {
    const current = account();
    if (current === identity && (loaded || busy)) return;
    identity = current;
    notes = [];
    loaded = busy = false;
    choose(null);
    if (!current) return;
    busy = true;
    updateControls();
    status.textContent = "Loading notes…";
    try {
      const data = await api("/api/notes");
      if (current !== account() || current !== identity) return;
      notes = data.notes;
      loaded = true;
      choose(notes[0] || null);
    } catch (error) {
      if (current === identity) status.textContent = error.message;
    } finally {
      if (current === identity) {
        busy = false;
        updateControls();
      }
    }
  }

  async function write(method) {
    if (busy || !loaded) return;
    const current = identity;
    busy = true;
    updateControls();
    try {
      const data = await api("/api/notes", {
        method,
        json: { id: selected?.id, revision: selected?.revision, title: title.value, content: content.value },
      });
      if (current !== account() || current !== identity) return;
      notes = data.notes;
      choose(data.note || notes[0] || null);
      status.textContent = method === "DELETE" ? "Note deleted." : "Note saved.";
    } catch (error) {
      if (current === identity) status.textContent = error.message;
    } finally {
      if (current === identity) {
        busy = false;
        updateControls();
      }
    }
  }

  create.addEventListener("click", () => {
    if (canReplace()) { choose(null); title.focus(); }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void write("POST");
  });
  form.addEventListener("input", () => { status.textContent = dirty() ? "Unsaved changes." : ""; });
  remove.addEventListener("click", () => {
    if (selected && window.confirm("Delete this note?")) void write("DELETE");
  });
  view.querySelector("[data-generate-notes]").addEventListener("click", () => window.ConnectifiStudyNotes?.open());

  window.ConnectifiPersonalNotes = {
    load,
    signOut() { void load(); },
    async useGenerated(name, text) {
      if (!loaded) await load();
      if (!loaded || !canReplace()) return false;
      showView("notes");
      choose(null);
      title.value = name.slice(0, 120);
      content.value = text.slice(0, 40000);
      status.textContent = text.length > 40000 ? "Draft limited to 40,000 characters. Download to keep the full result." : "Draft ready. Choose Save note to keep it.";
      title.focus();
      return true;
    },
  };
  updateControls();
})();
