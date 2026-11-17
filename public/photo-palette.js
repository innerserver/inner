(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ConnectifiPhotoPalette = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const mix = (a, b, amount) => a.map((value, index) => Math.round(value * (1-amount) + b[index] * amount));
  const hex = (rgb) => '#' + rgb.map((value) => value.toString(16).padStart(2,'0')).join('');
  const luminance = (rgb) => rgb.map((value) => { const c=value/255; return c<=.04045 ? c/12.92 : ((c+.055)/1.055)**2.4; }).reduce((sum,value,index) => sum+value*[.2126,.7152,.0722][index],0);
  const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  function fromPixels(pixels) {
    const bins = new Map(); let count=0, average=[0,0,0];
    for (let i=0; i+3<pixels.length; i+=4) {
      if (pixels[i+3]<128) continue;
      const rgb=[pixels[i],pixels[i+1],pixels[i+2]], key=rgb.map((value)=>Math.floor(value/32)).join(',');
      const bin=bins.get(key)||{count:0,sum:[0,0,0]};bin.count++;
      rgb.forEach((value,index)=>{bin.sum[index]+=value;average[index]+=value;});bins.set(key,bin);count++;
    }
    if (!count) throw new Error('This image has no visible colours. Choose another photo.');
    average=average.map((value)=>Math.round(value/count));
    const ranked=[...bins.values()].map((bin)=>({count:bin.count,rgb:bin.sum.map((value)=>Math.round(value/bin.count))})).sort((a,b)=>b.count-a.count);
    const dominant=ranked[0].rgb, dark=luminance(average)<.3, anchor=dark?[0,0,0]:[255,255,255];
    const bg=mix(dominant,anchor,dark?.88:.93), surface=mix(dominant,anchor,dark?.78:.98);
    const ink=dark?[248,248,248]:[20,20,20];
    // Prefer a frequent saturated colour over a tiny bright outlier.
    const chroma=(entry)=>(Math.max(...entry.rgb)-Math.min(...entry.rgb))/255;
    const colourful=ranked.filter((entry)=>chroma(entry)>=.12 && entry.count>=count*.0075);
    const accentSource=[...(colourful.length?colourful:ranked)].sort((a,b)=>b.count*(.15+chroma(b)**2)-a.count*(.15+chroma(a)**2))[0].rgb;
    let accent=accentSource;
    const target=dark?[255,255,255]:[0,0,0];
    for (let step=0; step<=20; step++) {
      accent=mix(accentSource,target,step/20);
      if (contrast(accent,surface)>=4.5 && contrast(accent,bg)>=4.5) break;
    }
    return { bg:hex(bg), surface:hex(surface), ink:hex(ink), accent:hex(accent) };
  }
  async function fromImage(source) {
    // Only the already prepared local upload is sampled. No network AI call.
    if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(source)) throw new Error('Upload a photo to create its colour palette');
    const image=await new Promise((resolve,reject)=>{const photo=new Image();photo.onload=()=>resolve(photo);photo.onerror=()=>reject(new Error('Could not read this photo’s colours'));photo.src=source;});
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
    const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0,64,64);
    return fromPixels(context.getImageData(0,0,64,64).data);
  }
  return {fromPixels,fromImage};
});
