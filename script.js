
(() => {
"use strict";

/* =========================================
   KAUREFLEX V3
   SUPABASE AYARLARI
========================================= */

const SUPABASE_URL = "https://vqmwhzrcosxkrcxrzgeh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_RUvdJnlkY45aJhoBymHK_g_6MZamTRt";

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

let currentUser = null;
let username = "";
let best = null;
let history = [];
let authMode = "login";
let saving = false;

let lastSavedResult = null;

/* =========================================
   AIM LABORATUVARI DEĞİŞKENLERİ
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
   ELEMENTLER
========================================= */

const area = $("reaction-area");
const title = $("reaction-title");
const help = $("reaction-help");
const icon = $("reaction-icon");
const status = $("status-message");
const start = $("start-btn");

/* =========================================
   GENEL YARDIMCILAR
========================================= */

function message(text, isError = false) {
  $("dialog-error").textContent = text;
  $("dialog-error").style.color =
    isError ? "#ff8585" : "#8fffc7";
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
    ? name[0] + "***"
    : name.slice(0, 2) + "***";

  return masked + "@" + parts[1];
}

/* =========================================
   TEPKİ İSTATİSTİKLERİ
========================================= */

function stats() {
  $("round-counter").textContent = `${round} / ${TOTAL}`;

  $("average-stat").textContent = results.length
    ? Math.round(
        results.reduce((a, b) => a + b, 0) / results.length
      )
    : "—";

  $("last-stat").textContent = results.length
    ? results[results.length - 1]
    : "—";

  $("best-stat").textContent = best ?? "—";
}

/* =========================================
   PROFİL İSTATİSTİKLERİ
========================================= */

function renderProfile() {
  if (!currentUser) return;

  $("profile-username").textContent =
    username || currentUser.email?.split("@")[0] || "Kullanıcı";

  $("profile-email").textContent =
    maskEmail(currentUser.email);

  $("profile-joined").textContent =
    formatDate(currentUser.created_at);

  const validHistory = history.filter(item =>
    Number.isFinite(Number(item.average_ms ?? item.average))
  );

  if (!validHistory.length) {
    $("profile-best-average").textContent = "—";
    $("profile-average").textContent = "—";
    $("profile-fastest").textContent = "—";
    $("profile-test-count").textContent = "0";
    $("profile-note").textContent =
      "Henüz tamamlanmış bir testin yok.";
    return;
  }

  const averages = validHistory.map(item =>
    Number(item.average_ms ?? item.average)
  );

  const fastest = validHistory
    .map(item => Number(item.best_ms))
    .filter(Number.isFinite);

  $("profile-best-average").textContent =
    Math.min(...averages);

  $("profile-average").textContent =
    Math.round(
      averages.reduce((a, b) => a + b, 0) / averages.length
    );

  $("profile-fastest").textContent = fastest.length
    ? Math.min(...fastest)
    : "—";

  $("profile-test-count").textContent =
    validHistory.length;

  $("profile-note").textContent =
    "İstatistiklerin tamamlanan testlerine göre hesaplanır.";
}

function profileUI() {
  const loggedIn = !!currentUser;

  $("user-label").textContent = loggedIn
    ? "@" + (username || currentUser.email || "Kullanıcı")
    : "";

  $("user-label").hidden = !loggedIn;
  $("login-btn").hidden = loggedIn;
  $("register-btn").hidden = loggedIn;
  $("logout-btn").hidden = !loggedIn;
  $("profile-btn").hidden = !loggedIn;

  $("save-description").textContent = loggedIn
    ? `Merhaba ${username || currentUser.email}! Testlerin hesabında bulutta saklanabilir.`
    : "Rekorlarını buluta kaydetmek için giriş yap. Üye olmadan da test çözebilirsin.";

  $("save-btn").disabled =
    !loggedIn || !history.length;

  if (loggedIn && !$("profile-page").hidden) {
    renderProfile();
  }
}

/* =========================================
   SAYFA GEÇİŞLERİ
========================================= */

function showHome() {
  $("home-view").hidden = false;
  $("profile-page").hidden = true;

  showReaction();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function openProfile() {
  if (!currentUser) {
    openDialog("login");
    return;
  }

  closeMenu();

  $("home-view").hidden = true;
  $("profile-page").hidden = false;

  renderProfile();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function showReaction() {
  stopAim();

  $("reaction-view").hidden = false;
  $("aim-view").hidden = true;

  setActiveMenu("nav-reaction");
  closeMenu();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function showAim() {
  $("reaction-view").hidden = true;
  $("aim-view").hidden = false;

  setActiveMenu("nav-aim");
  closeMenu();

  renderAimGrid();
  updateAimStats();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
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

    status.textContent =
      "Rekorun başarıyla buluta kaydedildi!";

    await loadCloudData();

    return true;

  } catch (error) {
    status.textContent =
      "Kayıt hatası: " + error.message;

    return false;

  } finally {
    saving = false;
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
    created_at: new Date().toISOString(),
    localOnly: !currentUser
  };

  history.unshift(completedTest);
  history = history.slice(0, 20);

  lastSavedResult = null;

  stats();
  renderHistory();
  profileUI();

  if (currentUser) {
    lastSavedResult = completedTest.created_at;
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

  help.textContent =
    "Yeşil ışık yanmadan dokunma!";

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

/* =========================================
   TESTİ BAŞLAT
========================================= */

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
    status.textContent =
      `${round}/${TOTAL} tur tamamlandı.`;

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

  if (grid.children.length === AIM_CELLS) {
    return;
  }

  grid.replaceChildren();

  for (let i = 0; i < AIM_CELLS; i++) {
    const cell = document.createElement("button");

    cell.type = "button";
    cell.className = "aim-cell";
    cell.dataset.index = i;
    cell.setAttribute("aria-label", `Hedef alanı ${i + 1}`);

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
  $("aim-score").textContent = aimScore;
  $("aim-time").textContent = aimTime;
  $("aim-hits").textContent = aimHits;

  const attempts = aimHits + aimMisses;

  const accuracy = attempts
    ? Math.round((aimHits / attempts) * 100)
    : 0;

  $("aim-accuracy").textContent = `%${accuracy}`;
}

/* =========================================
   AIM ZORLUK SEÇİMİ
========================================= */

function selectDifficulty(level) {
  if (aimRunning) return;

  if (!AIM_LEVELS[level]) return;

  aimDifficulty = level;

  document.querySelectorAll(".difficulty-btn").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.difficulty === level
    );
  });

  const name = AIM_LEVELS[level].name;

  $("aim-status").textContent =
    `${name} seviyesi seçildi. Oyuna başlayabilirsin.`;
}

/* =========================================
   AIM HEDEF GÖSTER
========================================= */

function spawnAimTarget() {
  if (!aimRunning) return;

  const cells = Array.from(
    $("aim-grid").querySelectorAll(".aim-cell")
  );

  if (!cells.length) return;

  cells.forEach(cell => {
    cell.classList.remove("target");
    cell.disabled = false;
    cell.textContent = "";
  });

  let next;

  do {
    next = Math.floor(Math.random() * AIM_CELLS);
  } while (next === aimTarget && AIM_CELLS > 1);

  aimTarget = next;

  const targetCell = cells[next];

  targetCell.classList.add("target");
  targetCell.setAttribute("aria-label", "Mor hedef");

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

  $("aim-status").textContent =
    `${AIM_LEVELS[aimDifficulty].name} seviyesi başladı! Hedefleri vur!`;

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

/* =========================================
   AIM VERİLERİNİ SIFIRLA
========================================= */

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

  Array.from(grid.children).forEach(cell => {
    cell.classList.remove("target", "miss");
    cell.disabled = false;
  });
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
    });
  }

  $("aim-start-btn").disabled = false;
  $("aim-start-btn").textContent = "Yeniden Başlat";

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
  const finalMisses = aimMisses;

  const attempts = finalHits + finalMisses;

  const accuracy = attempts
    ? Math.round((finalHits / attempts) * 100)
    : 0;

  const averageReaction = aimReactionTimes.length
    ? Math.round(
        aimReactionTimes.reduce((a, b) => a + b, 0) /
        aimReactionTimes.length
      )
    : 0;

  stopAim();

  $("aim-time").textContent = "0";

  $("aim-status").textContent =
    `Süre bitti! Skorun: ${finalScore} · İsabet: ${finalHits} · Doğruluk: %${accuracy} · Ortalama tepki: ${averageReaction || "—"} ms`;

  $("aim-start-btn").textContent = "Tekrar Oyna";

  updateAimStats();
}

/* =========================================
   GİRİŞ PENCERESİ
========================================= */

function openDialog(mode) {
  authMode = mode;

  $("account-dialog").showModal();
  $("dialog-error").textContent = "";

  const registering = mode === "register";
  const resetting = mode === "reset";

  $("dialog-title").textContent = resetting
    ? "Şifre yenile"
    : registering
    ? "Hesap oluştur"
    : "Giriş Yap";

  $("dialog-copy").textContent = resetting
    ? "E-posta adresine şifre yenileme bağlantısı göndereceğiz."
    : registering
    ? "Kullanıcı adını, e-postanı ve şifreni belirle."
    : "Hesabına giriş yap ve rekorlarını bulutta sakla.";

  $("username-label").hidden = !registering;
  $("username-input").hidden = !registering;
  $("password-input").hidden = resetting;
  $("forgot-btn").hidden = registering || resetting;

  $("confirm-account-btn").textContent = resetting
    ? "Sıfırlama bağlantısı gönder"
    : registering
    ? "Kayıt Ol"
    : "Giriş Yap";

  $("switch-mode-btn").hidden = resetting;

  $("switch-mode-btn").textContent = registering
    ? "Zaten hesabın var mı? Giriş yap"
    : "Hesabın yok mu? Kayıt ol";
}

/* =========================================
   BULUT VERİLERİNİ YÜKLE
========================================= */

async function loadCloudData() {
  if (!currentUser) return;

  const userId = currentUser.id;

  profileUI();

  try {
    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("username")
        .eq("id", userId)
        .maybeSingle();

    if (currentUser?.id !== userId) return;

    if (!profileError && profile) {
      username = profile.username;
    }

    profileUI();

    const { data, error } = await supabase
      .from("reaction_results")
      .select("average_ms,best_ms,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (currentUser?.id !== userId) return;
      
