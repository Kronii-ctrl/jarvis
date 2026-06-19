"use strict";

/* ------------------------------------------------------------------ *
 *  J.A.R.V.I.S. — a Gemini-powered assistant
 *  Pure client-side. Your API key lives only in this browser.
 * ------------------------------------------------------------------ */

const DEFAULT_PERSONA = `You are J.A.R.V.I.S., the artificial-intelligence assistant created by Tony Stark.
You are unfailingly polite, dry-witted, and impeccably composed. Address the user as "sir".
Speak with refined British formality, but stay concise and genuinely helpful — never waffle.
A touch of understated sarcasm is welcome when warranted. Offer proactive suggestions when useful.
You are speaking aloud, so avoid markdown, bullet symbols, code fences, and emoji. Keep replies tight.`;

const store = {
  get key() { return localStorage.getItem("jarvis.key") || ""; },
  set key(v) { localStorage.setItem("jarvis.key", v); },
  get model() { return localStorage.getItem("jarvis.model") || "gemini-2.5-flash"; },
  set model(v) { localStorage.setItem("jarvis.model", v); },
  get tts() { return localStorage.getItem("jarvis.tts") !== "off"; },
  set tts(v) { localStorage.setItem("jarvis.tts", v ? "on" : "off"); },
  get voice() { return localStorage.getItem("jarvis.voice") || ""; },
  set voice(v) { localStorage.setItem("jarvis.voice", v); },
  get persona() { return localStorage.getItem("jarvis.persona") || DEFAULT_PERSONA; },
  set persona(v) { localStorage.setItem("jarvis.persona", v); },
};

// Conversation history in Gemini's format: { role: "user"|"model", parts: [{text}] }
const history = [];

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const els = {
  conversation: $("conversation"),
  composer: $("composer"),
  prompt: $("prompt"),
  micBtn: $("micBtn"),
  reactor: $("reactor"),
  reactorCaption: $("reactorCaption"),
  statusChip: $("statusChip"),
  statusText: $("statusText"),
  settings: $("settings"),
  overlay: $("overlay"),
  settingsBtn: $("settingsBtn"),
  closeSettings: $("closeSettings"),
  saveSettings: $("saveSettings"),
  resetPersona: $("resetPersona"),
  apiKey: $("apiKey"),
  model: $("model"),
  ttsToggle: $("ttsToggle"),
  voiceSelect: $("voiceSelect"),
  persona: $("persona"),
};

/* ---------- UI helpers ---------- */
function setState(state, caption) {
  els.reactor.className = "reactor" + (state ? " " + state : "");
  const map = { busy: ["busy", "Processing"], listening: ["listening", "Listening"], "": ["online", "Online"] };
  const [cls, txt] = map[state] || map[""];
  els.statusChip.className = "status " + cls;
  els.statusText.textContent = txt;
  els.reactorCaption.textContent = caption || (state === "busy" ? "Thinking" : state === "listening" ? "Listening" : "Standing by");
}

function setError(msg) {
  els.statusChip.className = "status error";
  els.statusText.textContent = "Error";
  els.reactorCaption.textContent = "Fault";
}

function addMessage(role, text) {
  const wrap = document.createElement("div");
  wrap.className = "msg " + role;
  const r = document.createElement("div");
  r.className = "msg-role";
  r.textContent = role === "user" ? "SIR" : role === "error" ? "SYSTEM" : "JARVIS";
  const t = document.createElement("div");
  t.className = "msg-text";
  t.textContent = text;
  wrap.append(r, t);
  els.conversation.appendChild(wrap);
  els.conversation.scrollTop = els.conversation.scrollHeight;
  return t;
}

/* ---------- Gemini ---------- */
async function* streamGemini(userText) {
  const key = store.key.trim();
  if (!key) throw new Error("No API key set. Open settings (⚙) and add your Gemini API key.");

  history.push({ role: "user", parts: [{ text: userText }] });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${store.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;
  const body = {
    systemInstruction: { parts: [{ text: store.persona }] },
    contents: history,
    generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.error?.message || ""; } catch {}
    history.pop();
    if (res.status === 400 && /API key/i.test(detail)) throw new Error("Invalid API key. Check it in settings.");
    if (res.status === 404) throw new Error(`Model "${store.model}" unavailable for this key. Try another model in settings.`);
    if (res.status === 429) throw new Error("Rate limit reached. Wait a moment, sir.");
    throw new Error(detail || `Request failed (HTTP ${res.status}).`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const json = trimmed.slice(5).trim();
      if (!json || json === "[DONE]") continue;
      try {
        const chunk = JSON.parse(json);
        const part = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (part) { full += part; yield part; }
      } catch { /* partial JSON across chunks — ignore */ }
    }
  }

  history.push({ role: "model", parts: [{ text: full }] });
  return full;
}

/* ---------- Text-to-speech ---------- */
let voices = [];
function loadVoices() {
  voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  if (!els.voiceSelect) return;
  const current = store.voice;
  els.voiceSelect.innerHTML = '<option value="">System default</option>';
  voices.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v.name;
    opt.textContent = `${v.name} (${v.lang})`;
    if (v.name === current) opt.selected = true;
    els.voiceSelect.appendChild(opt);
  });
}
if (window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function pickVoice() {
  if (store.voice) {
    const exact = voices.find((v) => v.name === store.voice);
    if (exact) return exact;
  }
  // Prefer a British English voice for that JARVIS feel.
  return (
    voices.find((v) => /en-GB/i.test(v.lang) && /male|daniel|george|arthur/i.test(v.name)) ||
    voices.find((v) => /en-GB/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    null
  );
}

function speak(text) {
  if (!store.tts || !window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) u.voice = v;
  u.rate = 1.02;
  u.pitch = 0.95;
  window.speechSynthesis.speak(u);
}

/* ---------- Send flow ---------- */
let busy = false;
async function send(text) {
  text = (text || "").trim();
  if (!text || busy) return;
  busy = true;
  addMessage("user", text);
  els.prompt.value = "";
  setState("busy");

  const target = addMessage("jarvis", "");
  let acc = "";
  try {
    for await (const piece of streamGemini(text)) {
      acc += piece;
      target.textContent = acc;
      els.conversation.scrollTop = els.conversation.scrollHeight;
    }
    if (!acc) target.textContent = "(No response, sir.)";
    setState("");
    speak(acc);
  } catch (err) {
    target.parentElement.remove();
    addMessage("error", err.message || String(err));
    setError();
  } finally {
    busy = false;
  }
}

els.composer.addEventListener("submit", (e) => {
  e.preventDefault();
  send(els.prompt.value);
});

/* ---------- Speech recognition (voice input) ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;

if (SR) {
  recognition = new SR();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.onstart = () => { listening = true; els.micBtn.classList.add("recording"); setState("listening"); };
  recognition.onerror = () => { stopListening(); };
  recognition.onend = () => { stopListening(); };
  recognition.onresult = (e) => {
    let txt = "";
    for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
    els.prompt.value = txt;
    if (e.results[e.results.length - 1].isFinal) {
      const final = txt.trim();
      stopListening();
      if (final) send(final);
    }
  };
} else {
  els.micBtn.title = "Voice input not supported in this browser";
}

function stopListening() {
  listening = false;
  els.micBtn.classList.remove("recording");
  if (!busy) setState("");
}

els.micBtn.addEventListener("click", () => {
  if (!recognition) { addMessage("error", "Voice input isn't supported in this browser. Try Chrome or Edge."); return; }
  if (listening) { recognition.stop(); return; }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  try { recognition.start(); } catch { /* already started */ }
});

/* ---------- Settings panel ---------- */
function openSettings() {
  els.apiKey.value = store.key;
  els.model.value = store.model;
  els.ttsToggle.checked = store.tts;
  els.persona.value = store.persona;
  loadVoices();
  els.voiceSelect.value = store.voice;
  els.settings.hidden = false;
  els.overlay.hidden = false;
}
function closeSettings() { els.settings.hidden = true; els.overlay.hidden = true; }

els.settingsBtn.addEventListener("click", openSettings);
els.closeSettings.addEventListener("click", closeSettings);
els.overlay.addEventListener("click", closeSettings);
els.resetPersona.addEventListener("click", () => { els.persona.value = DEFAULT_PERSONA; });

els.saveSettings.addEventListener("click", () => {
  store.key = els.apiKey.value.trim();
  store.model = els.model.value;
  store.tts = els.ttsToggle.checked;
  store.voice = els.voiceSelect.value;
  store.persona = els.persona.value.trim() || DEFAULT_PERSONA;
  closeSettings();
  setState(store.key ? "" : null);
  if (store.key) {
    els.statusChip.className = "status online";
    els.statusText.textContent = "Online";
  }
});

/* ---------- Boot ---------- */
(function boot() {
  if (store.key) {
    els.statusChip.className = "status online";
    els.statusText.textContent = "Online";
    els.reactorCaption.textContent = "Standing by";
  } else {
    els.statusChip.className = "status";
    els.statusText.textContent = "No key";
  }
  els.prompt.focus();
})();
