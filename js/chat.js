(function () {
  "use strict";
  const config = window.SITE_CONFIG;
  const database = window.chatDatabase || window.firebaseDb;
  const form = document.getElementById("contact-message-form");
  const feedback = document.getElementById("contact-form-feedback");
  const sendButton = document.getElementById("contact-send-button");
  const dialog = document.getElementById("chat-dialog");
  const messagesNode = document.getElementById("chat-messages");
  const replyForm = document.getElementById("chat-reply-form");
  const replyInput = document.getElementById("chat-reply-input");
  const chatNotice = document.getElementById("chat-notice");
  const bell = document.getElementById("chat-bell");
  const unreadNode = document.getElementById("chat-unread-count");
  if (!dialog || !messagesNode || !bell) return;

  const serviceSelect = document.getElementById("contact-service");
  const otherServiceRow = document.getElementById("contact-other-service");
  const sampleImageInput = document.getElementById("contact-sample-image");
  const sampleUpload = document.getElementById("contact-sample-upload");
  const sampleUploadPrompt = document.getElementById("contact-sample-upload-prompt");
  const sampleImagePreview = document.getElementById("contact-sample-upload-preview");
  const sampleImageStatus = document.getElementById("contact-sample-upload-status");
  const removeSampleImage = document.getElementById("contact-remove-sample-image");
  const sampleImageError = document.getElementById("contact-sample-image-error");
  let visitor = null;
  let thread = null;
  let isSending = false;
  let selectedSampleImage = null;
  let sampleImageObjectUrl = "";

  function populateServices() {
    if (!serviceSelect) return;
    const selectedValue = serviceSelect.value;
    serviceSelect.replaceChildren(new Option("Select a service", ""));
    config.services.forEach((service) => serviceSelect.add(new Option(service.title, service.id)));
    serviceSelect.add(new Option("Other service", "other"));
    if ([...serviceSelect.options].some((option) => option.value === selectedValue)) serviceSelect.value = selectedValue;
  }

  populateServices();
  window.addEventListener("site-services-updated", populateServices);
  serviceSelect?.addEventListener("change", () => {
    if (!otherServiceRow) return;
    const otherInput = otherServiceRow.querySelector("input");
    const isOther = serviceSelect.value === "other";
    otherServiceRow.hidden = !isOther;
    otherInput.required = isOther;
    if (!isOther) otherInput.value = "";
  });

  function setSampleImage(file) {
    sampleImageError.textContent = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      sampleImageError.textContent = "Please choose an image file.";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      sampleImageError.textContent = "Image must be 10 MB or smaller.";
      return;
    }
    if (sampleImageObjectUrl) URL.revokeObjectURL(sampleImageObjectUrl);
    selectedSampleImage = file;
    sampleImageObjectUrl = URL.createObjectURL(file);
    sampleImagePreview.src = sampleImageObjectUrl;
    sampleImagePreview.hidden = false;
    sampleUploadPrompt.hidden = true;
    removeSampleImage.hidden = false;
    sampleImageStatus.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB · ready to upload`;
  }

  function clearSampleImage() {
    if (sampleImageObjectUrl) URL.revokeObjectURL(sampleImageObjectUrl);
    sampleImageObjectUrl = "";
    selectedSampleImage = null;
    sampleImageInput.value = "";
    sampleImagePreview.hidden = true;
    sampleImagePreview.removeAttribute("src");
    sampleUploadPrompt.hidden = false;
    removeSampleImage.hidden = true;
    sampleImageStatus.textContent = "Optional · JPG, PNG, WebP, or GIF up to 10 MB.";
    sampleImageError.textContent = "";
  }

  async function uploadSampleImage(file) {
    const apiKey = String(config.imgbbApiKey || "").trim();
    if (!apiKey) throw new Error("Sample image upload is not configured. Please remove the image or contact us by WhatsApp.");
    const payload = new FormData();
    payload.append("key", apiKey);
    payload.append("image", file, file.name);
    sampleImageStatus.textContent = "Uploading sample image…";
    const response = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: payload });
    if (!response.ok) throw new Error(`Sample image upload failed (HTTP ${response.status}).`);
    const result = await response.json();
    const imageUrl = result?.data?.display_url;
    if (!result?.success || typeof imageUrl !== "string" || !imageUrl.startsWith("https://")) {
      throw new Error(result?.error?.message || "Sample image upload did not return a valid link.");
    }
    return imageUrl;
  }

  sampleImageInput?.addEventListener("change", () => setSampleImage(sampleImageInput.files[0]));
  removeSampleImage?.addEventListener("click", clearSampleImage);
  ["dragenter", "dragover"].forEach((eventName) => sampleUpload?.addEventListener(eventName, (event) => {
    event.preventDefault();
    sampleUpload.classList.add("is-dragging");
  }));
  ["dragleave", "drop"].forEach((eventName) => sampleUpload?.addEventListener(eventName, (event) => {
    event.preventDefault();
    sampleUpload.classList.remove("is-dragging");
  }));
  sampleUpload?.addEventListener("drop", (event) => setSampleImage(event.dataTransfer.files[0]));

  function showFeedback(node, message, isError = false) {
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("is-error", isError);
  }

  function formatTime(timestamp) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(Number(timestamp) || Date.now()));
  }

  function updateBell(data) {
    const settings = data?.settings || {};
    const hasAdminReply = Object.values(data?.messages || {}).some((message) => message?.sender === "admin");
    const enabled = settings.notificationsEnabled !== false && hasAdminReply;
    bell.hidden = !enabled;
    if (!enabled) {
      unreadNode.hidden = true;
      return;
    }
    const lastReadAt = Number(data?.meta?.clientReadAt) || 0;
    const unread = Object.values(data?.messages || {}).filter((message) =>
      message?.sender === "admin" && Number(message.createdAt) > lastReadAt
    ).length;
    unreadNode.textContent = unread > 9 ? "9+" : String(unread);
    unreadNode.hidden = unread === 0;
    bell.setAttribute("aria-label", unread ? `${unread} unread admin messages` : "Open messages");
  }

  function renderMessages(data) {
    messagesNode.replaceChildren();
    const messages = Object.values(data?.messages || {})
      .filter((message) => message && typeof message.text === "string")
      .sort((first, second) => Number(first.createdAt) - Number(second.createdAt));
    if (!messages.length) {
      const empty = document.createElement("p");
      empty.className = "chat-empty";
      empty.textContent = "Your messages with Arslan will appear here.";
      messagesNode.append(empty);
      return;
    }
    messages.forEach((message) => {
      const bubble = document.createElement("article");
      bubble.className = `chat-message${message.sender === "admin" ? " from-admin" : " from-visitor"}`;
      const label = document.createElement("span");
      label.textContent = message.sender === "admin" ? "ARSLAN GRAPHICS" : "YOU";
      const text = document.createElement("p");
      text.textContent = message.text;
      const time = document.createElement("time");
      time.dateTime = new Date(Number(message.createdAt) || Date.now()).toISOString();
      time.textContent = formatTime(message.createdAt);
      bubble.append(label, text, time);
      messagesNode.append(bubble);
    });
    messagesNode.scrollTop = messagesNode.scrollHeight;
  }

  async function sendMessage(text) {
    if (!visitor || !database || isSending) throw new Error("Secure chat is not ready yet. Please try again.");
    const cleaned = String(text || "").trim();
    if (cleaned.length < 2 || cleaned.length > 2000) throw new Error("Write a message between 2 and 2,000 characters.");
    isSending = true;
    if (replyForm) replyForm.querySelector("button").disabled = true;
    try {
      const messageRef = database.ref(`chats/${visitor.uid}/messages`).push();
      await messageRef.set({ sender: "client", text: cleaned, createdAt: Date.now() });
    } finally {
      isSending = false;
      if (replyForm) replyForm.querySelector("button").disabled = false;
    }
  }

  async function createContactOrder({ name, email, phone, serviceId, serviceName, message, sampleImageUrl }) {
    const orderRef = database.ref("orders").push();
    const messageRef = database.ref(`chats/${visitor.uid}/messages`).push();
    const now = Date.now();
    const order = {
      orderId: orderRef.key,
      name,
      phone,
      email,
      service: serviceName,
      serviceId: serviceId === "other" ? "other" : serviceId,
      message,
      status: "Pending",
      createdAt: now,
      dateKey: new Date(now).toISOString().slice(0, 10)
    };
    if (sampleImageUrl) order.sampleImageUrl = sampleImageUrl;
    const chatMessage = {
      sender: "client",
      text: message,
      createdAt: now
    };
    await orderRef.set(order);
    await messageRef.set(chatMessage);
    return orderRef.key;
  }

  async function openChat() {
    if (!dialog.open) dialog.showModal();
    showFeedback(chatNotice, "");
    if (visitor) {
      try {
        await database.ref(`chats/${visitor.uid}/meta/clientReadAt`).set(Date.now());
      } catch (error) {
        console.error("Could not update the visitor chat read time.", error);
      }
    }
    requestAnimationFrame(() => replyInput?.focus());
  }

  bell.addEventListener("click", openChat);
  document.getElementById("chat-close")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  replyForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = replyInput.value.trim();
    if (!text) return;
    try {
      await sendMessage(text);
      replyInput.value = "";
      showFeedback(chatNotice, "");
    } catch (error) {
      console.error("Could not send a visitor chat message.", error);
      showFeedback(chatNotice, error.message || "Your message could not be sent. Please try again.", true);
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    showFeedback(feedback, "");
    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const serviceId = String(formData.get("serviceId") || "");
    const otherService = String(formData.get("otherService") || "").trim();
    const message = String(formData.get("message") || "").trim();
    const selectedService = config.services.find((service) => service.id === serviceId);
    const serviceName = serviceId === "other" ? otherService : selectedService?.title;
    if (name.length < 2 || (!email && !phone) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      || (phone && !/^[+\d][\d\s().-]{6,28}$/.test(phone)) || !serviceName || message.length < 2) {
      showFeedback(feedback, "Enter your name, a valid email or phone number, choose a service, and write your message.", true);
      return;
    }
    if (!visitor || !database) {
      showFeedback(feedback, "Secure messaging is unavailable. Please refresh the page or contact us by email or WhatsApp.", true);
      return;
    }
    sendButton.disabled = true;
    sendButton.textContent = selectedSampleImage ? "Uploading sample…" : "Sending…";
    try {
      const profileRef = database.ref(`chats/${visitor.uid}/profile`);
      const profileSnapshot = await profileRef.once("value");
      if (!profileSnapshot.exists()) {
        await profileRef.set({
          name,
          email,
          phone,
          service: serviceName,
          createdAt: Date.now()
        });
      }
      const sampleImageUrl = selectedSampleImage ? await uploadSampleImage(selectedSampleImage) : "";
      const orderId = await createContactOrder({
        name,
        email,
        phone,
        serviceId,
        serviceName,
        message,
        sampleImageUrl
      });
      form.reset();
      clearSampleImage();
      otherServiceRow.hidden = true;
      otherServiceRow.querySelector("input").required = false;
      showFeedback(feedback, `Order request ${orderId} sent. We’ll reply here, and your chat bell will appear with our reply.`);
      await openChat();
    } catch (error) {
      console.error("Could not save the contact message.", error);
      const details = error?.code || error?.message;
      sampleImageError.textContent = selectedSampleImage ? details || "Sample image upload failed." : "";
      showFeedback(feedback, details
        ? `Your request could not be saved (${details}). Please try again or contact us by WhatsApp.`
        : "Your request could not be saved. Please try again or contact us by WhatsApp.", true);
    } finally {
      sendButton.disabled = false;
      sendButton.innerHTML = 'Order this service <span aria-hidden="true">↗</span>';
    }
  });

  if (!window.firebaseReady || !database || !window.chatAuthReady) {
    showFeedback(feedback, "Secure messaging is unavailable. Please use email or WhatsApp.", true);
    if (sendButton) sendButton.disabled = true;
  } else {
    if (sendButton) sendButton.disabled = true;
    showFeedback(feedback, "Connecting secure messaging…");
    window.chatAuthReady.then((user) => {
      if (!user || !user.isAnonymous) {
        showFeedback(feedback, "Secure visitor messaging is unavailable in this signed-in browser. Please use email or WhatsApp.", true);
        return;
      }
      visitor = user;
      if (sendButton) sendButton.disabled = false;
      showFeedback(feedback, "");
      thread = database.ref(`chats/${visitor.uid}`);
      thread.on("value", (snapshot) => {
        const data = snapshot.val() || {};
        updateBell(data);
        renderMessages(data);
      }, (error) => {
        console.error("Could not listen for visitor chat updates.", error);
        showFeedback(feedback, "Could not load your secure chat. Please refresh and try again.", true);
      });
    }).catch((error) => {
      console.error("Could not initialize secure visitor messaging.", error);
      showFeedback(feedback, "Secure messaging is unavailable. Please use email or WhatsApp.", true);
      if (sendButton) sendButton.disabled = true;
    });
  }
})();
