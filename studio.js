/* Velora upload pages. Loaded only when someone opens Upload or My songs. (First part: the entry page.) */
window.VeloraStudio = (function(){
  "use strict";
  return {
    open(path, params, ctx){
      ctx.main.innerHTML = `<h1 class="pagetitle">Upload a song</h1><div class="panel"><h3>Coming in the next step</h3><p class="muted small" style="margin:0">The upload page is being built on this branch.</p></div>`;
    },
    leave(){}
  };
})();
