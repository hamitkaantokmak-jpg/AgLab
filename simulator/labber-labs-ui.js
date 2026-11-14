// Labber'ın kendi labları (E; src/labs, kullanıcının içeriği, değiştirilmeden alındı).
//
// Ayrı içerik grubu: Akademi'nin 40 labından ve onların SHA256 kayıtlarından bağımsızdır.
// Lab tanımı (LabDef) köprü kullanılmadan doğrudan Labber'da kurulur (aglabLabber.startLab);
// terminal L3-a'daki Labber oturumudur, hedefler rt.objectives() ile değerlendirilir.
// Tuvaldeki topoloji yalnız çizimdir (labTopology). Kalıcılık: tarayıcı kaydı yalnız hangi
// labın açık olduğunu tutar; sayfa yenilenince lab baştan başlar (running/startup kaydı L7).
const labberLabsPanel = document.createElement('section');
labberLabsPanel.id = 'labberLabsPanel';
labberLabsPanel.setAttribute('aria-labelledby', 'labberLabsTitle');
labberLabsPanel.innerHTML = `<h3 id="labberLabsTitle"></h3>
<p id="labberLabsIntro"></p>
<label for="labberLabSelect">Lab</label> <select id="labberLabSelect"></select>
<button type="button" id="labberLabStart">Labı başlat</button>
<p id="labberLabEngine" role="note"></p>
<div id="labberLabBrief"></div>
<ol id="labberLabObjectives" aria-label="Lab hedefleri"></ol>
<button type="button" id="labberLabCheck" disabled>Hedefleri kontrol et</button>
<p id="labberLabStatus" role="status" aria-live="polite"></p>`;
// Arayüz PR 2: referans çözüm DOM'a hazır gömülmez; Simülatör'ün "Çözümü göster" kilidi
// açılınca (src/app/sim-workspace.js) aglabLabberLabs.solution() ile oluşturulur.
// Hedef ipuçları da satır içinde açık durmaz; üst çubuktaki "İpucu" sırayla gösterir.
$p('sharedScenarioPanel').after(labberLabsPanel);
function labberLabList() {
  return AgLabSim.LABBER_LABS;
}
function labberLabFind(id) {
  return labberLabList().find((l) => l.id === id) || null;
}
(function renderLabberLabCatalog() {
  const labs = labberLabList();
  $p('labberLabsTitle').textContent = 'Labber labları (' + labs.length + ')';
  $p('labberLabsIntro').textContent =
    'Labber simülatörünün kendi labları. Akademi lablarından ayrı bir gruptur; terminal Labber’ın IOS/VPCS oturumudur ve hedefler Labber’da değerlendirilir.';
  for (const l of labs) {
    const o = document.createElement('option');
    o.value = l.id;
    o.textContent = l.title + ' — ' + l.level;
    $p('labberLabSelect').append(o);
  }
})();
/** Kayıt/dışa aktarma alanı: açık Labber labının kimliği. */
function labberLabFields() {
  const lab = aglabLabber.lab();
  return lab ? { labberLab: { id: lab.id } } : {};
}
function labberLabValidate(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Object.keys(value).join() !== 'id' ||
    !labberLabFind(value.id)
  )
    throw new Error('labberLab alanı geçersiz ya da bilinmeyen lab.');
}
/** Topoloji yüklendikten sonra: labberLab alanı varsa lab baştan başlar. */
function labberLabRestore(value) {
  const panel = $p('labberLabBrief');
  if (!value) {
    $p('labberLabCheck').disabled = true;
    return;
  }
  const def = labberLabFind(value.id);
  aglabLabber.startLab(def);
  $p('labberLabSelect').value = def.id;
  $p('labberLabEngine').textContent =
    'Motor: Labber — lab tanımı doğrudan Labber’da kurulur (köprü kullanılmaz); terminal, hedefler ve Simulation Mode Labber motorunda.';
  $p('labberLabEngine').dataset.engine = 'labber';
  // I-1: çalışma alanı rozeti
  $p('workspaceEngine').textContent = $p('labberLabEngine').textContent;
  $p('workspaceEngine').dataset.engine = 'labber';
  panel.replaceChildren();
  const head = document.createElement('h4');
  head.textContent = def.title;
  const summary = document.createElement('p');
  summary.textContent = def.summary;
  panel.append(head, summary);
  for (const line of def.brief) {
    const p = document.createElement('p');
    p.textContent = line;
    panel.append(p);
  }
  $p('labberLabCheck').disabled = false;
  labberLabsRefresh();
}
/** Hedefler: rt.objectives(); her biri ok / detay / ipucu. */
function labberLabObjectives() {
  if (!aglabLabber.lab()) return null;
  return aglabLabber.runtime().objectives();
}
function labberLabsRefresh() {
  const list = $p('labberLabObjectives');
  if (!aglabLabber.lab()) {
    list.replaceChildren();
    $p('labberLabStatus').textContent = '';
    return;
  }
  let rows;
  try {
    rows = labberLabObjectives();
  } catch (error) {
    $p('labberLabStatus').textContent = 'Değerlendirme hatası: ' + error.message;
    return;
  }
  list.replaceChildren();
  for (const o of rows) {
    const li = document.createElement('li');
    li.dataset.id = o.id;
    li.dataset.ok = String(o.ok);
    li.textContent = (o.ok ? '✓ ' : '✗ ') + o.title + (o.detail ? ' — ' + o.detail : '');
    list.append(li);
  }
  const done = rows.filter((o) => o.ok).length;
  $p('labberLabStatus').textContent =
    done === rows.length
      ? 'Lab tamamlandı: ' + done + '/' + rows.length + ' hedef sağlandı.'
      : 'Henüz çözülmedi: ' + done + '/' + rows.length + ' hedef sağlandı.';
}
function labberLabStart(id) {
  const def = labberLabFind(id);
  if (!def) throw new Error('Bilinmeyen Labber labı: ' + id);
  academyClearSession();
  importTopology(labTopology(def));
  $p('ptTerminal').replaceChildren();
  say(def.title + ' başlatıldı. Hedefleri terminalden (IOS/VPCS) çöz.', 'outinfo');
}
$p('labberLabStart').addEventListener('click', () => labberLabStart($p('labberLabSelect').value));
$p('labberLabCheck').addEventListener('click', labberLabsRefresh);
window.aglabLabberLabs = {
  list: () => labberLabList().map((l) => ({ id: l.id, title: l.title, level: l.level })),
  start: (id) => labberLabStart(id),
  active: () => aglabLabber.lab()?.id || null,
  objectives: () =>
    labberLabObjectives()?.map((o) => ({ id: o.id, ok: o.ok, detail: o.detail ?? null })) ?? null,
  solution: (id) => ({ ...labberLabFind(id).solution }),
  // Arayüz PR 2: görev kartı (başlık, özet) ve hedef ipuçları (üst çubuktaki "İpucu").
  info: (id) => {
    const l = labberLabFind(id);
    return l ? { id: l.id, title: l.title, summary: l.summary, brief: [...l.brief] } : null;
  },
  goals: () =>
    labberLabObjectives()?.map((o) => ({
      id: o.id,
      title: o.title,
      ok: o.ok,
      detail: o.detail ?? null,
      hint: o.hint || '',
      // Kademeli ipucu: neye bak → kavram → komut (src/labs/hint-tiers.ts + labın hint'i).
      hints: [
        ...(AgLabSim.LABBER_HINT_TIERS?.[aglabLabber.lab()?.id]?.[o.id] || []),
        ...(o.hint ? [o.hint] : []),
      ],
    })) ?? null,
};
