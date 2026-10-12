/* 共用看图界面 —— Gallery 和 Series 都用这一份。

     var viewer = Lightbox.init(items);
     viewer.open(3);

   items 是 gallery-data.js / series-data.js 里的对象数组。

   三个控件（左右箭头、关闭）用的是 SVG 而不是 × ‹ › 这些字符。原因是字符
   的居中靠不住：浏览器居中的是**行盒**，而字形在行盒里的位置由字体度量决定。
   实测 Raleway 里 × 的墨迹中心比大写字母低 1.8px、‹ › 低 2.45px，
   而且 × 的墨迹只有大写字母一半高——看上去就是又小又偏下。
   画成 SVG 就没有这层间接，形状自己说了算。
   覆盖层的 HTML 由本文件注入，页面里不需要写。 */

window.Lightbox = (function () {
  'use strict';

  var esc = window.Util.esc;

  /* ---------- 覆盖层结构 ------------------------------------------------
     ✏️ 四个图标就在这里，改一处全站生效（以前 gallery.html 和 set.html
     各有一份，改一处忘一处是迟早的事）。24 格网、1.7 描边、圆角端点。 */
  var MARKUP =
    '<div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Photograph viewer">' +
      /* 左右箭头挂在覆盖层上，不在 .lb-frame 里：锚到照片的话，横图换竖图
         时照片宽度变了，按钮就会左右横跳。位置由 fit() 按「最宽的照片」
         算出来，和当前这张是横是竖无关。 */
      '<button class="lb-btn lb-prev" id="lbPrev" aria-label="Previous">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.25 5.6 8.75 12l6.5 6.4"/></svg>' +
      '</button>' +
      '<button class="lb-btn lb-next" id="lbNext" aria-label="Next">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.75 5.6 15.25 12l-6.5 6.4"/></svg>' +
      '</button>' +
      '<div class="lightbox-stage">' +
        '<figure class="lb-figure">' +
          '<div class="lb-frame">' +
            '<span class="lb-count" id="lbCount"></span>' +
            '<button class="lb-btn lb-close" id="lbClose" aria-label="Close">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.8 6.8 17.2 17.2M17.2 6.8 6.8 17.2"/></svg>' +
            '</button>' +
            '<img id="lbImage" alt="">' +
          '</div>' +
          '<figcaption class="lightbox-bar">' +

            '<p class="lb-line" id="lbPlaceRow">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                '<path d="M12 21.3c4.6-4.3 7-7.7 7-10.6a7 7 0 1 0-14 0c0 2.9 2.4 6.3 7 10.6Z"/>' +
                '<circle class="dot" cx="12" cy="10.4" r="2"/>' +
              '</svg><span id="lbPlace"></span>' +
            '</p>' +

            '<p class="lb-line lb-line--nums" id="lbWhenRow">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                '<rect x="3.2" y="5.2" width="17.6" height="15.6" rx="2.6"/>' +
                '<path d="M3.2 9.9h17.6M8.2 3v4.2M15.8 3v4.2"/>' +
              '</svg><span id="lbWhen"></span>' +
            '</p>' +

            '<p class="lb-line" id="lbCameraRow">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                '<rect x="2.4" y="6.6" width="19.2" height="13.4" rx="2.6"/>' +
                '<path d="M8.6 6.6 10 4.1h4l1.4 2.5"/>' +
                '<circle cx="12" cy="13.3" r="3.4"/>' +
              '</svg><span id="lbCamera"></span>' +
            '</p>' +

            '<p class="lb-line lb-line--nums" id="lbSettingsRow">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                '<circle cx="12" cy="12" r="9.6"/>' +
                '<path d="M14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94' +
                        'M9.69 16 3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94"/>' +
              '</svg><span class="lb-exposure" id="lbSettings"></span>' +
            '</p>' +

          '</figcaption>' +
        '</figure>' +
      '</div>' +
    '</div>';

  function init(initialItems) {
    if (!initialItems || !initialItems.length) return null;
    var items = initialItems;

    var box = document.getElementById('lightbox');
    if (!box) {
      document.body.insertAdjacentHTML('beforeend', MARKUP);
      box = document.getElementById('lightbox');
    }

    var img     = document.getElementById('lbImage');
    var countEl = document.getElementById('lbCount');
    var stage   = box.querySelector('.lightbox-stage');
    var figure  = box.querySelector('.lb-figure');
    var caption = box.querySelector('.lightbox-bar');
    var closeBtn = document.getElementById('lbClose');
    var prevBtn  = document.getElementById('lbPrev');
    var nextBtn  = document.getElementById('lbNext');

    // caption rows: [row element, span to fill, field name, keep when empty?]
    // 地点行即使为空也保留：四行高度对所有照片一致，翻页时画框才不会跳。
    var rows = [
      [document.getElementById('lbPlaceRow'),    document.getElementById('lbPlace'),    'place',    true],
      [document.getElementById('lbWhenRow'),     document.getElementById('lbWhen'),     'when',     false],
      [document.getElementById('lbCameraRow'),   document.getElementById('lbCamera'),   'camera',   false],
      [document.getElementById('lbSettingsRow'), document.getElementById('lbSettings'), 'settings', false]
    ];

    /* 曝光参数：75mm F5.6 S1/500 ISO100
       标签和数值之间不留空格，组与组之间才留 —— 那个间距由 CSS 的
       word-spacing 拉宽，所以整行就是一段纯文本，不用拼 HTML。 */
    function exposureText(it) {
      var out = [];
      if (it.focal)    out.push(it.focal);
      if (it.aperture) out.push('F' + it.aperture);
      if (it.shutter)  out.push('S' + it.shutter);
      if (it.iso)      out.push('ISO' + it.iso);
      return out.join(' ');
    }

    var current = 0;
    var token   = 0;          // 防止快速翻页时先发后到的请求覆盖当前图
    var lastFocused = null;

    /* 换一组照片（比如 Gallery 切了分类）。必须走这里而不是重新 init：
       init 会注册 document 级的键盘监听和 ResizeObserver，反复调用会叠加。 */
    function setItems(next) {
      if (!next || !next.length) return;
      items = next;
      current = 0;
      token++;                                  // 作废还在飞的加载
      box.classList.toggle('is-single', items.length < 2);
    }

    box.classList.toggle('is-single', items.length < 2);

    function fullSrc(it) {
      // 手机上按显示宽度选尺寸，避免一次解码三张 2400px 大图。
      var width = window.innerWidth || document.documentElement.clientWidth;
      var target = width <= 640 ? width * Math.min(window.devicePixelRatio || 1, 3) : Infinity;
      var size = it.sizes.find(function (size) { return size >= target; }) || it.sizes[it.sizes.length - 1];
      return it.base + '-' + size + '.jpg';
    }
    function thumbSrc(it) { return it.base + '-' + it.sizes[0] + '.jpg'; }

    /* 用像素把 <img> 的盒子调成照片本身的大小。
       交给 CSS 做不行：缩略图和全尺寸图必须占同一个盒子（否则加载完会跳），
       而且要给下面的参数行留出高度。 */
    function fit() {
      var it = items[current];
      if (!it) return;

      // 量 .lightbox 而不是 stage。stage 是 grid，列宽由内容撑开，而 figure
      // 的宽度又是上一次 fit() 写死的——拿它回灌，窗口缩小时照片就再也收不回来。
      // .lightbox 是 fixed + inset:0，盒子恒等于视口。
      var scs = getComputedStyle(stage);
      var frame = box.getBoundingClientRect();
      var frameW = frame.width || window.innerWidth;
      var frameH = frame.height || window.innerHeight;
      var availW = frameW - parseFloat(scs.paddingLeft) - parseFloat(scs.paddingRight);
      var availH = frameH - parseFloat(scs.paddingTop) - parseFloat(scs.paddingBottom);

      var fcs = getComputedStyle(figure);
      var reserved = caption.offsetHeight + (parseFloat(fcs.rowGap) || 0);

      var scale = parseFloat(getComputedStyle(box).getPropertyValue('--lb-scale')) || 1;
      var maxW = availW * scale;
      var maxH = Math.max(1, Math.min(availH * scale, availH - reserved));

      var ar = it.w / it.h;
      var w = maxW, h = w / ar;
      if (h > maxH) { h = maxH; w = h * ar; }

      img.style.width  = Math.max(0, Math.round(w)) + 'px';
      img.style.height = Math.max(0, Math.round(h)) + 'px';

      /* 箭头按「这个视口下最宽的照片」定位，而不是当前这张。
         否则横图换竖图时照片一窄，两个按钮就跟着往里跳。 */
      var ctrl = parseFloat(getComputedStyle(prevBtn).width) || 52;
      var gutter = (frame.width - maxW) / 2;
      var off = Math.max(4, Math.round(gutter - ctrl - 12));
      prevBtn.style.left  = off + 'px';
      nextBtn.style.right = off + 'px';
      // figure 宽度锁成照片宽度，参数行才会贴着照片左缘，而不是被最长的一行文字推着走
      figure.style.width = Math.max(0, Math.round(w)) + 'px';
    }

    function show(i) {
      current = (i + items.length) % items.length;
      var it = items[current];
      var mine = ++token;

      // 1. 网格里那张缩略图已在缓存，先铺上去，画框任何时候都不是空的
      img.src = thumbSrc(it);
      img.classList.add('is-loading');

      // 2. 后台加载全尺寸再换上。盒子尺寸固定，换清晰度不会改变布局。
      //    刻意用 onload 而不是 decode()：标签页不可见时 decode() 的 promise
      //    永远不 settle，照片会一直停在低清版本。
      var full = new Image();
      full.onload = function () {
        if (mine !== token) return;        // 已经翻到别的图了
        img.src = full.src;
        img.classList.remove('is-loading');
      };
      full.onerror = function () {
        if (mine === token) img.classList.remove('is-loading');
      };
      full.src = fullSrc(it);

      img.alt = it.place || 'Photograph';
      countEl.textContent = pad(current + 1) + ' / ' + pad(items.length);

      rows.forEach(function (r) {
        var value = r[2] === 'settings' ? exposureText(it) : (it[r[2]] || '');
        r[1].textContent = value;
        r[0].hidden = !value && !r[3];     // 空行隐藏，除非标记为保留
      });

      // 两次：第一次让参数行完成排版，第二次按它的实际高度算照片尺寸
      // （手机上参数行可能折成两行）
      fit(); fit();

      // 预热前后两张，翻页才跟手
      (window.innerWidth <= 640 ? [current + 1] : [current + 1, current - 1]).forEach(function (n) {
        var neighbour = items[(n + items.length) % items.length];
        if (neighbour) new Image().src = fullSrc(neighbour);
      });
    }

    function open(i) {
      lastFocused = document.activeElement;
      box.classList.add('is-open');
      document.body.classList.add('lb-locked');
      show(i);
      requestAnimationFrame(function () { if (box.classList.contains('is-open')) fit(); });
      closeBtn.focus();
    }

    function close() {
      box.classList.remove('is-open');
      document.body.classList.remove('lb-locked');
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', function () { show(current - 1); });
    nextBtn.addEventListener('click', function () { show(current + 1); });

    // 点照片外关闭，但留一圈缓冲：想点照片边缘、或往箭头方向移动时手滑几个
    // 像素，不该被弹出去。
    var DISMISS_BUFFER = 60;

    stage.addEventListener('click', function (e) {
      // 参数行和控件都在 stage 里面，都不算「照片之外」
      if (e.target.closest && e.target.closest('.lightbox-bar, .lb-btn, .lb-count')) return;

      var b = img.getBoundingClientRect();
      var safe = e.clientX >= b.left   - DISMISS_BUFFER &&
                 e.clientX <= b.right  + DISMISS_BUFFER &&
                 e.clientY >= b.top    - DISMISS_BUFFER &&
                 e.clientY <= b.bottom + DISMISS_BUFFER;
      if (!safe) close();
    });

    // 观察元素盒子而不只是 window.resize：横竖屏切换、手机浏览器地址栏收起
    // 这些改变视口但不一定发 resize 事件。
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        if (box.classList.contains('is-open')) fit();
      }).observe(box);
    }
    window.addEventListener('resize', fit);
    img.addEventListener('load', function () { if (box.classList.contains('is-open')) fit(); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', function () {
      if (box.classList.contains('is-open')) fit();
    });

    document.addEventListener('keydown', function (e) {
      if (!box.classList.contains('is-open')) return;

      if (e.key === 'Escape')     { close();            return; }
      if (e.key === 'ArrowLeft')  { show(current - 1);  return; }
      if (e.key === 'ArrowRight') { show(current + 1);  return; }

      // 焦点陷阱：覆盖层是 aria-modal，Tab 不该跑到背后的页面上去
      if (e.key === 'Tab') {
        var focusable = [closeBtn, prevBtn, nextBtn].filter(function (b) {
          return b.offsetParent !== null;      // is-single 时箭头是 display:none
        });
        if (!focusable.length) return;
        e.preventDefault();
        var at = focusable.indexOf(document.activeElement);
        var step = e.shiftKey ? -1 : 1;
        var to = (at + step + focusable.length) % focusable.length;
        focusable[at === -1 ? 0 : to].focus();
      }
    });

    /* ---------- 触屏滑动 ---------------------------------------------- */
    var x0 = null;
    box.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 55) show(current + (dx < 0 ? 1 : -1));
      x0 = null;
    }, { passive: true });

    return { open: open, close: close, setItems: setItems };
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  return { init: init, esc: esc };
})();
