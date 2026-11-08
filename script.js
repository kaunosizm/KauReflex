(() => {
"use strict";

/* =========================================
   KAUREFLEX V4
   SUPABASE
========================================= */

const SUPABASE_URL =
"https://vqmwhzrcosxkrcxrzgeh.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
"sb_publishable_RUvdJnlkY45aJhoBymHK_g_6MZamTRt";

if (!window.supabase) {
  console.error("Supabase kütüphanesi yüklenemedi.");
  alert("Bağlantı hatası: Sayfayı yenileyip tekrar dene.");
  return;
}

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const $ = id => document.getElementById(id);
const TOTAL = 5;

/* =========================================
   TEPKİ ÖLÇER DEĞİŞKENLERİ
========================================= */

let round = 0;
let results = [];
let phase = "idle";
let timer = null;
let startedAt = 0;

/* =========================================
   HESAP DEĞİŞKENLERİ
========================================= */

let currentUser = null;
let username = "";
let best = null;
let history = [];
let authMode = "login";
let saving = false;
let lastUnsavedResult = null;

/* =========================================
   AIM LABORATUVARI
========================================= */

const AIM_DURATION = 30;
const AIM_CELLS = 25;

const AIM_LEVELS = {
  easy: {
    name: "Kolay",
    targetInterval: 1250,
    points: 10
  },
  medium: {
    name: "Orta",
    targetInterval: 850,
    points: 15
  },
  hard: {
    name: "Zor",
    targetInterval: 500,
    points: 20
  }
};

let aimDifficulty = "easy";
let aimRunning = false;
let aimScore = 0;
let aimHits = 0;
let aimMisses = 0;
let aimTime = AIM_DURATION;
let aimTimer = null;
let aimSpawnTimer = null;
let aimTarget = -1;
let aimStartedAt = 0;
let aimReactionTimes = [];

/* =========================================
   CPS ÖLÇER
========================================= */

let cpsDuration = 5;
let cpsClicks = 0;
let cpsRunning = false;
let cpsStartedAt = 0;
let cpsTimer = null;
let cpsClickTimes = [];

let cpsBest = Number(
  localStorage.getItem("kaureflex_cps_best") || 0
);

if (!Number.isFinite(cpsBest) || cpsBest < 0) {
  cpsBest = 0;
}

/* =========================================
   ELEMENTLER
========================================= */

const area = $("reaction-area");
const title = $("reaction-title");
const help = $("reaction-help");
const icon = $("reaction-icon");
const status = $("status-message");
const start = $("start-btn");

/* =========================================
   GENEL FONKSİYONLAR
========================================= */

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value;
}

function message(text, isError = false) {
  const element = $("dialog-error");
  if (!element) return;

  element.textContent = text;
  element.style.color = isError ? "#ff8585" : "#8fffc7";
}

function formatDate(date) {
  if (!date) return "—";

  return new Date(date).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function maskEmail(email) {
  if (!email || !email.includes("@")) return "—";

  const parts = email.split("@");
  const name = parts[0];

  const masked = name.length <= 2
    ? name[0]
    : name.slice(0, 2);

  return masked + "***@" + parts[1];
}

/* =========================================
   TEPKİ İSTATİSTİKLERİ
========================================= */

function stats() {
  setText("round-counter", `${round} / ${TOTAL}`);

  setText(
    "average-stat",
    results.length
      ? Math.round(
          results.reduce((a, b) => a + b, 0) /
          results.length
        )
      : "—"
  );

  setText(
    "last-stat",
    results.length
      ? results[results.length - 1]
      : "—"
  );

  setText("best-stat", best ?? "—");
}

/* =========================================
   PROFİL
========================================= */

function renderProfile() {
  if (!currentUser) return;

  const displayName =
    username ||
    currentUser.user_metadata?.username ||
    "Kullanıcı";

  setText("profile-username", displayName);
  setText("profile-email", maskEmail(currentUser.email));
  setText("profile-joined", formatDate(currentUser.created_at));

  const validHistory = history.filter(item =>
    Number.isFinite(Number(item.average_ms ?? item.average))
  );

  if (!validHistory.length) {
    setText("profile-best-average", "—");
    setText("profile-average", "—");
    setText("profile-fastest", "—");
    setText("profile-test-count", "0");
    setText("profile-note", "Henüz tamamlanmış bir testin yok.");
    return;
  }

  const averages = validHistory.map(item =>
    Number(item.average_ms ?? item.average)
  );

  const fastest = validHistory
    .map(item => Number(item.best_ms))
    .filter(Number.isFinite);

  setText("profile-best-average", Math.min(...averages));

  setText(
    "profile-average",
    Math.round(
      averages.reduce((a, b) => a + b, 0) /
      averages.length
    )
  );

  setText(
    "profile-fastest",
    fastest.length ? Math.min(...fastest) : "—"
  );

  setText("profile-test-count", validHistory.length);

  setText(
    "profile-note",
    "İstatistiklerin tamamlanan testlerine göre hesaplanır."
  );
}

/* =========================================
   PROFİL ARAYÜZÜ
========================================= */

function profileUI() {
  const loggedIn = !!currentUser;
  const userLabel = $("user-label");

  const displayName = loggedIn
    ? username || currentUser.user_metadata?.username || "Kullanıcı"
    : "";

  if (userLabel) {
    userLabel.textContent = loggedIn
      ? "@" + displayName
      : "";

    userLabel.hidden = !loggedIn;
  }

  if ($("login-btn")) $("login-btn").hidden = loggedIn;
  if ($("register-btn")) $("register-btn").hidden = loggedIn;
  if ($("logout-btn")) $("logout-btn").hidden = !loggedIn;
  if ($("profile-btn")) $("profile-btn").hidden = !loggedIn;

  setText(
    "save-description",
    loggedIn
      ? `Merhaba ${displayName}! Testlerin hesabında saklanabilir.`
      : "Rekorlarını buluta kaydetmek için giriş yap. Üye olmadan da test çözebilirsin."
  );

  const saveButton = $("save-btn");

  if (saveButton) {
    saveButton.disabled = !loggedIn || !lastUnsavedResult;
  }

  if (
    loggedIn &&
    $("profile-page") &&
    !$("profile-page").hidden
  ) {
    renderProfile();
  }
}

/* =========================================
   SAYFA GEÇİŞLERİ
========================================= */

function showHome() {
  stopAim();
  stopCPS();

  $("home-view").hidden = false;
  $("profile-page").hidden = true;

  showReaction();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openProfile() {
  if (!currentUser) {
    openDialog("login");
    return;
  }

  stopAim();
  stopCPS();
  closeMenu();

  $("home-view").hidden = true;
  $("profile-page").hidden = false;

  renderProfile();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showReaction() {
  stopAim();
  stopCPS();

  $("home-view").hidden = false;
  $("profile-page").hidden = true;

  $("reaction-view").hidden = false;
  $("aim-view").hidden = true;
  $("cps-view").hidden = true;

  setActiveMenu("nav-reaction");
  closeMenu();
}

function showAim() {
  stopAim();
  stopCPS();

  $("home-view").hidden = false;
  $("profile-page").hidden = true;

  $("reaction-view").hidden = true;
  $("aim-view").hidden = false;
  $("cps-view").hidden = true;

  setActiveMenu("nav-aim");
  closeMenu();

  renderAimGrid();
  updateAimStats();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showCPS() {
  stopAim();
  stopCPS();

  $("home-view").hidden = false;
  $("profile-page").hidden = true;

  $("reaction-view").hidden = true;
  $("aim-view").hidden = true;
  $("cps-view").hidden = false;

  setActiveMenu("nav-cps");
  closeMenu();

  updateCPSStats();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* =========================================
   SOL MENÜ
========================================= */

function openMenu() {
  $("side-menu").classList.add("open");
  $("menu-overlay").hidden = false;

  $("side-menu").setAttribute("aria-hidden", "false");
  $("menu-btn").setAttribute("aria-expanded", "true");
}

function closeMenu() {
  $("side-menu").classList.remove("open");
  $("menu-overlay").hidden = true;

  $("side-menu").setAttribute("aria-hidden", "true");
  $("menu-btn").setAttribute("aria-expanded", "false");
}

function setActiveMenu(id) {
  document.querySelectorAll(".menu-link").forEach(button => {
    button.classList.toggle("active", button.id === id);
  });
}

/* =========================================
   DENEME GEÇMİŞİ
========================================= */

function renderHistory() {
  const list = $("history-list");
  if (!list) return;

  list.replaceChildren();

  if (!history.length) {
    const p = document.createElement("p");
    p.className = "empty-history";
    p.textContent =
      "Henüz tamamlanmış bir testin yok. İlk denemeni yap!";

    list.append(p);
    return;
  }

  history.slice(0, 10).forEach(item => {
    const p = document.createElement("p");
    p.className = "history-row";

    const date = new Date(
      item.created_at || item.date || Date.now()
    ).toLocaleString("tr-TR");

    p.textContent =
      `${date} · Ortalama ${item.average_ms ?? item.average} ms`;

    list.append(p);
  });
}

/* =========================================
   TEPKİ TESTİNİ SIFIRLA
========================================= */

function reset() {
  clearTimeout(timer);

  timer = null;
  round = 0;
  results = [];
  phase = "idle";

  area.className = "reaction-area ready";
  icon.textContent = "✦";
  title.textContent = "BAŞLAMAK İÇİN TIKLA";

  help.textContent =
    "Ekran yeşile döndüğünde olabildiğince hızlı tıkla.";

  status.textContent = "Hazır olduğunda teste başla.";

  start.disabled = false;

  stats();
}

/* =========================================
   BULUTA KAYIT
========================================= */

async function saveResult(average, bestRound) {
  if (!currentUser || saving) return false;

  saving = true;

  try {
    const userId = currentUser.id;

    const { error } = await supabase
      .from("reaction_results")
      .insert({
        user_id: userId,
        average_ms: average,
        best_ms: bestRound
      });

    if (error) {
      status.textContent =
        "Buluta kaydedilemedi: " + error.message;
      return false;
    }

    lastUnsavedResult = null;

    status.textContent =
      "Rekorun başarıyla buluta kaydedildi!";

    await loadCloudData();

    return true;

  } catch (error) {
    status.textContent = "Kayıt hatası: " + error.message;
    return false;

  } finally {
    saving = false;
    profileUI();
  }
}

/* =========================================
   TEST BİTİŞİ
========================================= */

function finish() {
  phase = "finished";

  const average = Math.round(
    results.reduce((a, b) => a + b, 0) / results.length
  );

  const bestRound = Math.min(...results);

  status.textContent =
    `Test tamamlandı! Ortalama tepki süren: ${average} ms.`;

  icon.textContent = "✧";
  title.textContent = `${average} ms`;

  help.textContent =
    "Harika! Yeniden denemek için Teste Başla'ya bas.";

  area.className = "reaction-area ready";
  start.disabled = false;

  if (best === null || average < best) {
    best = average;
  }

  const completedTest = {
    average_ms: average,
    best_ms: bestRound,
    created_at: new Date().toISOString()
  };

  history.unshift(completedTest);
  history = history.slice(0, 20);

  lastUnsavedResult = completedTest;

  stats();
  renderHistory();
  profileUI();

  if (currentUser) {
    saveResult(average, bestRound);
  }
}

/* =========================================
   YENİ TUR
========================================= */

function nextRound() {
  if (round >= TOTAL) {
    finish();
    return;
  }

  round++;
  phase = "waiting";

  stats();

  area.className = "reaction-area waiting";
  icon.textContent = "…";
  title.textContent = "BEKLE…";

  help.textContent = "Yeşil ışık yanmadan dokunma!";

  status.textContent =
    `${round}. tur · Yeşil ışığı bekle…`;

  timer = setTimeout(() => {
    if (phase !== "waiting") return;

    phase = "go";
    startedAt = performance.now();

    area.className = "reaction-area go";
    icon.textContent = "⚡";
    title.textContent = "ŞİMDİ TIKLA!";
    help.textContent = "Hemen dokun!";
    status.textContent = "ŞİMDİ!";

  }, 1300 + Math.random() * 2700);
}

function begin() {
  reset();
  start.disabled = true;
  nextRound();
}

/* =========================================
   TEPKİ ALGILAMA
========================================= */

function react() {
  if (phase === "waiting") {
    clearTimeout(timer);

    phase = "early";
    area.className = "reaction-area early";

    icon.textContent = "!";
    title.textContent = "ÇOK ERKEN!";

    help.textContent =
      "Yeşil ışığı beklemeliydin. Yeniden başla.";

    status.textContent = "Erken dokundun!";
    start.disabled = false;

    return;
  }

  if (phase === "go") {
    const ms = Math.round(performance.now() - startedAt);

    results.push(ms);
    phase = "result";

    area.className = "reaction-area ready";
    icon.textContent = "✓";
    title.textContent = `${ms} ms`;

    help.textContent = `${round}. tur tamamlandı.`;
    status.textContent = `${round}/${TOTAL} tur tamamlandı.`;

    stats();

    timer = setTimeout(nextRound, 750);
    return;
  }

  if (
    phase === "idle" ||
    phase === "finished" ||
    phase === "early"
  ) {
    begin();
  }
}

/* =========================================
   AIM GRID OLUŞTUR
========================================= */

function renderAimGrid() {
  const grid = $("aim-grid");
  if (!grid) return;

  if (grid.children.length === AIM_CELLS) {
    return;
  }

  grid.replaceChildren();

  for (let i = 0; i < AIM_CELLS; i++) {
    const cell = document.createElement("button");

    cell.type = "button";
    cell.className = "aim-cell";
    cell.dataset.index = i;

    cell.setAttribute(
      "aria-label",
      `Hedef alanı ${i + 1}`
    );

    cell.addEventListener("click", () => {
      aimCellClick(i);
    });

    grid.append(cell);
  }
}

/* =========================================
   AIM İSTATİSTİKLERİ
========================================= */

function updateAimStats() {
  setText("aim-score", aimScore);
  setText("aim-time", aimTime);
  setText("aim-hits", aimHits);

  const attempts = aimHits + aimMisses;

  const accuracy = attempts
    ? Math.round((aimHits / attempts) * 100)
    : 0;

  setText("aim-accuracy", `%${accuracy}`);
}

/* =========================================
   AIM ZORLUK SEÇİMİ
========================================= */

function selectDifficulty(level) {
  if (aimRunning || !AIM_LEVELS[level]) return;

  aimDifficulty = level;

  document.querySelectorAll(".difficulty-btn").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.difficulty === level
    );
  });

  setText(
    "aim-status",
    `${AIM_LEVELS[level].name} seviyesi seçildi. Oyuna başlayabilirsin.`
  );
}

/* =========================================
   AIM HEDEF GÖSTER
========================================= */

function spawnAimTarget() {
  if (!aimRunning) return;

  const grid = $("aim-grid");
  if (!grid) return;

  const cells = Array.from(
    grid.querySelectorAll(".aim-cell")
  );

  if (!cells.length) return;

  cells.forEach(cell => {
    cell.classList.remove("target");
    cell.replaceChildren();
    cell.disabled = false;
  });

  let next;

  do {
    next = Math.floor(Math.random() * AIM_CELLS);
  } while (next === aimTarget && AIM_CELLS > 1);

  aimTarget = next;

  const targetCell = cells[next];

  targetCell.classList.add("target");
  targetCell.setAttribute("aria-label", "Mor hedef");

  const dot = document.createElement("span");
  dot.className = "aim-target";
  dot.setAttribute("aria-hidden", "true");

  targetCell.append(dot);

  aimStartedAt = performance.now();

  clearTimeout(aimSpawnTimer);

  aimSpawnTimer = setTimeout(() => {
    if (!aimRunning) return;

    aimMisses++;
    aimTarget = -1;

    updateAimStats();
    spawnAimTarget();

  }, AIM_LEVELS[aimDifficulty].targetInterval);
}

/* =========================================
   AIM HÜCRE TIKLAMASI
========================================= */

function aimCellClick(index) {
  if (!aimRunning) return;

  if (index === aimTarget) {
    clearTimeout(aimSpawnTimer);

    const reactionTime = Math.round(
      performance.now() - aimStartedAt
    );

    aimReactionTimes.push(reactionTime);
    aimHits++;

    aimScore += AIM_LEVELS[aimDifficulty].points;

    aimTarget = -1;

    updateAimStats();
    spawnAimTarget();

  } else {
    aimMisses++;
    updateAimStats();

    const cell = $("aim-grid").children[index];

    if (cell) {
      cell.classList.remove("miss");
      void cell.offsetWidth;
      cell.classList.add("miss");

      setTimeout(() => {
        cell.classList.remove("miss");
      }, 250);
    }
  }
}

/* =========================================
   AIM OYUNUNU BAŞLAT
========================================= */

function startAim() {
  if (aimRunning) return;

  resetAimData();

  aimRunning = true;

  $("aim-start-btn").disabled = true;
  $("aim-start-btn").textContent = "OYUN DEVAM EDİYOR";

  document.querySelectorAll(".difficulty-btn").forEach(button => {
    button.disabled = true;
  });

  setText(
    "aim-status",
    `${AIM_LEVELS[aimDifficulty].name} seviyesi başladı! Hedefleri vur!`
  );

  renderAimGrid();
  spawnAimTarget();

  aimTimer = setInterval(() => {
    if (!aimRunning) return;

    aimTime--;
    updateAimStats();

    if (aimTime <= 0) {
      finishAim();
    }

  }, 1000);
}

function resetAimData() {
  clearInterval(aimTimer);
  clearTimeout(aimSpawnTimer);

  aimScore = 0;
  aimHits = 0;
  aimMisses = 0;
  aimTime = AIM_DURATION;
  aimTarget = -1;
  aimReactionTimes = [];

  updateAimStats();

  const grid = $("aim-grid");

  if (grid) {
    Array.from(grid.children).forEach(cell => {
      cell.classList.remove("target", "miss");
      cell.replaceChildren();
      cell.disabled = false;
    });
  }
}

/* =========================================
   AIM OYUNUNU DURDUR
========================================= */

function stopAim() {
  if (!aimRunning) return;

  aimRunning = false;

  clearInterval(aimTimer);
  clearTimeout(aimSpawnTimer);

  aimTarget = -1;

  const grid = $("aim-grid");

  if (grid) {
    Array.from(grid.children).forEach(cell => {
      cell.classList.remove("target");
      cell.replaceChildren();
    });
  }

  if ($("aim-start-btn")) {
    $("aim-start-btn").disabled = false;
    $("aim-start-btn").textContent = "Yeniden Başlat";
  }

  document.querySelectorAll(".difficulty-btn").forEach(button => {
    button.disabled = false;
  });
}

/* =========================================
   AIM OYUNU BİTİŞİ
========================================= */

function finishAim() {
  if (!aimRunning) return;

  const finalScore = aimScore;
  const finalHits = aimHits;

  const attempts = aimHits + aimMisses;

  const accuracy = attempts
    ? Math.round((aimHits / attempts) * 100)
    : 0;

  const averageReaction = aimReactionTimes.length
    ? Math.round(
        aimReactionTimes.reduce((a, b) => a + b, 0) /
        aimReactionTimes.length
      )
    : 0;

  stopAim();

  aimTime = 0;
  updateAimStats();

  setText(
    "aim-status",
    `Süre bitti! Skorun: ${finalScore} · İsabet: ${finalHits} · Doğruluk: %${accuracy} · Ortalama tepki: ${averageReaction || "—"} ms`
  );

  $("aim-start-btn").textContent = "Tekrar Oyna";
}

/* =========================================
   CPS İSTATİSTİKLERİ
========================================= */

function updateCPSStats() {
  setText("cps-clicks", cpsClicks);
  setText("cps-time", cpsDuration.toFixed(1));
  setText("cps-current", "0.00");
  setText("cps-result-best", cpsBest.toFixed(2));
}

/* =========================================
   CPS SÜRE SEÇİMİ
========================================= */

function selectCPSDuration(duration) {
  if (cpsRunning) return;

  const value = Number(duration);

  if (![5, 10, 30].includes(value)) return;

  cpsDuration = value;

  document.querySelectorAll(".cps-duration-btn").forEach(button => {
    button.classList.toggle(
      "active",
      Number(button.dataset.duration) === value
    );
  });

  cpsClicks = 0;
  cpsClickTimes = [];

  setText("cps-clicks", "0");
  setText("cps-time", cpsDuration.toFixed(1));
  setText("cps-current", "0.00");
  setText("cps-result-clicks", "—");
  setText("cps-result-average", "—");
  setText("cps-result-best", cpsBest.toFixed(2));

  setText("cps-status", `${cpsDuration} saniyelik test seçildi.`);
  setText("cps-click-title", "BAŞLAMAK İÇİN TIKLA");
  setText("cps-click-help", "Teste başla ve olabildiğince hızlı tıkla!");
}

/* =========================================
   CPS TESTİNİ BAŞLAT
========================================= */

function startCPS() {
  if (cpsRunning) return;

  clearInterval(cpsTimer);

  cpsClicks = 0;
  cpsClickTimes = [];
  cpsStartedAt = performance.now();
  cpsRunning = true;

  const clickArea = $("cps-click-area");

  clickArea.disabled = false;
  clickArea.classList.add("running");

  $("cps-start-btn").disabled = true;
  $("cps-start-btn").textContent = "TEST DEVAM EDİYOR";

  document.querySelectorAll(".cps-duration-btn").forEach(button => {
    button.disabled = true;
  });

  setText("cps-click-title", "HIZLICA TIKLA!");
  setText("cps-click-help", "Her tıklaman sayılır!");
  setText("cps-status", "Test başladı! Hızını göster!");

  setText("cps-clicks", "0");
  setText("cps-time", cpsDuration.toFixed(1));
  setText("cps-current", "0.00");

  setText("cps-result-clicks", "—");
  setText("cps-result-average", "—");

  cpsTimer = setInterval(updateCPSTimer, 40);
}

/* =========================================
   CPS TIKLAMA
========================================= */

function cpsClick() {
  if (!cpsRunning) return;

  const now = performance.now();
  const elapsed = (now - cpsStartedAt) / 1000;

  if (elapsed >= cpsDuration) {
    finishCPS();
    return;
  }

  cpsClicks++;
  cpsClickTimes.push(now);

  setText("cps-clicks", cpsClicks);

  updateCPSLive();
}

/* =========================================
   CPS CANLI GÖSTERGE
========================================= */

function updateCPSLive() {
  const now = performance.now();

  cpsClickTimes = cpsClickTimes.filter(
    time => now - time <= 1000
  );

  const currentCPS = cpsClickTimes.length;

  setText("cps-current", currentCPS.toFixed(2));
}

/* =========================================
   CPS ZAMANLAYICI
========================================= */

function updateCPSTimer() {
  if (!cpsRunning) return;

  const elapsed = (performance.now() - cpsStartedAt) / 1000;
  const remaining = Math.max(0, cpsDuration - elapsed);

  setText("cps-time", remaining.toFixed(1));

  updateCPSLive();

  if (remaining <= 0) {
    finishCPS();
  }
}

/* =========================================
   CPS TESTİNİ BİTİR
========================================= */

function finishCPS() {
  if (!cpsRunning) return;

  const actualDuration = cpsDuration;
  const totalClicks = cpsClicks;
  const averageCPS = totalClicks / actualDuration;

  cpsRunning = false;

  clearInterval(cpsTimer);
  cpsTimer = null;

  const clickArea = $("cps-click-area");

  clickArea.disabled = true;
  clickArea.classList.remove("running");

  $("cps-start-btn").disabled = false;
  $("cps-start-btn").textContent = "Tekrar Dene";

  document.querySelectorAll(".cps-duration-btn").forEach(button => {
    button.disabled = false;
  });

  if (averageCPS > cpsBest) {
    cpsBest = averageCPS;

    try {
      localStorage.setItem(
        "kaureflex_cps_best",
        cpsBest.toFixed(2)
      );
    } catch (error) {
      console.warn("CPS rekoru kaydedilemedi:", error);
    }
  }

  setText("cps-clicks", totalClicks);
  setText("cps-time", "0.0");
  setText("cps-current", averageCPS.toFixed(2));

  setText("cps-result-clicks", totalClicks);
  setText("cps-result-average", averageCPS.toFixed(2));
  setText("cps-result-best", cpsBest.toFixed(2));

  setText("cps-click-title", "TEST TAMAMLANDI!");
  setText(
    "cps-click-help",
    `${totalClicks} tıklama yaptın. Tekrar deneyebilirsin.`
  );

  setText(
    "cps-status",
    `Test bitti! Ortalama hızın: ${averageCPS.toFixed(2)} CPS`
  );
}

/* =========================================
   CPS TESTİNİ DURDUR
========================================= */

function stopCPS() {
  clearInterval(cpsTimer);
  cpsTimer = null;

  if (!cpsRunning) return;

  cpsRunning = false;

  const clickArea = $("cps-click-area");

  if (clickArea) {
    clickArea.disabled = true;
    clickArea.classList.remove("running");
  }

  if ($("cps-start-btn")) {
    $("cps-start-btn").disabled = false;
    $("cps-start-btn").textContent = "Teste Başla";
  }

  document.querySelectorAll(".cps-duration-btn").forEach(button => {
    button.disabled = false;
  });

  setText("cps-click-title", "BAŞLAMAK İÇİN TIKLA");
  setText("cps-click-help", "Teste başla ve olabildiğince hızlı tıkla!");
  setText("cps-status", "Test durduruldu. Yeniden başlayabilirsin.");
}

/* =========================================
   GİRİŞ PENCERESİ
========================================= */

function openDialog(mode) {
  authMode = mode;

  const dialog = $("account-dialog");

  if (!dialog.open) dialog.showModal();

  message("");

  const registering = mode === "register";
  const resetting = mode === "reset";

  setText(
    "dialog-title",
    resetting
      ? "Şifre yenile"
      : registering
        ? "Hesap oluştur"
        : "Giriş Yap"
  );

  setText(
    "dialog-copy",
    resetting
      ? "E-posta adresine şifre yenileme bağlantısı göndereceğiz."
      : registering
        ? "Kullanıcı adını, e-postanı ve şifreni belirle."
        : "Hesabına giriş yap ve rekorlarını bulutta sakla."
  );

  $("username-label").hidden = !registering;
  $("username-input").hidden = !registering;
  $("password-input").hidden = resetting;
  $("forgot-btn").hidden = registering || resetting;
  $("switch-mode-btn").hidden = resetting;

  $("confirm-account-btn").textContent = resetting
    ? "Sıfırlama bağlantısı gönder"
    : registering
      ? "Kayıt Ol"
      : "Giriş Yap";

  $("switch-mode-btn").textContent = registering
    ? "Zaten hesabın var mı? Giriş yap"
    : "Hesabın yok mu? Kayıt ol";
}

/* =========================================
   BULUT VERİLERİ
========================================= */

async function loadCloudData() {
  if (!currentUser) return;

  const userId = currentUser.id;

  username =
    currentUser.user_metadata?.username ||
    username ||
    "";

  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle();

    if (currentUser?.id !== userId) return;

    if (!profileError && profile?.username) {
      username = profile.username;
    } else if (profileError) {
      console.warn(
        "Profil kullanıcı adı okunamadı:",
        profileError
      );
    }

    const { data, error } = await supabase
      .from("reaction_results")
      .select("average_ms,best_ms,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (currentUser?.id !== userId) return;

    if (error) throw error;

    history = data || [];

    const averages = history
      .map(item => Number(item.average_ms))
      .filter(Number.isFinite);

    best = averages.length
      ? Math.min(...averages)
      : null;

    renderHistory();
    renderProfile();
    profileUI();
    stats();

  } catch (error) {
    console.error("Bulut verileri yüklenemedi:", error);
  }
}

/* =========================================
   GİRİŞ / KAYIT / ŞİFRE YENİLEME
========================================= */

async function submitAuth() {
  if (saving) return;

  const email = $("email-input").value.trim();
  const password = $("password-input").value;

  const userName = $("username-input").value
    .trim()
    .toLowerCase();

  if (!email) {
    message("E-posta adresini gir.", true);
    return;
  }

  if (authMode !== "reset" && !password) {
    message("Şifreni gir.", true);
    return;
  }

  if (authMode === "register") {
    if (userName.length < 3 || userName.length > 20) {
      message(
        "Kullanıcı adı 3 ile 20 karakter arasında olmalı.",
        true
      );
      return;
    }

    if (!/^[a-z0-9_]+$/.test(userName)) {
      message(
        "Kullanıcı adında yalnızca küçük harf, sayı ve _ kullanabilirsin.",
        true
      );
      return;
    }

    if (password.length < 8) {
      message("Şifren en az 8 karakter olmalı.", true);
      return;
    }
  }

  saving = true;

  const button = $("confirm-account-btn");
  button.disabled = true;

  try {

    if (authMode === "reset") {
      const { error } =
        await supabase.auth.resetPasswordForEmail(
          email,
          {
            redirectTo:
              window.location.origin +
              window.location.pathname
          }
        );

      if (error) throw error;

      message(
        "Şifre yenileme bağlantısı e-posta adresine gönderildi."
      );

      return;
    }

    if (authMode === "register") {

      const { data: existingProfile, error: checkError } =
        await supabase
          .from("profiles")
          .select("id")
          .eq("username", userName)
          .maybeSingle();

      if (checkError) {
        console.warn(
          "Kullanıcı adı ön kontrolü yapılamadı:",
          checkError.message
        );
      }

      if (existingProfile) {
        message(
          "Bu kullanıcı adı zaten alınmış. Başka bir isim dene.",
          true
        );
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,

        options: {
          data: {
            username: userName
          }
        }
      });

      if (error) throw error;

      if (data.user && data.session) {
        currentUser = data.user;
        username = userName;

        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            username: userName
          })
          .eq("id", data.user.id);

        if (updateError) {
          console.error(
            "Profil kullanıcı adı güncellenemedi:",
            updateError
          );
        }

        $("account-dialog").close();

        await loadCloudData();

        profileUI();

        status.textContent =
          "Hesabın oluşturuldu. Hoş geldin!";

      } else {
        message(
          "Kayıt oluşturuldu. E-postana gelen doğrulama bağlantısını kontrol et."
        );
      }

      return;
    }

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) throw error;

    currentUser = data.user;

    $("account-dialog").close();

    await loadCloudData();

    profileUI();

    status.textContent = "Başarıyla giriş yaptın!";

  } catch (error) {

    console.error("Hesap işlemi hatası:", error);

    const errorText = (
      error.message || ""
    ).toLowerCase();

    if (
      errorText.includes("username") ||
      errorText.includes("duplicate") ||
      errorText.includes("already exists") ||
      errorText.includes("zaten alınmış")
    ) {
      message(
        "Bu kullanıcı adı zaten alınmış. Başka bir isim dene.",
        true
      );

    } else if (
      errorText.includes("user already registered")
    ) {
      message(
        "Bu e-posta adresiyle zaten hesap oluşturulmuş.",
        true
      );

    } else if (
      errorText.includes("invalid login credentials")
    ) {
      message(
        "E-posta veya şifre hatalı.",
        true
      );

    } else {
      message(
        error.message || "Bir hata oluştu.",
        true
      );
    }

  } finally {
    saving = false;
    button.disabled = false;
  }
}

/* =========================================
   ÇIKIŞ
========================================= */

async function logout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    alert("Çıkış yapılamadı: " + error.message);
    return;
  }

  currentUser = null;
  username = "";
  history = [];
  best = null;
  lastUnsavedResult = null;

  profileUI();
  renderHistory();
  stats();

  showHome();

  status.textContent = "Hesabından çıkış yaptın.";
}

/* =========================================
   BUTON BAĞLANTILARI
========================================= */

$("menu-btn").addEventListener("click", openMenu);

$("close-menu-btn").addEventListener(
  "click",
  closeMenu
);

$("menu-overlay").addEventListener(
  "click",
  closeMenu
);

$("nav-reaction").addEventListener(
  "click",
  showReaction
);

$("nav-aim").addEventListener(
  "click",
  showAim
);

$("nav-cps").addEventListener(
  "click",
  showCPS
);

$("nav-profile").addEventListener(
  "click",
  openProfile
);

area.addEventListener("click", react);

start.addEventListener("click", begin);

$("login-btn").addEventListener("click", () => {
  openDialog("login");
});

$("register-btn").addEventListener("click", () => {
  openDialog("register");
});

$("profile-btn").addEventListener(
  "click",
  openProfile
);

$("logout-btn").addEventListener(
  "click",
  logout
);

$("profile-logout-btn").addEventListener(
  "click",
  logout
);

$("back-home-btn").addEventListener(
  "click",
  showHome
);

$("confirm-account-btn").addEventListener(
  "click",
  submitAuth
);

$("switch-mode-btn").addEventListener("click", () => {
  openDialog(
    authMode === "register"
      ? "login"
      : "register"
  );
});

$("forgot-btn").addEventListener("click", () => {
  openDialog("reset");
});

/* =========================================
   AIM ZORLUK BUTONLARI
========================================= */

document.querySelectorAll(".difficulty-btn").forEach(button => {
  button.addEventListener("click", () => {
    selectDifficulty(button.dataset.difficulty);
  });
});

$("aim-start-btn").addEventListener(
  "click",
  startAim
);

/* =========================================
   CPS BUTONLARI
========================================= */

document.querySelectorAll(".cps-duration-btn").forEach(button => {
  button.addEventListener("click", () => {
    selectCPSDuration(button.dataset.duration);
  });
});

$("cps-start-btn").addEventListener(
  "click",
  startCPS
);

$("cps-click-area").addEventListener(
  "click",
  cpsClick
);

/* =========================================
   GEÇMİŞİ TEMİZLE
========================================= */

$("clear-history-btn").addEventListener(
  "click",
  async () => {
    if (!history.length) return;

    if (
      !confirm(
        "Deneme geçmişini silmek istediğine emin misin?"
      )
    ) {
      return;
    }

    if (currentUser) {
      const { error } = await supabase
        .from("reaction_results")
        .delete()
        .eq("user_id", currentUser.id);

      if (error) {
        alert(
          "Geçmiş silinemedi: " + error.message
        );
        return;
      }
    }

    history = [];
    best = null;
    lastUnsavedResult = null;

    renderHistory();
    renderProfile();
    profileUI();
    stats();

    status.textContent =
      "Deneme geçmişin temizlendi.";
  }
);

/* =========================================
   MANUEL KAYIT
========================================= */

$("save-btn").addEventListener(
  "click",
  async () => {
    if (!currentUser || !lastUnsavedResult) {
      return;
    }

    await saveResult(
      lastUnsavedResult.average_ms,
      lastUnsavedResult.best_ms
    );
  }
);

/* =========================================
   KLAVYE KONTROLÜ
========================================= */

document.addEventListener("keydown", event => {
  if (event.code === "Escape") {
    closeMenu();
    return;
  }

  if (event.code !== "Space") return;

  if ($("account-dialog").open) return;
  if (!$("profile-page").hidden) return;
  if ($("reaction-view").hidden) return;
  if (!$("aim-view").hidden) return;
  if (!$("cps-view").hidden) return;

  const active = document.activeElement;

  if (
    active &&
    ["INPUT", "TEXTAREA", "BUTTON"].includes(
      active.tagName
    )
  ) {
    return;
  }

  event.preventDefault();

  react();
});

/* =========================================
   SUPABASE OTURUMU
========================================= */

supabase.auth.onAuthStateChange(
  (event, session) => {

    currentUser = session?.user || null;

    if (currentUser) {

      Promise.resolve().then(() => {
        if (currentUser) {
          return loadCloudData();
        }
      });

    } else {
      username = "";
      history = [];
      best = null;
      lastUnsavedResult = null;

      renderHistory();
      stats();
    }

    profileUI();
  }
);

/* =========================================
   İLK AÇILIŞ
========================================= */

async function initialize() {
  renderAimGrid();
  renderHistory();
  stats();
  updateAimStats();
  updateCPSStats();
  profileUI();

  try {
    const { data, error } =
      await supabase.auth.getSession();

    if (error) throw error;

    currentUser = data.session?.user || null;

    if (currentUser) {
      await loadCloudData();
    }

    profileUI();

  } catch (error) {
    console.error(
      "Oturum kontrolü başarısız:",
      error
    );

    status.textContent =
      "Hesap bağlantısı kontrol edilemedi.";
  }
}

initialize();

})();
