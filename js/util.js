/* 各处共用的小工具。必须在其他脚本之前加载。 */

window.Util = (function () {
  'use strict';

  /* 拼 HTML 字符串时，任何来自数据文件的值都要过一遍这里。
     gallery-data.js / series-data.js 都是可以手写的，一个多余的引号
     就能把 href 或 style 提前闭合。 */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 点当前页自己的那个 tab：默认行为是整页重载再落到顶部——白闪一下，
     还要重新下载。改成平滑滚回顶部，动作有意义也不刺眼。
     （点别的 tab 是真的换页，新页面从顶部开始是正常的。） */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.nav a[aria-current="page"]');
    if (!a) return;
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  return { esc: esc };
})();
