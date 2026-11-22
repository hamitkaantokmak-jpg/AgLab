// Eğitici katman (Şube 1.0): uygulamayı ilk kez kullanan için balon ipuçları.
//
// Dört parça:
//   1. İlk açılış turu: Müfredat → ders adımları → Simülatör → ipucu ayarı. Atlanabilir,
//      üst çubuktaki 💡 menüsünden yeniden başlatılır.
//   2. Bağlamsal ipuçları: bir şeyle ilk kez karşılaşınca bir kez çıkar (ilk görev, ilk
//      Kontrol et, ilk İpucu, ilk "% Invalid input", ilk 169.254 adresi, ilk başarısız ping…).
//   3. Terminal kip rehberi: komut satırının altında kalıcı satır; istemden kipi (kullanıcı,
//      ayrıcalıklı, ayar, arayüz…) ve oradan nasıl çıkılacağını söyler.
//   4. Komut açıklaması: bir komut ilk kez yazılınca tek cümlelik açıklama.
//
// Her balon "Anladım" ile kapanır ve bir daha çıkmaz; 💡 menüsü hepsini kapatır, turu yeniden
// başlatır ya da gösterilenleri sıfırlar. Durum: localStorage `aglab-coach-v1`
// ({ off, seen: {id: 1}, tour }). Katman yalnız DOM'u okur ve kendi öğelerini ekler; ürünün
// davranışını değiştirmez.
//
// Otomasyon altında (navigator.webdriver: Playwright testleri) katman kapalıdır; aksi halde
// balonlar mevcut testlerin tıklamalarının önüne geçerdi. Katmanı sınayan testler
// localStorage `aglab-coach-force` = '1' ile açar (test_aglab_coach.py).
(function () {
  const KEY = 'aglab-coach-v1';
  const $ = (id) => document.getElementById(id);
  const read = (k) => {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  };
  let state = { off: false, seen: {}, tour: '' };
  try {
    const s = JSON.parse(read(KEY) || 'null');
    if (s && typeof s === 'object')
      state = {
        off: !!s.off,
        seen: s.seen && typeof s.seen === 'object' ? s.seen : {},
        tour: typeof s.tour === 'string' ? s.tour : '',
      };
  } catch (e) {}
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {}
  }
  const available = !navigator.webdriver || read('aglab-coach-force') === '1';
  const enabled = () => available && !state.off;

  // ------------------------------------------------------------------ balon
  const box = document.createElement('div');
  box.className = 'ag-coach';
  box.id = 'agCoach';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'false');
  box.setAttribute('aria-labelledby', 'agCoachTitle');
  box.hidden = true;
  const arrow = document.createElement('span');
  arrow.className = 'ag-coach-arrow';
  const head = document.createElement('b');
  head.id = 'agCoachTitle';
  const body = document.createElement('div');
  body.className = 'ag-coach-body';
  body.id = 'agCoachBody';
  const foot = document.createElement('div');
  foot.className = 'ag-coach-foot';
  box.append(arrow, head, body, foot);
  document.body.append(box);

  let current = null;
  const queue = [];
  function button(text, cls, fn) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ag-coach-btn' + (cls ? ' ' + cls : '');
    b.textContent = text;
    b.addEventListener('click', fn);
    return b;
  }
  function visible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function place() {
    if (!current) return;
    const target = typeof current.target === 'function' ? current.target() : current.target;
    const bw = box.offsetWidth,
      bh = box.offsetHeight,
      vw = window.innerWidth,
      vh = window.innerHeight;
    if (!visible(target)) {
      box.dataset.side = 'none';
      box.style.left = Math.max(8, (vw - bw) / 2) + 'px';
      box.style.top = '72px';
      return;
    }
    const r = target.getBoundingClientRect();
    const below = r.bottom + 12 + bh <= vh || r.top - 12 - bh < 0;
    const top = below ? r.bottom + 12 : r.top - 12 - bh;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - bw / 2), vw - bw - 8);
    box.dataset.side = below ? 'below' : 'above';
    box.style.left = left + 'px';
    box.style.top = Math.max(8, Math.min(top, vh - bh - 8)) + 'px';
    arrow.style.left = Math.min(Math.max(14, r.left + r.width / 2 - left), bw - 14) + 'px';
  }
  let raf = 0;
  const replace = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(place);
  };
  window.addEventListener('resize', replace);
  window.addEventListener('scroll', replace, true);

  /**
   * Balon göster. item: { id, title, text (dizgi ya da Node), target (öğe ya da işlev), kind
   * ('tip' | 'cmd' | 'tour'), actions? }. Komut balonu sırayı beklemez, öncekinin yerine geçer.
   */
  function show(item) {
    if (!enabled()) return;
    // Komut açıklaması en düşük önceliktir: yeni komut ya da ipucu onun yerine geçer; tur ya da
    // ipucu açıkken gelen komut açıklaması atlanır (görülmüş sayılmaz, sonraki yazılışta çıkar).
    if (current && current.kind === 'cmd') current = null;
    else if (current && item.kind === 'cmd') return;
    if (current) {
      if (!queue.some((q) => q.id === item.id)) queue.push(item);
      return;
    }
    current = item;
    box.dataset.kind = item.kind || 'tip';
    box.dataset.id = item.id;
    head.textContent = item.title;
    body.replaceChildren(
      ...(Array.isArray(item.text) ? item.text : [item.text]).map((t) => {
        if (typeof t !== 'string') return t;
        const p = document.createElement('p');
        p.textContent = t;
        return p;
      }),
    );
    foot.replaceChildren(...(item.actions || [button('Anladım', 'primary', () => done(item))]));
    if (item.kind === 'cmd') state.seen[item.id] = 1;
    save();
    box.hidden = false;
    const t = typeof item.target === 'function' ? item.target() : item.target;
    if (item.kind === 'tour' && visible(t)) t.scrollIntoView({ block: 'center' });
    place();
    requestAnimationFrame(place);
    if (item.kind === 'tour') foot.querySelector('.primary')?.focus({ preventScroll: true });
  }
  function hide() {
    current = null;
    box.hidden = true;
  }
  function done(item) {
    state.seen[item.id] = 1;
    save();
    hide();
    const next = queue.shift();
    if (next) setTimeout(() => (state.seen[next.id] ? done(next) : show(next)), 150);
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current && current.kind !== 'tour') done(current);
  });
  /** Bir kez gösterilecek ipucu. */
  function once(id, title, text, target, kind = 'tip') {
    if (!enabled() || state.seen[id]) return;
    show({ id, title, text, target, kind });
  }

  // ------------------------------------------------------------------ tur
  const TOUR = [
    {
      target: () => $('areaTabs'),
      title: 'AğLab’a hoş geldin',
      text: [
        'Üç bölüm var: Müfredat (dersler), Simülatör (cihazlarla pratik) ve Sorun Çöz (arıza bulma).',
        'Bu kısa tur 4 adım. İstediğin an "Turu atla" diyebilirsin.',
      ],
    },
    {
      target: () => document.querySelector('#sfSheet .sf-steps'),
      title: 'Her konu üç adım',
      text: [
        'Öğren: dersi oku. Test: kısa sınav. Pratik: konunun simülatör görevleri.',
        'Konular sırayla ilerler; Konu #1’den başlaman önerilir. "Başka konu seç" listeyi açar.',
      ],
    },
    {
      target: () => document.querySelector('#areaTabs [data-area="lab"]'),
      title: 'Simülatör',
      text: [
        'Pratik adımındaki "Başlat" seni buraya getirir: solda görev ve hedefler, ortada ağ çizimi, altta cihaz terminali.',
        'Cihaza tıkla, terminale komut yaz; hedefler yazdıkça kendiliğinden işaretlenir.',
      ],
    },
    {
      target: () => $('agCoachMenuBtn'),
      title: 'İpuçları',
      text: [
        'Bir şeyle ilk kez karşılaştığında bunun gibi kısa notlar çıkar; her biri bir kez gösterilir.',
        'Bu düğmeden turu yeniden başlatabilir, ipuçlarını kapatabilir ya da sıfırlayabilirsin.',
      ],
    },
  ];
  function startTour(steps = TOUR, id = 'tour', i = 0) {
    if (!enabled()) return;
    if (i === 0) {
      queue.length = 0;
      hide();
    }
    const step = steps[i];
    const last = i === steps.length - 1;
    const finish = () => {
      if (id !== 'tour') state.seen[id] = 1;
      else state.tour = 'done';
      save();
      hide();
      const next = queue.shift();
      if (next) setTimeout(() => show(next), 150);
    };
    const counter = document.createElement('span');
    counter.className = 'ag-coach-count';
    counter.textContent = i + 1 + ' / ' + steps.length;
    show({
      id: id + ':' + i,
      kind: 'tour',
      title: step.title,
      text: step.text,
      target: step.target,
      actions: [
        counter,
        ...(last ? [] : [button('Turu atla', '', finish)]),
        button(last ? 'Bitir' : 'Sonraki', 'primary', () => {
          hide();
          if (last) finish();
          else startTour(steps, id, i + 1);
        }),
      ],
    });
  }

  // Simülatörde ilk görev: çalışma alanının kısa turu.
  const SIM_TOUR = [
    {
      target: () => $('agSimTask'),
      title: 'Görev ve hedefler',
      text: 'Görevin açıklaması ve hedef listesi burada. Hedefler sen komut yazdıkça yeşile döner.',
    },
    {
      target: () => $('ptCanvas'),
      title: 'Ağ çizimi',
      text: 'Bir cihaza tıklayınca terminal o cihaza geçer ve sağdaki panelde port bilgisi görünür.',
    },
    {
      target: () => $('ptCliInput'),
      title: 'Terminal',
      text: 'Komutları buraya yaz, Enter’a bas. Altındaki satır hangi kipte olduğunu söyler. ? yazınca o anda yazılabilecekler listelenir, Tab komutu tamamlar.',
    },
    {
      target: () => $('agSimActions'),
      title: 'İpucu ve Kontrol et',
      text: 'Takılırsan İpucu: önce neye bakacağını, sonra kavramı, en son komutu söyler. Kontrol et sonucu değerlendirir; birkaç denemeden sonra "Çözümü göster" açılır.',
    },
  ];

  // ------------------------------------------------------------------ kip rehberi
  const modeLine = document.createElement('div');
  modeLine.className = 'ag-coach-mode';
  modeLine.id = 'agCoachMode';
  modeLine.setAttribute('aria-live', 'polite');
  modeLine.hidden = true;
  function deviceKind() {
    const o = $('ptCliDevice')?.selectedOptions?.[0];
    const m = / · (PC|Server|Router|Switch)$/.exec(o?.textContent || '');
    return m ? m[1] : '';
  }
  const MODES = [
    [
      /\(config\)#$/,
      'Genel ayar kipi',
      'Cihaz geneli ayarlar: hostname, vlan, ip route… interface ile bir porta geç.',
      'end → ayrıcalıklı kip',
    ],
    [
      /\(config-if-range\)#$/,
      'Arayüz aralığı kipi',
      'Komutlar seçili bütün portlara birlikte uygulanır.',
      'exit → genel ayar, end → #',
    ],
    [
      /\(config-if\)#$/,
      'Arayüz kipi',
      'Komutlar yalnız seçili porta uygulanır: no shutdown, switchport…, ip address.',
      'exit → genel ayar, end → #',
    ],
    [
      /\(config-subif\)#$/,
      'Alt arayüz kipi',
      'Bir VLAN’ın alt arayüzü: önce encapsulation dot1Q, sonra ip address.',
      'exit → genel ayar, end → #',
    ],
    [/\(config-vlan\)#$/, 'VLAN kipi', 'VLAN’a ad ver: name SATIS.', 'exit → genel ayar, end → #'],
    [
      /\(config-router\)#$/,
      'Yönlendirme protokolü kipi',
      'network, router-id, passive-interface gibi protokol ayarları.',
      'exit → genel ayar, end → #',
    ],
    [
      /\(dhcp-config\)#$/,
      'DHCP havuzu kipi',
      'network, default-router, dns-server ile havuzu tanımla.',
      'exit → genel ayar, end → #',
    ],
    [
      /\(config-[a-z-]+\)#$/,
      'Alt ayar kipi',
      'Bir ayar bloğunun içindesin.',
      'exit → bir üst kip, end → #',
    ],
    [
      /#$/,
      'Ayrıcalıklı kip',
      'Bütün show komutları, kaydetme (copy running-config startup-config), configure terminal ile ayara geçiş.',
      'disable → kullanıcı kipi',
    ],
    [
      />$/,
      'Kullanıcı kipi',
      'Yalnız sınırlı bakma komutları. Ayar yapmak ve her şeyi görmek için yukarı çık.',
      'enable → ayrıcalıklı kip (#)',
    ],
  ];
  function updateMode() {
    const form = $('ptCliForm');
    if (!enabled() || !form) {
      modeLine.hidden = true;
      return;
    }
    if (!modeLine.isConnected) form.after(modeLine);
    const prompt = ($('ptPrompt')?.textContent || '').trim();
    const kind = deviceKind();
    let parts;
    if (!prompt || /konsol yok/.test(prompt))
      parts = ['Konsol yok', 'Cihaz kapalı ya da seçili değil.', ''];
    else if (kind === 'PC' || kind === 'Server')
      parts = [
        kind === 'Server' ? 'Sunucu terminali' : 'PC terminali',
        'Basit komutlar: show ip, ping, ip dhcp, nslookup' +
          (kind === 'Server' ? ', show services.' : ', trace.'),
        'help → bütün komutlar',
      ];
    else {
      const m = MODES.find(([re]) => re.test(prompt));
      parts = m ? m.slice(1) : ['', '', ''];
    }
    modeLine.dataset.mode = parts[0];
    modeLine.replaceChildren();
    if (!parts[0]) {
      modeLine.hidden = true;
      return;
    }
    const b = document.createElement('b');
    b.textContent = parts[0] + ': ';
    const t = document.createElement('span');
    t.textContent = parts[1];
    modeLine.append(b, t);
    if (parts[2]) {
      const k = document.createElement('kbd');
      k.textContent = parts[2];
      modeLine.append(' ', k);
    }
    modeLine.hidden = false;
  }

  // ------------------------------------------------------------------ komut sözlüğü
  // [sözcükler, açıklama]: yazılan her sözcük kalıptaki sözcüğün başı olmalı (IOS kısaltması:
  // "sh ip int br" = show ip interface brief). En uzun eşleşen kalıp kazanır.
  const IOS = [
    [
      'enable',
      'Ayrıcalıklı kipe geçer (istem # olur): bütün show komutları ve ayara geçiş buradan.',
    ],
    ['disable', 'Kullanıcı kipine (>) döner.'],
    [
      'configure terminal',
      'Ayar kipine girer. Buradan yazılan her şey çalışan yapılandırmayı (running-config) hemen değiştirir.',
    ],
    ['end', 'Hangi ayar kipinde olursan ol ayrıcalıklı kipe (#) döner.'],
    ['exit', 'Bir üst kipe çıkar: arayüz → genel ayar → ayrıcalıklı.'],
    ['interface range', 'Birden çok portu birlikte ayarlar (ör. interface range fa0/1 - 4).'],
    [
      'interface',
      'Bir arayüzün ayarına girer (ör. interface fa0/1); sonraki komutlar yalnız o porta uygulanır.',
    ],
    ['no shutdown', 'Arayüzü açar. Kablo ve karşı uç sağlamsa durum connected (up/up) olur.'],
    [
      'shutdown',
      'Arayüzü yönetimsel olarak kapatır; durum tablosunda disabled görünür, trafik geçmez.',
    ],
    ['hostname', 'Cihaza ad verir; istem hemen değişir.'],
    [
      'description',
      'Porta açıklama yazar; show interfaces status’un Name sütununda görünür, trafiği etkilemez.',
    ],
    ['ip address', 'Arayüze IP adresi ve maske verir (router portu, alt arayüz ya da SVI).'],
    ['ip route', 'Statik rota ekler: hedef ağ, maske ve paketin gönderileceği sonraki atlama.'],
    [
      'ip default-gateway',
      'L2 switch’in kendi yönetim trafiği için ağ geçidi (kullanıcı trafiğini etkilemez).',
    ],
    [
      'ip dhcp excluded-address',
      'Havuzun dağıtmayacağı adresler (ağ geçidi, yazıcı gibi sabit adresler). Havuzdan önce yazılır.',
    ],
    ['ip dhcp pool', 'DHCP havuzu açar; network, default-router ve dns-server ile doldurulur.'],
    ['ip helper-address', 'Bu arayüze gelen DHCP yayınını başka ağdaki sunucuya iletir (relay).'],
    ['default-router', 'Havuzun istemcilere vereceği ağ geçidi.'],
    ['dns-server', 'Havuzun istemcilere vereceği DNS sunucusu.'],
    [
      'switchport mode access',
      'Portu tek VLAN taşıyan erişim portu yapar (PC, yazıcı gibi uç cihazlar için).',
    ],
    [
      'switchport mode trunk',
      'Portu birden çok VLAN’ı etiketli taşıyan trunk yapar (switch–switch, switch–router).',
    ],
    ['switchport access vlan', 'Erişim portunu bir VLAN’a atar.'],
    ['switchport trunk allowed vlan', 'Trunk’ın taşıyacağı VLAN’ları sınırlar.'],
    ['switchport trunk native vlan', 'Trunk’ta etiketsiz giden VLAN; iki uçta aynı olmalı.'],
    ['vlan', 'VLAN oluşturur ve VLAN kipine girer; name ile adlandırılır.'],
    ['name', 'Bulunduğun VLAN’a (ya da bloğa) ad verir.'],
    [
      'encapsulation dot1q',
      'Alt arayüzün hangi VLAN etiketini dinleyeceğini söyler; ip address’ten önce yazılır.',
    ],
    [
      'copy running-config startup-config',
      'Çalışan yapılandırmayı kalıcı belleğe kaydeder; yeniden başlatınca kaybolmaz.',
    ],
    [
      'write memory',
      'Çalışan yapılandırmayı kaydeder (copy running-config startup-config ile aynı).',
    ],
    ['reload', 'Cihazı yeniden başlatır; kaydedilmemiş değişiklikler kaybolur.'],
    ['cdp run', 'CDP’yi cihaz genelinde açar (Cisco varsayılanı açık).'],
    ['no cdp enable', 'Bu portta CDP’yi kapatır: komşuya cihaz bilgisi gönderilmez.'],
    ['lldp run', 'Standart komşu keşfi LLDP’yi açar (IOS’ta varsayılan kapalı).'],
    ['router ospf', 'OSPF sürecini başlatır ve ayarına girer.'],
    ['show running-config', 'Cihazın şu an çalışan yapılandırması.'],
    [
      'show startup-config',
      'Kaydedilmiş yapılandırma; running-config’ten farkı kaydedilmemiş değişikliklerdir.',
    ],
    [
      'show ip interface brief',
      'Arayüzler, adresleri ve durumu tek tabloda: Status (fiziksel/yönetimsel) ve Protocol.',
    ],
    [
      'show interfaces status',
      'Switch portlarının durumu: connected / notconnect / disabled, VLAN ve Name (açıklama).',
    ],
    ['show interfaces trunk', 'Trunk portlar, native VLAN ve trunk’ın taşıdığı VLAN’lar.'],
    [
      'show interfaces',
      'Bir arayüzün ayrıntılı durumu: ilk satır up/down, sonra adres ve sayaçlar.',
    ],
    ['show vlan brief', 'Switch’teki VLAN’lar ve her VLAN’a atanmış erişim portları.'],
    [
      'show mac address-table',
      'Switch’in öğrendiği MAC adresleri: hangi MAC hangi portta, hangi VLAN’da.',
    ],
    [
      'show ip route',
      'Yönlendirme tablosu: C bağlı, S statik, O OSPF… Paket en uzun eşleşen rotaya gider.',
    ],
    ['show arp', 'IP → MAC eşlemeleri: cihazın aynı ağda konuştuğu komşular.'],
    [
      'show cdp neighbors',
      'Doğrudan bağlı Cisco cihazları: hangi portundan, karşının hangi portuna.',
    ],
    ['show lldp neighbors', 'LLDP komşuları; iki uçta da LLDP açık olmalı.'],
    ['show ip dhcp binding', 'DHCP sunucusunun dağıttığı adresler ve istemci MAC’leri.'],
    ['show ip dhcp pool', 'Havuzların kullanım durumu.'],
    ['show spanning-tree', 'STP: kök köprü, portların rolü ve durumu (FWD/BLK).'],
    ['show etherchannel summary', 'EtherChannel grupları ve üye portların bayrakları.'],
    ['show standby', 'HSRP: hangi router Active, hangisi Standby.'],
    ['show ip ospf neighbor', 'OSPF komşuları ve durumları (FULL olmalı).'],
    ['show access-lists', 'ACL’ler ve her satırın eşleşme sayısı.'],
    ['show ip nat translations', 'NAT/PAT çeviri tablosu.'],
    ['show version', 'Cihaz modeli, yazılım sürümü ve çalışma süresi.'],
    [
      'ping',
      'ICMP yankı isteği gönderir. ! başarılı, . zaman aşımı; ilk paket ARP yüzünden kaybolabilir.',
    ],
    ['traceroute', 'Paketin geçtiği router’ları sırayla gösterir; durduğu yer sorunun yeridir.'],
  ];
  const PC = [
    ['show ip', 'PC’nin adresi, maskesi, ağ geçidi ve DNS sunucusu.'],
    ['show arp', 'PC’nin bildiği IP → MAC eşlemeleri.'],
    ['show services', 'Sunucuda çalışan servisler (DHCP, DNS, HTTP).'],
    [
      'ip dhcp',
      'Adresi DHCP’den ister. "DDORA" dört mesajın tamamlandığını, 169.254 sunucu bulunamadığını gösterir.',
    ],
    ['ip dns', 'PC’nin soracağı DNS sunucusunu elle ayarlar.'],
    ['ip', 'PC’ye elle adres verir: ip ADRES/ÖNEK AĞ_GEÇİDİ (ör. ip 192.168.1.10/24 192.168.1.1).'],
    ['ping', 'Hedefe yankı isteği gönderir; yanıt gelirse iki yön de çalışıyordur.'],
    ['trace', 'Paketin geçtiği router’ları sırayla gösterir.'],
    [
      'nslookup',
      'Bir adı DNS sunucusuna sorar: yanıt, "Non-existent domain" ya da "timed out" ayrı sorunlardır.',
    ],
    ['curl', 'Bir web sunucusundan sayfa ister (HTTP, TCP 80).'],
  ];
  const compile = (list) =>
    list
      .map(([p, t]) => ({ words: p.split(' '), text: t, key: p }))
      .sort((a, b) => b.words.length - a.words.length);
  const IOS_C = compile(IOS),
    PC_C = compile(PC);
  function explain(line, kind) {
    let words = line.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length || words[words.length - 1].endsWith('?')) return null;
    if (words[0] === 'do' && words.length > 1) words = words.slice(1);
    const list = kind === 'PC' || kind === 'Server' ? PC_C : IOS_C;
    return (
      list.find(
        (c) =>
          words.length >= c.words.length &&
          c.words.every(
            (w, i) => w.startsWith(words[i]) && (i > 0 || words[i].length > 1 || w === words[i]),
          ),
      ) || null
    );
  }

  // ------------------------------------------------------------------ olaylar
  function onCommand(line) {
    if (!enabled()) return;
    const kind = deviceKind();
    const hit = explain(line, kind);
    if (!hit) return;
    const id = 'cmd:' + (kind === 'PC' || kind === 'Server' ? 'pc:' : 'ios:') + hit.key;
    if (state.seen[id]) return;
    const code = document.createElement('p');
    const c = document.createElement('code');
    c.textContent = hit.key;
    code.append(c);
    show({
      id,
      kind: 'cmd',
      title: 'Bu komut ne yapar?',
      text: [code, hit.text],
      target: () => $('ptCliInput'),
    });
  }
  document.addEventListener(
    'submit',
    (e) => {
      if (e.target?.id === 'ptCliForm') onCommand($('ptCliInput')?.value || '');
    },
    true,
  );
  document.addEventListener(
    'click',
    (e) => {
      const b = e.target?.closest?.('button');
      if (!b || !enabled()) return;
      if (b.dataset.ptCmd) onCommand(b.dataset.ptCmd);
      const id = b.id;
      if (id === 'labberLabCheck' || id === 'academyCheck' || id === 'agSimSharedCheck')
        setTimeout(
          () =>
            once(
              'tip:check',
              'Kontrol et',
              'Sonuç hedef listesinde: yeşil hedefler sağlandı. Eksik kalan hedefe bak, düzelt ve yeniden dene. Birkaç başarısız denemeden sonra "Çözümü göster" açılır.',
              () => $('agSimGoals'),
            ),
          300,
        );
      if (/^(agSimLabberHint|agSimSharedHint|academyHint)$/.test(id))
        setTimeout(
          () =>
            once(
              'tip:hint',
              'İpuçları kademeli',
              'Her hedefin üç ipucu var: önce neye bakacağın, sonra arkasındaki kavram, en son komut. Bütün ipuçları kullanılınca "Çözümü göster" açılır.',
              () => $('agSimHintBox'),
            ),
          300,
        );
    },
    true,
  );
  // Terminal çıktısı: ilk hata türleri ve ilk 169.254.
  const OUT_TIPS = [
    [
      /% Invalid input/,
      'tip:invalid',
      'Komut tanınmadı',
      '^ işareti hatanın başladığı yeri gösterir. Yanlış kipte olabilirsin (alttaki satıra bak) ya da yazım hatası olabilir. Sonuna ? ekleyince o anda yazılabilecekler listelenir.',
    ],
    [
      /% Incomplete command/,
      'tip:incomplete',
      'Komut eksik',
      'Komutun devamı gerekiyor. Sonuna boşluk ve ? yazınca beklenen sözcükler listelenir.',
    ],
    [
      /% Ambiguous command/,
      'tip:ambiguous',
      'Kısaltma belirsiz',
      'Yazdığın kısaltma birden çok komuta uyuyor; bir iki harf daha yaz.',
    ],
    [
      /169\.254\.\d+\.\d+/,
      'tip:apipa',
      '169.254 ile başlayan adres',
      'PC DHCP sunucusu bulamadı ve kendine geçici adres verdi. Bu adresle ağ geçidine ulaşılmaz: sorun DHCP’de (havuz, relay ya da yol).',
    ],
    [
      /Success rate is 0 percent|host \(.*\) not reachable|timeout/i,
      'tip:pingfail',
      'Ping başarısız',
      'Katman katman ilerle: önce kendi ağ geçidine ping at. Yanıt varsa sorun ötede, yoksa PC ile ağ geçidi arasında (port, VLAN, adres).',
    ],
    [
      /% Unrecognized host|Non-existent domain/,
      'tip:nxdomain',
      'Ad bulunamadı',
      'DNS sunucusu yanıt verdi ama bu ad yok. Sorun ağda değil, yazılan adda ya da kayıtta.',
    ],
  ];
  function watchTerminal() {
    const term = $('ptTerminal');
    if (!term) return;
    new MutationObserver((recs) => {
      if (!enabled()) return;
      for (const r of recs)
        for (const n of r.addedNodes) {
          const text = n.textContent || '';
          for (const [re, id, title, tip] of OUT_TIPS)
            if (re.test(text)) once(id, title, tip, () => $('ptCliInput'));
        }
    }).observe(term, { childList: true });
    const prompt = $('ptPrompt');
    if (prompt)
      new MutationObserver(updateMode).observe(prompt, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    $('ptCliDevice')?.addEventListener('change', updateMode);
  }
  // Görev başlatıldı: Simülatör başlığı "Serbest çalışma"dan çıkınca çalışma alanı turu.
  function watchTask() {
    const t = $('agSimTitle');
    if (!t) return false;
    new MutationObserver(() => {
      if (!enabled() || /Serbest çalışma/.test(t.textContent) || state.seen['tour:sim']) return;
      setTimeout(() => {
        if (visible($('agSimTask')) && !state.seen['tour:sim']) startTour(SIM_TOUR, 'tour:sim');
      }, 500);
    }).observe(t, { childList: true, characterData: true, subtree: true });
    return true;
  }

  // ------------------------------------------------------------------ 💡 menüsü
  function menu() {
    const tools = $('agTopTools');
    if (!tools || !available) return;
    const wrap = document.createElement('div');
    wrap.className = 'ag-coach-menu';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'agCoachMenuBtn';
    btn.className = 'aglab-theme-toggle ag-coach-menu-btn';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Eğitici ipuçları');
    btn.title = 'Eğitici ipuçları';
    btn.textContent = '💡';
    const list = document.createElement('div');
    list.className = 'ag-coach-menu-list';
    list.id = 'agCoachMenu';
    list.setAttribute('role', 'menu');
    list.hidden = true;
    const item = (id, text, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.id = id;
      b.setAttribute('role', 'menuitem');
      b.textContent = text;
      b.addEventListener('click', () => {
        list.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
        fn();
      });
      return b;
    };
    const toggle = item('agCoachToggle', '', () => setEnabled(state.off));
    const label = () =>
      (toggle.textContent = state.off ? 'Eğitici ipuçlarını aç' : 'Eğitici ipuçlarını kapat');
    list.append(
      toggle,
      item('agCoachTour', 'Turu yeniden başlat', () => {
        if (state.off) setEnabled(true);
        state.tour = '';
        save();
        startTour();
      }),
      item('agCoachReset', 'Gösterilen ipuçlarını sıfırla', reset),
    );
    btn.addEventListener('click', () => {
      label();
      list.hidden = !list.hidden;
      btn.setAttribute('aria-expanded', String(!list.hidden));
    });
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) {
        list.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
      }
    });
    wrap.append(btn, list);
    tools.prepend(wrap);
    label();
  }
  function setEnabled(on) {
    state.off = !on;
    save();
    if (!on) {
      queue.length = 0;
      hide();
    }
    updateMode();
  }
  function reset() {
    state = { off: false, seen: {}, tour: '' };
    save();
    queue.length = 0;
    hide();
    updateMode();
  }

  function init() {
    menu();
    watchTerminal();
    if (!watchTask()) setTimeout(watchTask, 1000);
    updateMode();
    if (enabled() && !state.tour)
      setTimeout(() => {
        if (enabled() && !state.tour) startTour();
      }, 700);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.aglabCoach = Object.freeze({
    available: () => available,
    enabled,
    setEnabled,
    reset,
    startTour: () => startTour(),
    seen: () => ({ ...state.seen, ...(state.tour ? { tour: state.tour } : {}) }),
    current: () => (current ? current.id : null),
    explain: (line, kind = 'Switch') => explain(line, kind)?.key || null,
    modeLine: () => (modeLine.hidden ? '' : modeLine.textContent),
  });
})();
