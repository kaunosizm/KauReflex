(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const KEY = { profile:"kaureflex_profile", record:"kaureflex_record", history:"kaureflex_history" };
  const TOTAL = 5;
  let round = 0, results = [], phase = "idle", timer = null, startedAt = 0;
  let profile = localStorage.getItem(KEY.profile) || "";
  let best = Number(localStorage.getItem(KEY.record)) || null;
  let history = [];
  try { history = JSON.parse(localStorage.getItem(KEY.history) || "[]"); } catch { history = []; }

  const area = $("reaction-area"), title = $("reaction-title"), help = $("reaction-help");
  const icon = $("reaction-icon"), status = $("status-message"), start = $("start-btn");

  function stats() {
    $("round-counter").textContent = `${round} / ${TOTAL}`;
    $("average-stat").textContent = results.length ? Math.round(results.reduce((a,b)=>a+b,0)/results.length) : "—";
    $("last-stat").textContent = results.length ? results[results.length-1] : "—";
    $("best-stat").textContent = best ?? "—";
  }
  function profileUI() {
    $("user-label").textContent = profile ? "@" + profile : "";
    $("user-label").hidden = !profile;
    $("login-btn").hidden = !!profile;
    $("register-btn").hidden = !!profile;
    $("logout-btn").hidden = !profile;
    $("save-description").textContent = profile
      ? `Merhaba ${profile}! Tamamladığın testlerin rekorunu bu cihazda saklayabilirsin.`
      : "Rekorunu bu cihazdaki demo profiline kaydetmek için giriş yap. Üye olmadan da test çözebilirsin.";
  }
  function renderHistory() {
    const list = $("history-list");
    list.replaceChildren();
    if (!history.length) {
      const p = document.createElement("p"); p.className = "empty-history";
      p.textContent = "Henüz tamamlanmış bir testin yok. İlk denemeni yap!";
      list.appendChild(p); return;
    }
    history.slice(0,10).forEach(item => {
      const p = document.createElement("p");
      p.textContent = `${item.date} · Ortalama ${item.average} ms`;
      list.appendChild(p);
    });
  }
  function reset() {
    clearTimeout(timer); timer = null; round = 0; results = []; phase = "idle";
    area.className = "reaction-area ready";
    icon.textContent = "✦"; title.textContent = "BAŞLAMAK İÇİN TIKLA";
    help.textContent = "Ekran yeşile döndüğünde olabildiğince hızlı tıkla.";
    status.textContent = "Hazır olduğunda teste başla.";
    start.disabled = false; $("save-btn").disabled = true; stats();
  }
  function finish() {
    phase = "finished";
    const average = Math.round(results.reduce((a,b)=>a+b,0)/results.length);
    status.textContent = `Test tamamlandı! Ortalama tepki süren: ${average} ms.`;
    icon.textContent = "✧"; title.textContent = `${average} ms`;
    help.textContent = "Harika! Yeniden denemek için Teste Başla'ya bas.";
    area.className = "reaction-area ready";
    start.disabled = false;
    if (best === null || average < best) { best = average; localStorage.setItem(KEY.record, String(best)); }
    history.unshift({average, date:new Date().toLocaleString("tr-TR")});
    history = history.slice(0,20); localStorage.setItem(KEY.history, JSON.stringify(history));
    $("save-btn").disabled = !profile;
    stats(); renderHistory();
  }
  function nextRound() {
    if (round >= TOTAL) { finish(); return; }
    round++; phase = "waiting"; stats();
    area.className = "reaction-area waiting";
    icon.textContent = "…"; title.textContent = "BEKLE…";
    help.textContent = "Yeşil ışık yanmadan dokunma!";
    status.textContent = `${round}. tur · Yeşil ışığı bekle…`;
    timer = setTimeout(() => {
      if (phase !== "waiting") return;
      phase = "go"; startedAt = performance.now();
      area.className = "reaction-area go";
      icon.textContent = "⚡"; title.textContent = "ŞİMDİ TIKLA!";
      help.textContent = "Hemen dokun!";
      status.textContent = "ŞİMDİ!";
    }, 1300 + Math.random()*2700);
  }
  function begin() { reset(); start.disabled = true; nextRound(); }
  function react() {
    if (phase === "waiting") {
      clearTimeout(timer); phase = "early"; area.className = "reaction-area ready";
      icon.textContent = "!"; title.textContent = "ÇOK ERKEN!";
      help.textContent = "Yeşil ışığı beklemeliydin. Yeniden başla.";
      status.textContent = "Erken dokundun!"; start.disabled = false; return;
    }
    if (phase === "go") {
      const ms = Math.round(performance.now()-startedAt);
      results.push(ms); phase = "result";
      area.className = "reaction-area ready"; icon.textContent = "✓";
      title.textContent = `${ms} ms`; help.textContent = `${round}. tur tamamlandı.`;
      status.textContent = `${round}/${TOTAL} tur tamamlandı.`;
      stats(); timer = setTimeout(nextRound, 750); return;
    }
    if (phase === "idle" || phase === "finished" || phase === "early") begin();
  }
  function openDialog(mode) {
    $("dialog-title").textContent = mode === "register" ? "Demo profili oluştur" : "Demo profiline giriş";
    $("dialog-error").textContent = ""; $("username-input").value = profile;
    $("account-dialog").showModal();
  }

  start.addEventListener("click", begin);
  area.addEventListener("click", react);
  document.addEventListener("keydown", e => {
    if (e.code === "Space" && !e.repeat && !$("account-dialog").open) { e.preventDefault(); react(); }
  });
  $("login-btn").addEventListener("click", () => openDialog("login"));
  $("register-btn").addEventListener("click", () => openDialog("register"));
  $("confirm-account-btn").addEventListener("click", e => {
    e.preventDefault();
    const name = $("username-input").value.trim();
    if (name.length < 3) { $("dialog-error").textContent = "Kullanıcı adı en az 3 karakter olmalı."; return; }
    profile = name; localStorage.setItem(KEY.profile, profile);
    $("account-dialog").close(); profileUI(); $("save-btn").disabled = !history.length;
  });
  $("logout-btn").addEventListener("click", () => {
    profile = ""; localStorage.removeItem(KEY.profile); profileUI(); $("save-btn").disabled = true;
  });
  $("save-btn").addEventListener("click", () => {
    if (!profile || !history.length) return;
    status.textContent = "Rekorun bu cihazda saklanıyor. Bulut kaydı V2'de eklenecek.";
  });
  $("clear-history-btn").addEventListener("click", () => {
    if (!confirm("Deneme geçmişini temizlemek istiyor musun?")) return;
    history = []; localStorage.removeItem(KEY.history); renderHistory(); $("save-btn").disabled = true;
  });
  profileUI(); renderHistory(); stats(); $("save-btn").disabled = true;
})();
