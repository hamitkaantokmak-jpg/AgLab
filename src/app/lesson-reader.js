// Ders okuyucu: docs/dersler/*.md derste olduğu gibi, şemalarıyla gösterilir (tek kaynak).
// Veri build sırasında #sfLessonData'ya gömülür: {konu: {md, figs: {yol: svg}}}. Metin her zaman
// kaçışlanır; yalnız derleme sırasında repodan gömülen şemalar (bizim SVG dosyalarımız) olduğu gibi
// eklenir. Desteklenen Markdown alt kümesi: başlık, paragraf, kalın/italik/kod, bağlantı (yalnız
// http/https), madde ve numaralı liste (iki düzey), tablo, kod bloğu, alıntı kutusu (ilk kalın
// kelimesine göre renk: Dikkat, Benzetme, Akılda kalsın, Sahada), <details> bloğu, şema satırı
// `![Başlık](gorseller/konu/g1.svg)`, yatay çizgi.
(() => {
  'use strict';
  const node = document.getElementById('sfLessonData');
  let data = {};
  try {
    data = node ? JSON.parse(node.textContent) : {};
  } catch (e) {
    data = {};
  }
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  function inline(s) {
    // Önce kod parçaları ayrılır; içleri biçimlenmez.
    const parts = String(s).split(/(`[^`]+`)/);
    return parts
      .map((p) => {
        if (/^`[^`]+`$/.test(p)) return '<code>' + esc(p.slice(1, -1)) + '</code>';
        let h = esc(p);
        h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        h = h.replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)/g, '$1<em>$2</em>');
        h = h.replace(
          /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
          (m, t, u) =>
            '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + t + '</a>',
        );
        // Ders içi bağlantılar (başka belge ya da dosya) yazı olarak kalır.
        h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
        return h;
      })
      .join('');
  }
  const CALLOUT = [
    [/^(dikkat|uyarı)/i, 'warn'],
    [/^(benzetme|günlük hayattan|gündelik)/i, 'analogy'],
    [/^(akılda kalsın|unutma|özet)/i, 'key'],
    [/^(sahada|gerçek hayatta)/i, 'field'],
    [/^(simülatörde yok|okuma)/i, 'muted'],
  ];
  function calloutClass(first) {
    const m = /^\s*\*\*([^*]+)\*\*/.exec(first);
    if (!m) return '';
    for (const [re, c] of CALLOUT) if (re.test(m[1])) return ' lr-' + c;
    return '';
  }
  function table(rows) {
    const cells = (r) =>
      r
        .trim()
        .replace(/^\||\|$/g, '')
        .split(/(?<!\\)\|/)
        .map((c) => c.trim().replace(/\\\|/g, '|'));
    const head = cells(rows[0]);
    const body = rows.slice(2).map(cells);
    return (
      '<div class="lr-table"><table><thead><tr>' +
      head.map((c) => '<th>' + inline(c) + '</th>').join('') +
      '</tr></thead><tbody>' +
      body
        .map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>')
        .join('') +
      '</tbody></table></div>'
    );
  }
  function list(lines) {
    // lines: [{indent, ordered, text}]
    let html = '';
    const stack = [];
    for (const it of lines) {
      while (stack.length && stack[stack.length - 1].indent > it.indent) {
        html += '</li></' + stack.pop().tag + '>';
      }
      const top = stack[stack.length - 1];
      if (!top || it.indent > top.indent) {
        const tag = it.ordered ? 'ol' : 'ul';
        stack.push({ indent: it.indent, tag });
        html += '<' + tag + '>';
      } else html += '</li>';
      html += '<li>' + inline(it.text) + (it.extra || '');
    }
    while (stack.length) html += '</li></' + stack.pop().tag + '>';
    return html;
  }
  function render(md, figs, ctx = {}) {
    const lines = String(md).replace(/\r/g, '').split('\n');
    let html = '',
      i = 0,
      para = [];
    const flush = () => {
      if (para.length) html += '<p>' + inline(para.join(' ')) + '</p>';
      para = [];
    };
    while (i < lines.length) {
      const line = lines[i];
      let m;
      if (/^```/.test(line)) {
        flush();
        const buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        i++;
        html += '<pre class="lr-code"><code>' + esc(buf.join('\n')) + '</code></pre>';
        continue;
      }
      if ((m = /^\s*!\[([^\]]*)\]\((gorseller\/[\w./-]+\.svg)\)\s*$/.exec(line))) {
        flush();
        const svg = figs?.[m[2]];
        html +=
          '<figure class="lr-fig">' +
          (svg || '<div class="lr-missing">Şema bulunamadı: ' + esc(m[2]) + '</div>') +
          '<figcaption>' +
          inline(m[1]) +
          '</figcaption></figure>';
        i++;
        continue;
      }
      if ((m = /^<details>\s*<summary>(.*?)<\/summary>\s*$/.exec(line.trim()))) {
        flush();
        const buf = [];
        i++;
        let depth = 1;
        while (i < lines.length) {
          if (/^<details>/.test(lines[i].trim())) depth++;
          if (/^<\/details>/.test(lines[i].trim()) && --depth === 0) break;
          buf.push(lines[i++]);
        }
        i++;
        html +=
          '<details class="lr-details"><summary>' +
          inline(m[1].replace(/<\/?[^>]+>/g, '')) +
          '</summary>' +
          render(buf.join('\n'), figs, ctx) +
          '</details>';
        continue;
      }
      if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) {
        flush();
        const level = Math.min(6, m[1].length + 1);
        const text = m[2].trim();
        const id = (ctx.prefix || 'lr') + '-' + ++ctx.n;
        if (level === 3) ctx.toc?.push({ id, text });
        html += '<h' + level + ' id="' + id + '">' + inline(text) + '</h' + level + '>';
        i++;
        continue;
      }
      if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
        flush();
        html += '<hr>';
        i++;
        continue;
      }
      if (/^\s*\|/.test(line) && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] || '')) {
        flush();
        const buf = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) buf.push(lines[i++]);
        html += table(buf);
        continue;
      }
      if (/^\s*>/.test(line)) {
        flush();
        const buf = [];
        while (i < lines.length && /^\s*>/.test(lines[i]))
          buf.push(lines[i++].replace(/^\s*>\s?/, ''));
        html +=
          '<blockquote class="lr-callout' +
          calloutClass(buf[0] || '') +
          '">' +
          render(buf.join('\n'), figs, ctx) +
          '</blockquote>';
        continue;
      }
      if (/^\s*([-*]|\d+[.)])\s+/.test(line)) {
        flush();
        const items = [];
        while (i < lines.length) {
          const l = lines[i];
          const lm = /^(\s*)([-*]|\d+[.)])\s+(.*)$/.exec(l);
          if (lm) {
            items.push({ indent: lm[1].length, ordered: /\d/.test(lm[2]), text: lm[3], extra: '' });
            i++;
          } else if (/^\s+```/.test(l) && items.length) {
            // Madde içindeki kod bloğu
            const buf = [];
            const pad = /^\s*/.exec(l)[0].length;
            i++;
            while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++].slice(pad));
            i++;
            items[items.length - 1].extra +=
              '<pre class="lr-code"><code>' + esc(buf.join('\n')) + '</code></pre>';
          } else if (/^\s{2,}\S/.test(l) && items.length) {
            const last = items[items.length - 1];
            // Kod bloğundan sonra gelen devam satırı kodun altında kalır.
            if (last.extra) last.extra += '<p>' + inline(l.trim()) + '</p>';
            else last.text += ' ' + l.trim();
            i++;
          } else break;
        }
        html += list(items);
        continue;
      }
      if (!line.trim()) {
        flush();
        i++;
        continue;
      }
      para.push(line.trim());
      i++;
    }
    flush();
    return html;
  }
  // Belge başlığı (# ...) ve belgenin yazara dönük giriş notu (> Uygulamadaki ...) öğrenciye gösterilmez;
  // "Doğrulama notları" bölümü kapalı açılır kutu olur.
  function prepare(md) {
    let s = String(md).replace(/^# .*\n+/, '');
    s = s.replace(/^(> .*\n)+\n*/, '');
    const parts = s.split(/^(?=## )/m);
    return parts
      .map((p) =>
        /^## \d+\.\s*Doğrulama notları/.test(p)
          ? '<details><summary>Kaynaklar ve doğrulama notları</summary>\n' +
            p.replace(/^## .*\n/, '') +
            '\n</details>\n'
          : p,
      )
      .join('');
  }
  function show(container, key) {
    const item = data[key];
    if (!item) return false;
    const toc = [];
    const body = render(prepare(item.md), item.figs, { prefix: 'lr-' + key, n: 0, toc });
    const nav = toc.length
      ? '<nav class="lr-toc" aria-label="Ders bölümleri">' +
        toc
          .map(
            (t) => '<a href="#' + t.id + '" data-lr-jump="' + t.id + '">' + inline(t.text) + '</a>',
          )
          .join('') +
        '</nav>'
      : '';
    const wrap = document.createElement('div');
    wrap.className = 'lr';
    wrap.innerHTML = nav + body;
    // Bölüm bağlantıları adres çubuğunu değiştirmez (bölüm geçişlerini tetiklemez).
    wrap.addEventListener('click', (e) => {
      const a = e.target.closest('[data-lr-jump]');
      if (!a) return;
      e.preventDefault();
      document
        .getElementById(a.dataset.lrJump)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    container.append(wrap);
    return true;
  }
  window.aglabLessonReader = {
    has: (key) => !!data[key],
    show,
    keys: () => Object.keys(data),
    _render: render,
  };
})();
