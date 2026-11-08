(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const TOTAL_ROUNDS = 5;
  const PROFILE_KEY = "kaureflex_demo_profile_v11";
  const RECORD_KEY = "kaureflex_demo_record_v11";
  const HISTORY_KEY = "kaureflex_demo_history_v11";

  let round = 0, results = [], phase = "idle", timer = null, startedAt = 0;
  let profile = localStorage.getItem(PROFILE_KEY) || "";
  let best = Number(localStorage.getItem(RECORD_KEY)) || null;
  let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");

  const area = $("reactionArea");
  const text = $("reactionText");
  const status = $("statusLabel");

  function showProfile() {
    $("userLabel").textContent = profile ? "@" + profile : "";
    $("loginOpen").classList.toggle("hidden", !!profile);
    $("registerOpen").classList.toggle("hidden", !!profile);
    $("logoutButton").classList.toggle("hidden", !profile);
    $("bestResult").textContent = best ?? "—";
  }
  function renderHistory() {
    $("historyList").innerHTML = "";
    if (!history.length) { $("historyList").innerHTML = "<li>Henüz deneme yok.</li>"; return; }
    history.slice(0, 8).forEach(item => {
      const li = document.createElement("li");
      li.textContent = `${item.date} — ${item.average} ms ortalama`;
      $("historyList").appendChild(li);
    });
  }
  function updateStats() {
    $("roundLabel").textContent = `Tur ${round} / ${TOTAL_ROUNDS}`;
    $("averageResult").textContent = results.length ? Math.round(results.reduce((a,b)=>a+b,0)/results.length) : "—";
    $("lastResult").textContent = results.length ? results[results.length-1] : "—";
    $("bestResult").textContent = best ?? "—";
  }
  function resetTest() {
    clearTimeout(timer); timer = null; round = 0; results = []; phase = "idle";
    area.className = "reaction-area"; text.textContent = "BAŞLAMAK İÇİN TIKLA";
    status.textContent = "Hazır olduğunda başla"; $("startButton").disabled = false;
    updateStats();
  }
  function nextRound() {
    if (round >= TOTAL_ROUNDS) { finishTest(); return; }
    round++; phase = "waiting"; updateStats();
    status.textContent = "Yeşil ışığı bekle…";
    area.className = "reaction-area waiting";
    text.textContent = "BEKLE… TIKLAMA!";
    timer = setTimeout(() => {
      if (phase !== "waiting") return;
      phase = "go"; startedAt = performance.now();
      area.className = "reaction-area go"; text.textContent = "ŞİMDİ TIKLA!";
      status.textContent = "Hemen tıkla!";
    }, 1200 + Math.random() * 2800);
  }
  function finishTest() {
    phase = "finished"; clearTimeout(timer);
    const average = Math.round(results.reduce((a,b)=>a+b,0)/results.length);
    status.textContent = `Test tamamlandı · Ortalama ${average} ms`;
    text.textContent = `${average} ms — TEKRAR OYNA`;
    area.className = "reaction-area";
    $("startButton").disabled = false;
    if (best === null || average < best) {
      best = average; localStorage.setItem(RECORD_KEY, String(best));
    }
    const item = { average, date: new Date().toLocaleString("tr-TR") };
    history.unshift(item); history = history.slice(0, 20);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderHistory(); updateStats();
    if (!profile) status.textContent += " · Rekoru bu cihazda tutmak için demo profili oluştur.";
  }
  function startTest() {
    resetTest(); $("startButton").disabled = true; nextRound();
  }
  function handleReaction() {
    if (phase === "waiting") {
      clearTimeout(timer); phase = "early"; area.className = "reaction-area";
      text.textContent = "ÇOK ERKEN!"; status.textContent = "Yeşil ışığı beklemeliydin.";
      $("startButton").disabled = false; return;
    }
    if (phase === "go") {
      const ms = Math.round(performance.now() - startedAt);
      results.push(ms); phase = "result"; area.className = "reaction-area";
      text.textContent = `${ms} ms`; status.textContent = `${round}. tur tamamlandı`;
      updateStats(); timer = setTimeout(nextRound, 850); return;
    }
    if (phase === "finished" || phase === "early" || phase === "idle") startTest();
  }
  function openModal(title, description) {
    $("modalTitle").textContent = title; $("modalDescription").textContent = description;
    $("formMessage").textContent = ""; $("usernameInput").value = profile;
    $("accountModal").classList.remove("hidden"); $("usernameInput").focus();
  }
  $("startButton").addEventListener("click", startTest);
  $("resetButton").addEventListener("click", resetTest);
  area.addEventListener("click", handleReaction);
  document.addEventListener("keydown", e => {
    if (e.code === "Space" && !e.repeat && $("accountModal").classList.contains("hidden")) {
      e.preventDefault(); handleReaction();
    }
  });
  $("loginOpen").addEventListener("click", () => openModal("Demo profiline giriş", "Bu cihazda daha önce kullandığın kullanıcı adını gir."));
  $("registerOpen").addEventListener("click", () => openModal("Demo profili oluştur", "Bir kullanıcı adı seç. Bu gerçek hesap kaydı değildir."));
  $("modalClose").addEventListener("click", () => $("accountModal").classList.add("hidden"));
  $("accountModal").addEventListener("click", e => { if (e.target === $("accountModal")) $("accountModal").classList.add("hidden"); });
  $("accountForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("usernameInput").value.trim();
    if (name.length < 3) { $("formMessage").textContent = "Kullanıcı adı en az 3 karakter olmalı."; return; }
    profile = name; localStorage.setItem(PROFILE_KEY, profile);
    $("accountModal").classList.add("hidden"); showProfile();
  });
  $("logoutButton").addEventListener("click", () => {
    profile = ""; localStorage.removeItem(PROFILE_KEY); showProfile();
  });
  $("clearHistory").addEventListener("click", () => {
    if (!confirm("Deneme geçmişi silinsin mi?")) return;
    history = []; localStorage.removeItem(HISTORY_KEY); renderHistory();
  });
  showProfile(); renderHistory(); updateStats();
})();