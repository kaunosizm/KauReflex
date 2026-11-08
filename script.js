(() => {
  "use strict";
  const SUPABASE_URL = "https://vqmwhzrcosxkrcxrzgeh.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_RUvdJnlkY45aJhoBymHK_g_6MZamTRt";
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const $ = id => document.getElementById(id);
  const TOTAL = 5;
  let round = 0, results = [], phase = "idle", timer = null, startedAt = 0;
  let currentUser = null, username = "", best = null, history = [], authMode = "login";
  const area=$("reaction-area"), title=$("reaction-title"), help=$("reaction-help"), icon=$("reaction-icon"), status=$("status-message"), start=$("start-btn");

  function message(text, isError=false) {
    $("dialog-error").textContent = text;
    $("dialog-error").style.color = isError ? "#ff8585" : "#8fffc7";
  }
  function stats() {
    $("round-counter").textContent = `${round} / ${TOTAL}`;
    $("average-stat").textContent = results.length ? Math.round(results.reduce((a,b)=>a+b,0)/results.length) : "—";
    $("last-stat").textContent = results.length ? results[results.length-1] : "—";
    $("best-stat").textContent = best ?? "—";
  }
  function profileUI() {
    $("user-label").textContent = currentUser ? "@" + (username || currentUser.email) : "";
    $("user-label").hidden = !currentUser;
    $("login-btn").hidden = !!currentUser; $("register-btn").hidden = !!currentUser;
    $("logout-btn").hidden = !currentUser;
    $("save-description").textContent = currentUser
      ? `Merhaba ${username || currentUser.email}! Tamamladığın testleri hesabında bulutta saklayabilirsin.`
      : "Rekorlarını buluta kaydetmek için giriş yap. Üye olmadan da test çözebilirsin.";
    $("save-btn").disabled = !currentUser || !history.length;
  }
  function renderHistory() {
    const list=$("history-list"); list.replaceChildren();
    if (!history.length) { const p=document.createElement("p"); p.className="empty-history"; p.textContent="Henüz tamamlanmış bir testin yok. İlk denemeni yap!"; list.append(p); return; }
    history.slice(0,10).forEach(item => {
      const p=document.createElement("p"); p.className="history-row";
      const d=new Date(item.created_at || item.date || Date.now()).toLocaleString("tr-TR");
      p.textContent=`${d} · Ortalama ${item.average_ms ?? item.average} ms`; list.append(p);
    });
  }
  function reset() {
    clearTimeout(timer); timer=null; round=0; results=[]; phase="idle";
    area.className="reaction-area ready"; icon.textContent="✦"; title.textContent="BAŞLAMAK İÇİN TIKLA";
    help.textContent="Ekran yeşile döndüğünde olabildiğince hızlı tıkla.";
    status.textContent="Hazır olduğunda teste başla."; start.disabled=false; stats();
  }
  function finish() {
    phase="finished"; const average=Math.round(results.reduce((a,b)=>a+b,0)/results.length);
    status.textContent=`Test tamamlandı! Ortalama tepki süren: ${average} ms.`;
    icon.textContent="✧"; title.textContent=`${average} ms`; help.textContent="Harika! Yeniden denemek için Teste Başla'ya bas.";
    area.className="reaction-area ready"; start.disabled=false;
    if (best===null || average<best) best=average;
    history.unshift({average_ms:average,best_ms:Math.min(...results),created_at:new Date().toISOString()});
    history=history.slice(0,20); stats(); renderHistory(); $("save-btn").disabled=!currentUser;
    if (currentUser) saveResult(average, Math.min(...results));
  }
  function nextRound() {
    if (round>=TOTAL) { finish(); return; }
    round++; phase="waiting"; stats(); area.className="reaction-area waiting";
    icon.textContent="…"; title.textContent="BEKLE…"; help.textContent="Yeşil ışık yanmadan dokunma!";
    status.textContent=`${round}. tur · Yeşil ışığı bekle…`;
    timer=setTimeout(()=>{ if(phase!=="waiting")return; phase="go"; startedAt=performance.now();
      area.className="reaction-area go"; icon.textContent="⚡"; title.textContent="ŞİMDİ TIKLA!"; help.textContent="Hemen dokun!"; status.textContent="ŞİMDİ!";
    },1300+Math.random()*2700);
  }
  function begin(){ reset(); start.disabled=true; nextRound(); }
  function react(){
    if(phase==="waiting"){clearTimeout(timer);phase="early";area.className="reaction-area early";icon.textContent="!";title.textContent="ÇOK ERKEN!";help.textContent="Yeşil ışığı beklemeliydin. Yeniden başla.";status.textContent="Erken dokundun!";start.disabled=false;return;}
    if(phase==="go"){const ms=Math.round(performance.now()-startedAt);results.push(ms);phase="result";area.className="reaction-area ready";icon.textContent="✓";title.textContent=`${ms} ms`;help.textContent=`${round}. tur tamamlandı.`;status.textContent=`${round}/${TOTAL} tur tamamlandı.`;stats();timer=setTimeout(nextRound,750);return;}
    if(phase==="idle"||phase==="finished"||phase==="early")begin();
  }
  function openDialog(mode){
    authMode=mode; $("account-dialog").showModal(); $("dialog-error").textContent="";
    const registering=mode==="register", resetting=mode==="reset";
    $("dialog-title").textContent=resetting?"Şifre yenile":registering?"Hesap oluştur":"Giriş Yap";
    $("dialog-copy").textContent=resetting?"E-posta adresine şifre yenileme bağlantısı göndereceğiz.":registering?"Kullanıcı adını, e-postanı ve şifreni belirle.":"Hesabına giriş yap ve rekorlarını bulutta sakla.";
    $("username-label").hidden=!registering; $("username-input").hidden=!registering;
    $("password-input").hidden=resetting; $("forgot-btn").hidden=registering||resetting;
    $("confirm-account-btn").textContent=resetting?"Sıfırlama bağlantısı gönder":registering?"Kayıt Ol":"Giriş Yap";
    $("switch-mode-btn").hidden=resetting; $("switch-mode-btn").textContent=registering?"Zaten hesabın var mı? Giriş yap":"Hesabın yok mu? Kayıt ol";
  }
  async function loadCloudData(){
    if(!currentUser)return;
    const {data:profile,error:pErr}=await supabase.from("profiles").select("username").eq("id",currentUser.id).maybeSingle();
    if(!pErr && profile) username=profile.username;
    const {data,error}=await supabase.from("reaction_results").select("average_ms,best_ms,created_at").eq("user_id",currentUser.id).order("created_at",{ascending:false}).limit(20);
    if(error){status.textContent="Bulut geçmişi alınamadı: "+error.message;return;}
    history=data||[]; best=history.length?Math.min(...history.map(x=>x.average_ms)):null;
    renderHistory();stats();profileUI();
  }
  async function saveResult(average,bestRound){
    const {error}=await supabase.from("reaction_results").insert({user_id:currentUser.id,average_ms:average,best_ms:bestRound});
    if(error){status.textContent="Buluta kaydedilemedi: "+error.message;return;}
    status.textContent="Rekorun hesabına bulut üzerinden kaydedildi!"; await loadCloudData();
  }
  async function submitAuth(){
    const email=$("email-input").value.trim(), password=$("password-input").value, name=$("username-input").value.trim();
    message("");
    if(!email){message("E-posta adresini gir.",true);return;}
    if(authMode!=="reset" && password.length<8){message("Şifre en az 8 karakter olmalı.",true);return;}
    const btn=$("confirm-account-btn"); btn.disabled=true;
    try{
      if(authMode==="register"){
        if(name.length<3){message("Kullanıcı adı en az 3 karakter olmalı.",true);return;}
        const {data,error}=await supabase.auth.signUp({email,password,options:{data:{username:name},emailRedirectTo:location.origin+location.pathname}});
        if(error)throw error;
        if(data.session){currentUser=data.user;username=name;await loadCloudData();$("account-dialog").close();status.textContent="Hesabın oluşturuldu!";}
        else {message("Kayıt bağlantısı e-posta adresine gönderildi. Gelen kutunu kontrol et.");}
      }else if(authMode==="login"){
        const {data,error}=await supabase.auth.signInWithPassword({email,password}); if(error)throw error;
        currentUser=data.user; await loadCloudData(); $("account-dialog").close(); status.textContent="Başarıyla giriş yaptın!";
      }else{
        const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
        if(error)throw error; message("Şifre yenileme bağlantısı e-posta adresine gönderildiyse gelen kutunu kontrol et.");
      }
    }catch(err){message(err.message||"Bir hata oluştu.",true);}
    finally{btn.disabled=false;}
  }
  start.addEventListener("click",begin); area.addEventListener("click",react);
  document.addEventListener("keydown",e=>{if(e.code==="Space"&&!e.repeat&&!$("account-dialog").open){e.preventDefault();react();}});
  $("login-btn").addEventListener("click",()=>openDialog("login"));
  $("register-btn").addEventListener("click",()=>openDialog("register"));
  $("logout-btn").addEventListener("click",async()=>{await supabase.auth.signOut();currentUser=null;username="";best=null;history=[];profileUI();renderHistory();stats();status.textContent="Oturum kapatıldı.";});
  $("confirm-account-btn").addEventListener("click",submitAuth);
  $("switch-mode-btn").addEventListener("click",()=>openDialog(authMode==="register"?"login":"register"));
  $("forgot-btn").addEventListener("click",()=>openDialog("reset"));
  $("save-btn").addEventListener("click",()=>{if(currentUser&&history.length){const last=history[0];saveResult(last.average_ms??last.average,last.best_ms??last.average_ms??last.average);}});
  $("clear-history-btn").addEventListener("click",async()=>{
    if(!confirm("Deneme geçmişini temizlemek istiyor musun?"))return;
    if(currentUser){const {error}=await supabase.from("reaction_results").delete().eq("user_id",currentUser.id);if(error){status.textContent=error.message;return;}}
    history=[];best=null;renderHistory();stats();$("save-btn").disabled=true;
  });
  supabase.auth.onAuthStateChange((_event,session)=>{currentUser=session?.user||null; if(currentUser){setTimeout(loadCloudData,0);}else{username="";profileUI();}});
  (async()=>{const {data}=await supabase.auth.getSession();currentUser=data.session?.user||null;if(currentUser)await loadCloudData();profileUI();renderHistory();stats();})();
})();
