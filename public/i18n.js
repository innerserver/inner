(() => {
  const rows = {
    "Dashboard": ["Inicio", "Tableau de bord", "डैशबोर्ड"], "Profile": ["Perfil", "Profil", "प्रोफ़ाइल"],
    "Room messages": ["Mensajes de la sala", "Messages du salon", "कक्ष संदेश"], "Direct messages": ["Mensajes directos", "Messages directs", "निजी संदेश"],
    "Friends": ["Amigos", "Amis", "मित्र"], "Files": ["Archivos", "Fichiers", "फ़ाइलें"], "Browser": ["Navegador", "Navigateur", "ब्राउज़र"],
    "Calls": ["Llamadas", "Appels", "कॉल"], "Screen share": ["Compartir pantalla", "Partage d’écran", "स्क्रीन साझा करें"],
    "Social": ["Social", "Social", "सामाजिक"], "Workspace & files": ["Espacio y archivos", "Espace et fichiers", "कार्यस्थान और फ़ाइलें"],
    "Communication": ["Comunicación", "Communication", "संचार"], "Moderation": ["Moderación", "Modération", "मॉडरेशन"],
    "Store": ["Tienda", "Boutique", "स्टोर"], "Games": ["Juegos", "Jeux", "खेल"], "Admin": ["Administración", "Administration", "व्यवस्थापक"],
    "Log out": ["Cerrar sesión", "Se déconnecter", "लॉग आउट"], "Sign in": ["Iniciar sesión", "Se connecter", "साइन इन"],
    "Username": ["Usuario", "Identifiant", "उपयोगकर्ता नाम"], "Password": ["Contraseña", "Mot de passe", "पासवर्ड"],
    "Email": ["Correo electrónico", "E-mail", "ईमेल"], "Phone": ["Teléfono", "Téléphone", "फ़ोन"],
    "Messages": ["Mensajes", "Messages", "संदेश"], "Send": ["Enviar", "Envoyer", "भेजें"], "Upload": ["Subir", "Téléverser", "अपलोड"],
    "Enable alerts": ["Activar avisos", "Activer les alertes", "सूचनाएँ चालू करें"], "Install app": ["Instalar aplicación", "Installer l’application", "ऐप इंस्टॉल करें"],
    "Language": ["Idioma", "Langue", "भाषा"], "Room": ["Sala", "Salon", "कक्ष"], "Title": ["Título", "Titre", "शीर्षक"],
    "Take photo": ["Tomar foto", "Prendre une photo", "फ़ोटो लें"], "Pause upload": ["Pausar carga", "Suspendre le téléversement", "अपलोड रोकें"],
    "Short answer": ["Respuesta breve", "Réponse courte", "संक्षिप्त उत्तर"], "Paragraph": ["Párrafo", "Paragraphe", "अनुच्छेद"],
    "Multiple choice": ["Opción múltiple", "Choix multiple", "बहुविकल्पीय"], "Checkboxes": ["Casillas", "Cases à cocher", "चेकबॉक्स"],
    "Dropdown": ["Lista desplegable", "Liste déroulante", "ड्रॉपडाउन"], "Email address": ["Correo electrónico", "Adresse e-mail", "ईमेल पता"],
    "Phone number": ["Teléfono", "Numéro de téléphone", "फ़ोन नंबर"], "Number": ["Número", "Nombre", "संख्या"],
    "Date": ["Fecha", "Date", "तारीख"], "Time": ["Hora", "Heure", "समय"], "Website URL": ["URL del sitio", "URL du site", "वेबसाइट URL"],
    "Grade": ["Curso", "Niveau", "कक्षा"], "Remove": ["Eliminar", "Supprimer", "हटाएँ"],
    "Description": ["Descripción", "Description", "विवरण"], "Save": ["Guardar", "Enregistrer", "सहेजें"], "Cancel": ["Cancelar", "Annuler", "रद्द करें"],
    "Close": ["Cerrar", "Fermer", "बंद करें"], "Refresh": ["Actualizar", "Actualiser", "ताज़ा करें"], "Create": ["Crear", "Créer", "बनाएँ"],
    "School workspace": ["Espacio escolar", "Espace scolaire", "विद्यालय कार्यस्थान"], "Your tasks": ["Tus tareas", "Vos tâches", "आपके कार्य"],
    "Room tasks": ["Tareas de la sala", "Tâches du salon", "कक्ष के कार्य"], "Post task": ["Publicar tarea", "Publier une tâche", "कार्य प्रकाशित करें"],
    "Instructions": ["Instrucciones", "Consignes", "निर्देश"], "Due date": ["Fecha límite", "Échéance", "अंतिम तिथि"],
    "Reference files": ["Archivos de referencia", "Fichiers de référence", "संदर्भ फ़ाइलें"], "No deadline": ["Sin fecha límite", "Sans échéance", "कोई अंतिम तिथि नहीं"],
    "Past due date": ["Fecha límite pasada", "Échéance passée", "अंतिम तिथि बीत चुकी है"], "Archive": ["Archivar", "Archiver", "संग्रहित करें"],
    "No tasks for this room": ["No hay tareas en esta sala", "Aucune tâche pour ce salon", "इस कक्ष में कोई कार्य नहीं है"],
    "No current tasks": ["No hay tareas actuales", "Aucune tâche en cours", "अभी कोई कार्य नहीं है"],
    "Events and appointments": ["Eventos y citas", "Événements et rendez-vous", "कार्यक्रम और मुलाकातें"],
    "Create event or appointment": ["Crear evento o cita", "Créer un événement ou rendez-vous", "कार्यक्रम या मुलाकात बनाएँ"],
    "Event": ["Evento", "Événement", "कार्यक्रम"], "Appointment": ["Cita", "Rendez-vous", "मुलाकात"],
    "Teacher": ["Docente", "Enseignant", "शिक्षक"], "Start": ["Inicio", "Début", "शुरुआत"], "End": ["Fin", "Fin", "समाप्ति"],
    "Capacity": ["Plazas", "Capacité", "क्षमता"], "Location": ["Lugar", "Lieu", "स्थान"], "All rooms": ["Todas las salas", "Tous les salons", "सभी कक्ष"],
    "Book": ["Reservar", "Réserver", "बुक करें"], "Cancel booking": ["Cancelar reserva", "Annuler la réservation", "बुकिंग रद्द करें"],
    "Cancel event": ["Cancelar evento", "Annuler l’événement", "कार्यक्रम रद्द करें"], "Booked": ["Reservado", "Réservé", "बुक किया गया"],
    "Full": ["Completo", "Complet", "स्थान भरे हैं"], "No bookings yet": ["Sin reservas", "Aucune réservation", "अभी कोई बुकिंग नहीं"],
    "No upcoming events": ["Sin próximos eventos", "Aucun événement à venir", "कोई आगामी कार्यक्रम नहीं"],
    "Acknowledgements": ["Confirmaciones", "Accusés de réception", "प्राप्ति की पुष्टि"],
    "Acknowledge": ["Confirmar recepción", "Accuser réception", "प्राप्ति की पुष्टि करें"], "Acknowledged": ["Recepción confirmada", "Réception confirmée", "प्राप्ति की पुष्टि हुई"],
    "Awaiting acknowledgement": ["Confirmación pendiente", "En attente de confirmation", "पुष्टि की प्रतीक्षा"],
    "Require acknowledgement": ["Solicitar confirmación", "Demander un accusé de réception", "प्राप्ति की पुष्टि आवश्यक"],
    "Create form": ["Crear formulario", "Créer un formulaire", "फ़ॉर्म बनाएँ"], "Manage forms": ["Gestionar formularios", "Gérer les formulaires", "फ़ॉर्म प्रबंधन"],
    "Forms to complete": ["Formularios pendientes", "Formulaires à remplir", "भरने के लिए फ़ॉर्म"],
    "Form type": ["Tipo de formulario", "Type de formulaire", "फ़ॉर्म का प्रकार"], "Send to": ["Enviar a", "Envoyer à", "इन्हें भेजें"],
    "Room or grade": ["Sala o curso", "Salon ou niveau", "कक्ष या कक्षा"], "Question": ["Pregunta", "Question", "प्रश्न"],
    "Answer type": ["Tipo de respuesta", "Type de réponse", "उत्तर का प्रकार"], "Required": ["Obligatorio", "Obligatoire", "आवश्यक"],
    "Add question": ["Añadir pregunta", "Ajouter une question", "प्रश्न जोड़ें"], "Preview": ["Vista previa", "Aperçu", "पूर्वावलोकन"],
    "Send form": ["Enviar formulario", "Envoyer le formulaire", "फ़ॉर्म भेजें"], "Complete form": ["Completar formulario", "Remplir le formulaire", "फ़ॉर्म भरें"],
    "Sign up": ["Inscribirse", "S’inscrire", "पंजीकरण करें"], "Your response": ["Tu respuesta", "Votre réponse", "आपका उत्तर"],
    "Edit response": ["Editar respuesta", "Modifier la réponse", "उत्तर संपादित करें"], "Submit response": ["Enviar respuesta", "Envoyer la réponse", "उत्तर जमा करें"],
    "Save draft": ["Guardar borrador", "Enregistrer le brouillon", "मसौदा सहेजें"], "Draft saved": ["Borrador guardado", "Brouillon enregistré", "मसौदा सहेजा गया"],
    "Results": ["Resultados", "Résultats", "परिणाम"], "Download CSV": ["Descargar CSV", "Télécharger le CSV", "CSV डाउनलोड करें"],
    "Close submissions": ["Cerrar respuestas", "Clore les réponses", "उत्तर स्वीकार करना बंद करें"],
    "Closes at": ["Cierra el", "Clôture le", "बंद होने का समय"], "Allow response editing": ["Permitir editar respuestas", "Autoriser la modification", "उत्तर संपादन की अनुमति"],
    "Show for every response": ["Mostrar siempre", "Toujours afficher", "हर उत्तर के लिए दिखाएँ"],
    "Show when question number": ["Mostrar según la pregunta", "Afficher selon la question", "इस प्रश्न पर निर्भर करें"],
    "Equals this option": ["Coincide con esta opción", "Correspond à cette option", "इस विकल्प से मेल खाए"],
    "File attachment": ["Archivo adjunto", "Pièce jointe", "संलग्न फ़ाइल"], "Maximum files": ["Máximo de archivos", "Nombre maximal de fichiers", "अधिकतम फ़ाइलें"],
    "Maximum size per file (MiB)": ["Tamaño máximo por archivo (MiB)", "Taille maximale par fichier (Mio)", "प्रति फ़ाइल अधिकतम आकार (MiB)"],
    "Saving file": ["Guardando archivo", "Enregistrement du fichier", "फ़ाइल सहेजी जा रही है"], "Checking document": ["Analizando documento", "Analyse du document", "दस्तावेज़ की जाँच हो रही है"], "Upload complete": ["Archivo subido", "Téléversement terminé", "अपलोड पूरा हुआ"],
    "Select an option": ["Selecciona una opción", "Choisir une option", "एक विकल्प चुनें"],
    "Find people": ["Buscar personas", "Trouver des personnes", "लोग खोजें"], "Your friends": ["Tus amigos", "Vos amis", "आपके मित्र"],
    "Requests": ["Solicitudes", "Demandes", "अनुरोध"], "My grade": ["Mi curso", "Mon niveau", "मेरी कक्षा"],
    "Exact username": ["Usuario exacto", "Identifiant exact", "सटीक उपयोगकर्ता नाम"], "Add friend": ["Añadir amigo", "Ajouter un ami", "मित्र जोड़ें"],
    "Incoming requests": ["Solicitudes recibidas", "Demandes reçues", "प्राप्त अनुरोध"], "Sent requests": ["Solicitudes enviadas", "Demandes envoyées", "भेजे गए अनुरोध"],
    "People you can add": ["Personas que puedes añadir", "Personnes à ajouter", "जिन्हें आप जोड़ सकते हैं"],
    "Accept": ["Aceptar", "Accepter", "स्वीकार करें"], "Decline": ["Rechazar", "Refuser", "अस्वीकार करें"],
    "Remove": ["Quitar", "Retirer", "हटाएँ"], "Remove friend": ["Eliminar amigo", "Retirer cet ami", "मित्र हटाएँ"],
    "Request sent": ["Solicitud enviada", "Demande envoyée", "अनुरोध भेजा गया"], "Message": ["Mensaje", "Message", "संदेश"],
    "Your class": ["Tu clase", "Votre classe", "आपकी कक्षा"], "Searching…": ["Buscando…", "Recherche…", "खोज जारी है…"],
    "Find classmates and stay connected.": ["Encuentra compañeros y mantén el contacto.", "Retrouvez vos camarades et restez en contact.", "सहपाठियों को खोजें और जुड़े रहें।"],
    "Browse your grade, or select Exact username to find someone in another grade.": ["Busca en tu curso o elige Usuario exacto para otro curso.", "Parcourez votre niveau ou choisissez Identifiant exact pour un autre niveau.", "अपनी कक्षा में खोजें या दूसरी कक्षा के लिए सटीक उपयोगकर्ता नाम चुनें।"],
    "Search your accepted friends by name or username.": ["Busca tus amigos por nombre o usuario.", "Cherchez vos amis par nom ou identifiant.", "अपने मित्रों को नाम या उपयोगकर्ता नाम से खोजें।"],
    "Enter an exact username to find someone.": ["Introduce un usuario exacto.", "Saisissez un identifiant exact.", "सटीक उपयोगकर्ता नाम लिखें।"],
    "No new matches. Try a different name or exact username.": ["Sin resultados. Prueba otro nombre o usuario exacto.", "Aucun résultat. Essayez un autre nom ou identifiant exact.", "कोई नया परिणाम नहीं। दूसरा नाम या सटीक उपयोगकर्ता नाम आज़माएँ।"],
    "No friends match this search.": ["Ningún amigo coincide.", "Aucun ami ne correspond.", "इस खोज से कोई मित्र नहीं मिला।"],
    "No friends yet. Find people to send a request.": ["Aún no tienes amigos. Busca personas para enviar una solicitud.", "Pas encore d’amis. Trouvez des personnes à ajouter.", "अभी कोई मित्र नहीं। अनुरोध भेजने के लिए लोग खोजें।"],
    "No incoming requests.": ["No hay solicitudes recibidas.", "Aucune demande reçue.", "कोई प्राप्त अनुरोध नहीं।"],
    "No sent requests.": ["No hay solicitudes enviadas.", "Aucune demande envoyée.", "कोई भेजा गया अनुरोध नहीं।"],
    "New announcement": ["Nuevo anuncio", "Nouvelle annonce", "नई घोषणा"], "Whole school": ["Todo el colegio", "Toute l’école", "पूरा विद्यालय"],
    "One room": ["Una sala", "Un salon", "एक कक्ष"], "Specific people": ["Personas específicas", "Personnes précises", "चुने हुए लोग"],
    "Recipient preview": ["Vista del destinatario", "Aperçu destinataire", "प्राप्तकर्ता पूर्वावलोकन"],
    "School announcement": ["Anuncio escolar", "Annonce scolaire", "विद्यालय की घोषणा"], "Send announcement": ["Enviar anuncio", "Envoyer l’annonce", "घोषणा भेजें"],
    "Ask recipients to acknowledge": ["Solicitar confirmación", "Demander un accusé de réception", "प्राप्तकर्ताओं से पुष्टि माँगें"],
    "people selected": ["personas seleccionadas", "personnes sélectionnées", "लोग चुने गए"], "Announcement title": ["Título del anuncio", "Titre de l’annonce", "घोषणा का शीर्षक"],
    "Your announcement will appear here.": ["El anuncio aparecerá aquí.", "Votre annonce apparaîtra ici.", "आपकी घोषणा यहाँ दिखेगी।"],
    "Search for people to select recipients.": ["Busca personas para elegir destinatarios.", "Cherchez des personnes à sélectionner.", "प्राप्तकर्ताओं को चुनने के लिए लोग खोजें।"],
  };
  const codes = ["es", "fr", "hi"];
  let language = localStorage.getItem("connectifi-language") || "en";
  const t = (key) => language === "en" ? key : rows[key]?.[codes.indexOf(language)] || key;
  function apply() {
    document.documentElement.lang = language;
    document.querySelectorAll("[data-i18n]").forEach((node) => { node.textContent = t(node.dataset.i18n); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => { node.placeholder = t(node.dataset.i18nPlaceholder); });
    document.querySelectorAll("[data-language-picker]").forEach((node) => { node.value = language; });
  }
  // Mark only original interface nodes, before account content is rendered.
  document.querySelectorAll("button,label,h2,h3,option,.muted-label").forEach((node) => {
    [...node.childNodes].filter((child) => child.nodeType === 3 && rows[child.textContent.trim()]).forEach((child) => {
      const span = document.createElement("span"); span.dataset.i18n = child.textContent.trim(); span.textContent = child.textContent; child.replaceWith(span);
    });
  });
  document.querySelectorAll("input[placeholder],textarea[placeholder]").forEach((node) => { if (rows[node.placeholder]) node.dataset.i18nPlaceholder = node.placeholder; });
  window.ConnectifiI18n = {
    t, get language() { return language; },
    setLanguage(value) {
      if (!["en", ...codes].includes(value)) return;
      const changed = language !== value;
      language = value; localStorage.setItem("connectifi-language", value); apply();
      if (changed) window.dispatchEvent(new Event("connectifi-language"));
    }, apply,
  };
  apply();
})();
