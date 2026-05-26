
// PATCH reactMessage()

async function reactMessage(id, emoji) {
  try {
    const chatContainer =
      document.querySelector(".messages") ||
      document.querySelector(".chat-messages");

    const scrollTop = chatContainer ? chatContainer.scrollTop : window.scrollY;

    const data = await api(
      `/api/messages/${encodeURIComponent(id)}/reactions`,
      {
        method: "POST",
        json: { emoji },
      }
    );

    const index = state.messages.findIndex((m) => m.id === id);

    if (index !== -1) {
      state.messages[index] = data.message;
    }

    renderMessages();

    requestAnimationFrame(() => {
      if (chatContainer) {
        chatContainer.scrollTop = scrollTop;
      } else {
        window.scrollTo({
          top: scrollTop,
          behavior: "instant"
        });
      }
    });

  } catch (error) {
    notify(error.message);
  }
}
