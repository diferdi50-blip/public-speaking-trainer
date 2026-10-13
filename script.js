(() => {
  "use strict";
  const STORAGE_KEY = "speakflow_topics_v1";
  const SESSION_KEY = "speakflow_sessions_v1";
  const defaultTopics = [
    {id:crypto.randomUUID(),title:"Is social media bringing us closer together?",category:"Technology",hint:"Give your opinion, explain why, and share one example."},
    {id:crypto.randomUUID(),title:"What does success mean to you?",category:"Personal growth",hint:"Define success in your own words and share a personal example."},
    {id:crypto.randomUUID(),title:"Should university students have a part-time job?",category:"Education",hint:"Discuss the benefits, challenges, and your final opinion."},
    {id:crypto.randomUUID(),title:"If you could travel anywhere, where would you go?",category:"Lifestyle",hint:"Describe the place, explain why, and say what you would do there."},
    {id:crypto.randomUUID(),title:"Is artificial intelligence making our lives better?",category:"Technology",hint:"Mention one advantage, one concern, and your conclusion."},
    {id:crypto.randomUUID(),title:"What makes someone a good leader?",category:"Leadership",hint:"Choose three important qualities and explain one of them."},
    {id:crypto.randomUUID(),title:"Should students learn financial literacy at school?",category:"Education",hint:"Explain why this skill matters and give a practical example."},
    {id:crypto.randomUUID(),title:"What is one habit you would like to build?",category:"Personal growth",hint:"Describe the habit, why it matters, and your first step."},
    {id:crypto.randomUUID(),title:"Is online learning as effective as classroom learning?",category:"Education",hint:"Compare both approaches and choose the one that works best for you."},
    {id:crypto.randomUUID(),title:"What makes a city a great place to live?",category:"Society",hint:"Talk about transport, safety, opportunities, or community."}
  ];
  const $ = id => document.getElementById(id);
  const safeParse = (value, fallback) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };
  let topics = safeParse(localStorage.getItem(STORAGE_KEY), null);
  if (!Array.isArray(topics) || topics.length === 0) topics = defaultTopics;
  let currentTopicId = topics[0]?.id;
  let remaining = 60, duration = 60, interval = null, startedAt = null, elapsed = 0;
  let isRunning = false, isPaused = false, sessionFinished = false;
  let recognition = null, micOn = false, finalTranscript = "", interimTranscript = "";
  let sessionCount = Number(localStorage.getItem(SESSION_KEY) || 0);
  let lastSpeechAt = null;
  const CIRCUMFERENCE = 2 * Math.PI * 96;
  $("timerProgress").style.strokeDasharray = String(CIRCUMFERENCE);
  $("year").textContent = new Date().getFullYear();

  function persistTopics() { localStorage.setItem(STORAGE_KEY, JSON.stringify(topics)); updateTopicCounts(); }
  function updateTopicCounts() { $("topicNavCount").textContent = topics.length; $("libraryCount").textContent = `${topics.length} topic${topics.length === 1 ? "" : "s"}`; }
  function getCurrentTopic() { return topics.find(t => t.id === currentTopicId) || topics[0]; }
  function renderCurrentTopic() {
    const topic = getCurrentTopic();
    if (!topic) { $("currentTopic").textContent = "Add a topic to begin"; $("topicCategory").textContent = "Your library"; $("topicHint").textContent = "Open Topic Library to create your first prompt."; return; }
    currentTopicId = topic.id;
    $("currentTopic").textContent = topic.title;
    $("topicCategory").textContent = topic.category || "General";
    $("topicHint").textContent = topic.hint || "Give your opinion, explain why, and share one example.";
  }
  function chooseRandomTopic() {
    if (!topics.length) { toast("Tambahkan topik terlebih dahulu."); return; }
    const options = topics.filter(t => t.id !== currentTopicId);
    const pool = options.length ? options : topics;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    currentTopicId = chosen.id; renderCurrentTopic(); toast("Topik baru siap. Good luck!");
  }
  function formatTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return `${String(Math.floor(s / 60)).padStart(2,"0")}:${String(s % 60).padStart(2,"0")}`;
  }
  function renderTimer() {
    $("timerDisplay").textContent = formatTime(remaining);
    const fraction = duration ? remaining / duration : 0;
    $("timerProgress").style.strokeDashoffset = String(CIRCUMFERENCE * (1 - fraction));
    $("completionLabel").textContent = `${Math.round((1 - fraction) * 100)}% completed`;
    $("completionBar").style.width = `${Math.round((1 - fraction) * 100)}%`;
    $("talkTime").textContent = formatTime(elapsed);
    const words = countWords(finalTranscript + " " + interimTranscript);
    $("wordCount").textContent = words;
    $("wpmCount").textContent = elapsed > 0 ? Math.round(words / (elapsed / 60)) : 0;
    $("fillerCount").textContent = countFillers(finalTranscript + " " + interimTranscript);
  }
  function countWords(text) { const clean = text.trim(); return clean ? (clean.match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu) || []).length : 0; }
  function countFillers(text) { const matches = text.toLowerCase().match(/\b(um+|uh+|erm+|hmm+|like|basically|actually|anu|eee+|em+)\b/gu); return matches ? matches.length : 0; }
  function renderTranscript() {
    const box = $("transcriptBox");
    const all = (finalTranscript + (interimTranscript ? " " + interimTranscript : "")).trim();
    if (!all) {
      box.innerHTML = '<div class="transcript-placeholder"><span class="mic-large">♩</span><strong>Your speech will appear here</strong><p>Aktifkan mikrofon dan mulai bicara. Kata-kata yang dikenali akan muncul di area ini.</p></div>';
      return;
    }
    box.innerHTML = `<span>${escapeHTML(finalTranscript)}</span> <span class="transcript-live">${escapeHTML(interimTranscript)}</span>`;
    box.scrollTop = box.scrollHeight;
  }
  function escapeHTML(s) { return s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function resetTranscript() { finalTranscript = ""; interimTranscript = ""; renderTranscript(); renderTimer(); }
  function toast(message) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toast.timeout); toast.timeout = setTimeout(() => el.classList.remove("show"), 2600);
  }
  function setMicStatus(on) {
    micOn = on; $("micStatus").classList.toggle("on", on);
    $("micStatus").innerHTML = `<span class="mic-dot"></span> ${on ? "Mic active" : "Mic off"}`;
    $("micBtn").textContent = on ? "■ Stop microphone" : "🎙 Enable microphone";
    $("micBtn").classList.toggle("primary-btn", on);
    $("micBtn").classList.toggle("secondary-btn", !on);
  }
  function setupRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast("Browser ini belum mendukung Speech Recognition. Coba Google Chrome.");
      return false;
    }
    try {
      recognition = new SpeechRecognition();
      recognition.lang = "id-ID"; // Ubah ke "en-US" untuk latihan bahasa Inggris.
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onstart = () => { setMicStatus(true); toast("Mikrofon aktif. Mulai berbicara."); };
      recognition.onresult = event => {
        interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalTranscript += (finalTranscript ? " " : "") + text.trim();
          else interimTranscript += text;
        }
        renderTranscript(); renderTimer(); lastSpeechAt = Date.now();
      };
      recognition.onerror = event => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setMicStatus(false); toast("Izin mikrofon ditolak. Izinkan mikrofon di pengaturan browser.");
        } else if (event.error === "no-speech") {
          // No speech is normal during pauses.
        } else if (event.error !== "aborted") toast(`Pengenalan suara: ${event.error}`);
      };
      recognition.onend = () => {
        if (micOn && (isRunning || isPaused)) {
          try { recognition.start(); } catch { /* Browser may still be restarting. */ }
        } else setMicStatus(false);
      };
      recognition.start();
      return true;
    } catch (err) {
      toast("Mikrofon tidak dapat dimulai. Periksa izin browser."); return false;
    }
  }
  function stopRecognition() {
    setMicStatus(false);
    if (recognition) { try { recognition.onend = null; recognition.stop(); } catch {} recognition = null; }
  }
  function tick() {
    if (!isRunning) return;
    elapsed = Math.min(duration, Math.floor((Date.now() - startedAt) / 1000));
    remaining = Math.max(0, duration - elapsed);
    renderTimer();
    if (remaining <= 0) finishSession();
  }
  function startSession() {
    if (isRunning) {
      isRunning = false; isPaused = true; clearInterval(interval);
      $("startBtn").innerHTML = "<span>▶</span> Resume session"; $("timerState").textContent = "SESSION PAUSED";
      $("timerNote").textContent = "Tekan resume untuk melanjutkan latihan."; return;
    }
    if (isPaused) {
      isPaused = false; isRunning = true; startedAt = Date.now() - elapsed * 1000;
    } else {
      duration = Number($("durationSelect").value); remaining = duration; elapsed = 0;
      sessionFinished = false; resetTranscript(); startedAt = Date.now(); isRunning = true;
      $("timerNote").textContent = "Bagus! Fokus pada ide, kejelasan, dan tempo bicaramu.";
      if (!micOn) setupRecognition();
    }
    $("startBtn").innerHTML = "<span>Ⅱ</span> Pause session";
    $("timerState").textContent = "YOU'RE DOING GREAT";
    $("durationSelect").disabled = true;
    clearInterval(interval); interval = setInterval(tick, 250); tick();
  }
  function finishSession() {
    if (sessionFinished) return;
    sessionFinished = true; isRunning = false; isPaused = false; clearInterval(interval);
    remaining = 0; elapsed = duration; renderTimer(); stopRecognition();
    $("startBtn").innerHTML = "<span>↻</span> Start again"; $("timerState").textContent = "SESSION COMPLETE";
    $("durationSelect").disabled = false; $("timerNote").textContent = "Sesi selesai! Coba topik lain atau ulangi untuk meningkatkan kelancaran.";
    sessionCount++; localStorage.setItem(SESSION_KEY, String(sessionCount)); $("sessionCount").textContent = sessionCount;
    toast(`Sesi selesai! Kamu mengucapkan ${countWords(finalTranscript)} kata yang terdeteksi.`);
  }
  function resetSession() {
    clearInterval(interval); isRunning = false; isPaused = false; sessionFinished = false;
    duration = Number($("durationSelect").value); remaining = duration; elapsed = 0; startedAt = null;
    stopRecognition(); resetTranscript(); $("startBtn").innerHTML = "<span>▶</span> Start session";
    $("timerState").textContent = "READY WHEN YOU ARE"; $("durationSelect").disabled = false;
    $("timerNote").textContent = "Pilih topik, tekan mulai, lalu mulai berbicara."; renderTimer();
  }
  function openModal(topic = null) {
    $("topicModal").classList.remove("hidden"); $("editTopicId").value = topic?.id || "";
    $("modalTitle").textContent = topic ? "Edit topic" : "Add a topic";
    $("topicTitleInput").value = topic?.title || ""; $("topicCategoryInput").value = topic?.category || "";
    $("topicHintInput").value = topic?.hint || ""; $("saveTopicBtn").textContent = topic ? "Save changes" : "Save topic";
    setTimeout(() => $("topicTitleInput").focus(), 30);
  }
  function closeModal() { $("topicModal").classList.add("hidden"); $("topicForm").reset(); $("editTopicId").value = ""; }
  function renderTopicList() {
    const query = $("topicSearch").value.trim().toLowerCase();
    const filtered = topics.filter(t => `${t.title} ${t.category} ${t.hint}`.toLowerCase().includes(query));
    const list = $("topicList");
    if (!filtered.length) { list.innerHTML = '<div class="empty-state"><strong>No topics found</strong>Coba kata kunci lain atau tambahkan topik baru.</div>'; return; }
    list.innerHTML = filtered.map((t, i) => `<article class="topic-row"><div class="topic-number">${String(i+1).padStart(2,"0")}</div><div class="topic-details"><strong>${escapeHTML(t.title)}</strong><div class="topic-meta">${escapeHTML(t.category || "General")}</div>${t.hint ? `<p>${escapeHTML(t.hint)}</p>` : ""}</div><div class="topic-row-actions"><button class="small-action" data-action="use" data-id="${t.id}">Use</button><button class="small-action" data-action="edit" data-id="${t.id}">Edit</button><button class="small-action danger" data-action="delete" data-id="${t.id}">Delete</button></div></article>`).join("");
  }
  function saveTopic(event) {
    event.preventDefault();
    const id = $("editTopicId").value;
    const title = $("topicTitleInput").value.trim();
    if (!title) return;
    const topic = {id: id || crypto.randomUUID(), title, category: $("topicCategoryInput").value.trim() || "General", hint: $("topicHintInput").value.trim()};
    if (id) { topics = topics.map(t => t.id === id ? topic : t); toast("Topik berhasil diperbarui."); }
    else { topics.unshift(topic); currentTopicId = topic.id; toast("Topik baru berhasil ditambahkan."); }
    persistTopics(); renderTopicList(); renderCurrentTopic(); closeModal();
  }
  function deleteTopic(id) {
    const topic = topics.find(t => t.id === id); if (!topic) return;
    if (!confirm(`Hapus topik "${topic.title}"?`)) return;
    topics = topics.filter(t => t.id !== id);
    if (currentTopicId === id) currentTopicId = topics[0]?.id;
    persistTopics(); renderTopicList(); renderCurrentTopic(); toast("Topik dihapus.");
  }
  function setView(view) {
    $("practiceView").classList.toggle("hidden", view !== "practice");
    $("topicsView").classList.toggle("hidden", view !== "topics");
    document.querySelectorAll(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));
    $("pageTitle").textContent = view === "practice" ? "Practice room" : "Topic library";
    if (view === "topics") renderTopicList();
  }

  $("randomBtn").addEventListener("click", chooseRandomTopic);
  $("startBtn").addEventListener("click", startSession);
  $("resetBtn").addEventListener("click", resetSession);
  $("durationSelect").addEventListener("change", () => { duration = Number($("durationSelect").value); remaining = duration; renderTimer(); });
  $("micBtn").addEventListener("click", () => {
    if (micOn) { stopRecognition(); toast("Mikrofon dimatikan."); }
    else setupRecognition();
  });
  $("clearTranscriptBtn").addEventListener("click", () => { resetTranscript(); toast("Transkrip dibersihkan."); });
  document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));
  $("addTopicBtn").addEventListener("click", () => openModal());
  $("closeModalBtn").addEventListener("click", closeModal);
  $("cancelModalBtn").addEventListener("click", closeModal);
  $("topicModal").addEventListener("click", e => { if (e.target === $("topicModal")) closeModal(); });
  $("topicForm").addEventListener("submit", saveTopic);
  $("topicSearch").addEventListener("input", renderTopicList);
  $("topicList").addEventListener("click", e => {
    const btn = e.target.closest("button[data-action]"); if (!btn) return;
    const topic = topics.find(t => t.id === btn.dataset.id); if (!topic) return;
    if (btn.dataset.action === "edit") openModal(topic);
    if (btn.dataset.action === "delete") deleteTopic(topic.id);
    if (btn.dataset.action === "use") { currentTopicId = topic.id; renderCurrentTopic(); setView("practice"); toast("Topik dipilih untuk latihan."); }
  });
  $("helpBtn").addEventListener("click", () => alert("CARA MENGGUNAKAN SPEAKFLOW\n\n1. Pilih durasi timer.\n2. Klik Random topic atau kelola daftar di Topic library.\n3. Klik Enable microphone dan izinkan akses mikrofon.\n4. Klik Start session, lalu mulai bicara.\n5. Kata yang terdeteksi, WPM, dan filler words akan dihitung otomatis.\n\nTips: Google Chrome biasanya memberi dukungan Speech Recognition terbaik. Untuk latihan bahasa Inggris, ubah recognition.lang di script.js menjadi en-US."));
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
  $("sessionCount").textContent = sessionCount;
  persistTopics(); renderCurrentTopic(); renderTimer(); setMicStatus(false);
})();