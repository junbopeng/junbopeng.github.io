/* Gallery 网格 —— 模块化网格，可按分类筛选。
   数据来自 js/gallery-data.js（由 scripts/optimize_images.py 生成）。
   看图界面在 js/lightbox.js。（Series 内页用的是 js/justified.js 的对齐行。） */

(function () {
  'use strict';

  var grid = document.getElementById('gallery');
  if (!grid) return;

  // 依赖缺失时降级成「图能看，只是点不开」，而不是整页空白
  var ok  = window.Util && window.Lightbox;
  var esc = (window.Util && window.Util.esc) ||
            function (s) { return String(s == null ? '' : s); };
  if (!ok) console.error('[gallery] 缺少 js/util.js 或 js/lightbox.js —— 灯箱不可用');

  var all  = (window.GALLERY_ITEMS || []).filter(function (it) { return !it.reserved; });
  var cats = window.GALLERY_CATEGORIES || [];

  /* ---------- 空状态 -------------------------------------------------- */
  if (!all.length) {
    grid.innerHTML =
      '<p style="color:var(--ink-faint);text-align:center;padding:4rem 0">' +
      'No photographs yet — run <code>scripts/optimize_images.py</code> to add some.</p>';
    return;
  }

  /* ---------- 分类 ----------------------------------------------------- */
  function slugify(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  // 一条 bar = 一个分类，没有「全部」那一条。
  // 代价是：cat 对不上任何分类的照片哪条 bar 里都不出现，页面上完全看不到。
  // 这种事只会表现为「怎么少了一张」，所以下面主动报出来。
  var groups = [];
  cats.forEach(function (name) {
    var list = all.filter(function (it) { return it.cat === name; });
    if (list.length) groups.push({ slug: slugify(name), label: name, items: list });
  });

  // 一个分类都没有时退回「全部照片、不画 bar」——否则整个网格会是空的
  if (!groups.length) groups = [{ slug: '', label: 'All', items: all }];

  (function () {
    var shown = groups.reduce(function (n, g) { return n + g.items.length; }, 0);
    if (shown >= all.length) return;
    var lost = all.filter(function (it) {
      return cats.indexOf(it.cat) === -1;
    }).map(function (it) { return it.file || it.base; });
    console.warn('[gallery] ' + lost.length + ' 张照片不属于任何分类，页面上不会出现：',
                 lost, '\n把它们放进 photos-src/ 的某个分类文件夹里再重跑 optimize_images.py');
  })();

  var active = 0;

  // 支持 ?c=slug，这样筛选结果可以分享，浏览器前进后退也正常
  (function () {
    var want = new URLSearchParams(location.search).get('c') || '';
    groups.forEach(function (g, i) { if (g.slug === want) active = i; });
  })();

  /* ---------- 排版：模块化网格 ------------------------------------------
     横图占一格，竖图占上下两格。格子高度 = 列宽 / 1.5（3:2），所以两格
     加间距的高度 ≈ 竖图自然高度的 88% —— 竖图裁掉约 12%（上下各一半）
     就正好对齐。裁切只在这里发生，灯箱里仍是完整画面。 */
  var GAP = 10;

  function columns(W) { return W < 640 ? 2 : 3; }

  function tileHtml(it, i, colW) {
    var base = esc(it.base);
    var tall = (it.w / it.h) < 1;            // 竖图
    var srcset = it.sizes.map(function (s) {
      return base + '-' + s + '.jpg ' + s + 'w';
    }).join(', ');

    var caption = it.place ? '<span class="shot-cap">' + esc(it.place) + '</span>' : '';

    return '<a class="gtile' + (tall ? ' gtile--tall' : '') + '"' +
             ' href="' + base + '-' + it.sizes[it.sizes.length - 1] + '.jpg"' +
             ' data-i="' + i + '"' +
             ' style="background:' + esc(it.color || '#eee') + '">' +
             '<img src="' + base + '-' + it.sizes[0] + '.jpg"' +
                 ' srcset="' + srcset + '" sizes="' + Math.round(colW) + 'px"' +
                 ' loading="lazy" decoding="async"' +
                 ' alt="' + esc(it.place || 'Photograph') + '">' +
             caption +
           '</a>';
  }

  var lastW = 0;

  function paint() {
    var items = groups[active].items;
    var W = grid.clientWidth;
    if (!W) return;
    lastW = W;

    var cols = columns(W);
    if (cols === 2) {
      items = items.slice().sort(function (a, b) {
        var fallback = groups[active].items;
        return (typeof a.mobileRank === 'number' ? a.mobileRank : fallback.indexOf(a)) -
               (typeof b.mobileRank === 'number' ? b.mobileRank : fallback.indexOf(b));
      });
    }
    var colW = (W - GAP * (cols - 1)) / cols;

    grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
    grid.style.gridAutoRows = Math.round(colW / 1.5) + 'px';
    grid.style.gap = GAP + 'px';

    grid.innerHTML = items.map(function (it, i) {
      return tileHtml(it, i, colW);
    }).join('');

    // 每个分类是一组独立的照片，看图界面要跟着换数据（不是重新初始化）
    if (!viewer && window.Lightbox) viewer = window.Lightbox.init(items);
    else if (viewer) viewer.setItems(items);
  }

  var viewer = null;

  /* ---------- 分类 bar --------------------------------------------------- */
  var bars = document.getElementById('filter');

  if (bars && groups.length > 1) {
    bars.innerHTML = groups.map(function (g, i) {
      // 不给 title —— 悬停冒出来的原生提示就是可见文字，而这组 bar 的
      // 整个用意就是「不写字」。分类名只留在 aria-label 里：读屏软件能用，
      // 屏幕上不出现。
      return '<button type="button" data-i="' + i + '"' +
             ' aria-label="' + esc(g.label) + '"' +
             ' aria-pressed="' + (i === active) + '"></button>';
    }).join('');

    bars.addEventListener('click', function (e) {
      if (!e.target.dataset || e.target.dataset.i === undefined) return;
      select(+e.target.dataset.i);
    });

    // 没有可见标签时，方向键的顺序感对键盘用户更重要
    bars.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var btns = [].slice.call(bars.querySelectorAll('button'));
      var at = btns.indexOf(document.activeElement);
      if (at === -1) return;
      e.preventDefault();
      var to = (at + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length;
      btns[to].focus();
      select(to);
    });
  }

  function select(i) {
    if (i === active) return;
    active = i;

    // 先垫住再换内容（顺序反了就已经被钳掉了）。垫这么多是为了兜底：
    // 就算新分类一张照片都没有，文档也足够高，当前滚动位置依然合法。
    setSpacer(scrollTop() + viewH());
    paint();
    trimSpacer();

    // 唯一的反馈就是画面变化，用一次性动画让因果关系明确。
    // 先摘掉再重加，否则连续点同一路径时动画不会重播。
    grid.classList.remove('is-swapping');
    void grid.offsetWidth;                       // 强制回流，重启动画
    grid.classList.add('is-swapping');

    [].forEach.call(bars.querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', String(+b.dataset.i === active));
    });

    var url = groups[active].slug
      ? location.pathname + '?c=' + encodeURIComponent(groups[active].slug)
      : location.pathname;
    history.replaceState(null, '', url);
  }

  /* 切分类会改变文档高度：18 张时页面 2130px，6 张时只剩 1005px。如果你正
     滚在 300 的位置，新页面的可滚上限只有 185 —— 那个位置物理上不存在了，
     浏览器只能把你钳回去，看起来就是「页面自己跳了」。

     所以在换内容之前先垫一块占位，把文档撑住，让当前滚动位置始终合法；
     换完再收到刚好够用的高度。之所以用独立的占位元素而不是给网格加
     min-height：想知道「不垫的话有多高」就得先把 min-height 摘掉量一次，
     而那一次测量本身就会触发钳位。占位元素的高度是我们自己写的，随时
     可以从文档总高里减掉，不用碰 DOM。 */
  /* 防跳动要读三个量：当前滚动位置、可视高度、文档高度。它们必须来自同一个
     滚动容器。常规页面就是整个窗口；gallery-fixed.html 那个原型把内容放进了
     自己的滚动容器里。页面上没有 .scroller 时，下面三个函数退化成原来的写法。 */
  var scroller = grid.closest('.scroller');
  var scrollTarget = scroller || window;
  function scrollTop() { return scroller ? scroller.scrollTop    : window.scrollY; }
  function viewH()     { return scroller ? scroller.clientHeight : window.innerHeight; }
  function docH()      { return scroller ? scroller.scrollHeight
                                         : document.documentElement.scrollHeight; }

  var spacer = document.createElement('div');
  spacer.setAttribute('aria-hidden', 'true');
  grid.parentNode.insertBefore(spacer, grid.nextSibling);
  var spacerH = 0;

  function setSpacer(px) {
    spacerH = Math.max(0, Math.round(px));
    spacer.style.height = spacerH + 'px';
  }

  // 收到「刚好让当前滚动位置合法」的高度
  function trimSpacer() {
    var natural = docH() - spacerH;
    setSpacer(scrollTop() + viewH() - natural);
  }

  scrollTarget.addEventListener('scroll', function () {
    if (spacerH) trimSpacer();          // 往上滚之后就不再需要垫了
  }, { passive: true });

  paint();

  /* ---------- 宽度变化时重排 --------------------------------------------- */
  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      if (grid.clientWidth && grid.clientWidth !== lastW) paint();
    }).observe(grid);
  }

  grid.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('.gtile');
    if (!link || !viewer) return;
    e.preventDefault();                       // 普通点击 → 打开看图界面
    viewer.open(parseInt(link.dataset.i, 10));
  });
})();
