/**
 * An approximate mock of how Wallet lays out the store card, for eyeballing
 * the design before signing. Real Wallet rendering will differ slightly.
 */
export function previewHtml({ colors, images }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#000}
#art{padding:28px 16px;width:361px;font-family:-apple-system,system-ui,sans-serif}
.pass{border-radius:14px;overflow:hidden;background:${colors.bone};color:${colors.ink};
  box-shadow:0 10px 30px rgba(0,0,0,.6)}
.top{height:50px;display:flex;align-items:center;padding:0 12px}
.top img{height:34px}
.strip{display:block;width:100%}
.code{display:grid;place-items:center;padding:26px 0 28px}
.code div{background:#fff;border-radius:8px;padding:10px;line-height:0}
.code img{width:132px;height:132px}
</style></head><body><div id="art"><div class="pass">
  <div class="top"><img src="${images.logo}"></div>
  <img class="strip" src="${images.strip}">
  <div class="code"><div><img src="${images.qr}"></div></div>
</div></div></body></html>`;
}
