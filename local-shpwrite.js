// Minimal shapefile writer for point features in EPSG:2154
// Provides shpwrite.download(geojson, options) similar to the CDN library.
(function(){
  if (typeof window === 'undefined') return;
  if (window.shpwrite) return; // if external library loaded, keep it

  function crcTable(){
    const table = new Uint32Array(256);
    for(let i=0;i<256;i++){
      let c=i;
      for(let j=0;j<8;j++){
        c=((c&1)?(0xEDB88320^(c>>>1)):(c>>>1));
      }
      table[i]=c>>>0;
    }
    return table;
  }
  const CRC_TABLE = crcTable();
  function crc32(buf){
    let crc=-1;
    for(let i=0;i<buf.length;i++)
      crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    return (~crc)>>>0;
  }

  function encodeString(str){
    return new TextEncoder().encode(str);
  }

  function genShp(features){
    const n = features.length;
    let xmin=Infinity,ymin=Infinity,xmax=-Infinity,ymax=-Infinity;
    const coords = features.map(f=>{
      const [x,y]=f.geometry.coordinates;
      if(x<xmin)xmin=x;if(x>xmax)xmax=x;if(y<ymin)ymin=y;if(y>ymax)ymax=y;
      return [x,y];
    });
    const fileLen = 50 + n*14; // words
    const buf = new ArrayBuffer(fileLen*2);
    const view = new DataView(buf);
    // header
    view.setInt32(0,9994,false);
    for(let i=4;i<=20;i+=4)view.setInt32(i,0,false);
    view.setInt32(24,fileLen,false);
    view.setInt32(28,1000,true);
    view.setInt32(32,1,true);
    view.setFloat64(36,xmin,true);
    view.setFloat64(44,ymin,true);
    view.setFloat64(52,xmax,true);
    view.setFloat64(60,ymax,true);
    for(let o=68;o<100;o+=8)view.setFloat64(o,0,true);
    let off=100;
    let offsetWords=50;
    const index = new ArrayBuffer((50 + n*4)*2);
    const iview = new DataView(index);
    iview.setInt32(0,9994,false);
    for(let i=4;i<=20;i+=4)iview.setInt32(i,0,false);
    iview.setInt32(24,50+n*4,false);
    iview.setInt32(28,1000,true);
    iview.setInt32(32,1,true);
    iview.setFloat64(36,xmin,true);
    iview.setFloat64(44,ymin,true);
    iview.setFloat64(52,xmax,true);
    iview.setFloat64(60,ymax,true);
    for(let o=68;o<100;o+=8)iview.setFloat64(o,0,true);
    let ioff=100;
    coords.forEach((c,idx)=>{
      view.setInt32(off,idx+1,false);
      view.setInt32(off+4,10,false);
      view.setInt32(off+8,1,true);
      view.setFloat64(off+12,c[0],true);
      view.setFloat64(off+20,c[1],true);
      off+=28;
      iview.setInt32(ioff,offsetWords,false);
      iview.setInt32(ioff+4,10,false);
      ioff+=8;
      offsetWords+=14;
    });
    return {shp:new Uint8Array(buf), shx:new Uint8Array(index)};
  }

  function genDbf(features){
    const n = features.length;
    const fieldLen=80;
    const headerLen=32+32+1;
    const recordLen=1+fieldLen;
    const buf = new ArrayBuffer(headerLen + recordLen*n + 1);
    const view = new DataView(buf);
    const now=new Date();
    view.setUint8(0,0x03);
    view.setUint8(1,now.getFullYear()-1900);
    view.setUint8(2,now.getMonth()+1);
    view.setUint8(3,now.getDate());
    view.setUint32(4,n,true);
    view.setUint16(8,headerLen,true);
    view.setUint16(10,recordLen,true);
    const enc = new TextEncoder();
    let off=32;
    const nameBytes=enc.encode('species');
    const nameArr=new Uint8Array(buf,off,11);nameArr.fill(0);nameArr.set(nameBytes.slice(0,11));
    view.setUint8(off+11,0x43);
    view.setUint32(off+12,0,true);
    view.setUint8(off+16,fieldLen);
    view.setUint8(off+17,0);
    for(let i=18;i<32;i++)view.setUint8(off+i,0);
    off+=32;
    view.setUint8(off,0x0D);
    off=headerLen;
    features.forEach(f=>{
      view.setUint8(off,0x20);
      const s=f.properties && f.properties.species ? f.properties.species : '';
      const b=enc.encode(s);
      const arr=new Uint8Array(buf,off+1,fieldLen);arr.fill(0x20);arr.set(b.slice(0,fieldLen));
      off+=recordLen;
    });
    view.setUint8(off,0x1A);
    return new Uint8Array(buf);
  }

  function zipFiles(files){
    const enc=new TextEncoder();
    const localParts=[];const centralParts=[];
    let offset=0;
    files.forEach(f=>{
      const name=enc.encode(f.name);const data=f.data;
      const crc=crc32(data);
      const lh=new Uint8Array(30+name.length);const lv=new DataView(lh.buffer);
      lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(8,0,true);
      lv.setUint16(10,0,true);lv.setUint16(12,0,true);lv.setUint16(14,0,true);
      lv.setUint32(16,crc,true);lv.setUint32(20,data.length,true);lv.setUint32(24,data.length,true);
      lv.setUint16(28,name.length,true);lv.setUint16(30,0,true);
      lh.set(name,30);
      localParts.push(lh,data);
      const ch=new Uint8Array(46+name.length);const cv=new DataView(ch.buffer);
      cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0,true);
      cv.setUint16(10,0,true);cv.setUint16(12,0,true);cv.setUint16(14,0,true);
      cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);
      cv.setUint16(28,name.length,true);cv.setUint16(30,0,true);cv.setUint16(32,0,true);cv.setUint16(34,0,true);
      cv.setUint16(36,0,true);cv.setUint32(38,0,true);cv.setUint32(42,offset,true);
      ch.set(name,46);
      centralParts.push(ch);
      offset += lh.length + data.length;
    });
    const centralSize=centralParts.reduce((a,b)=>a+b.length,0);
    const end=new Uint8Array(22);const ev=new DataView(end.buffer);
    ev.setUint32(0,0x06054b50,true);ev.setUint16(4,0,true);ev.setUint16(6,0,true);
    ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);
    ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);ev.setUint16(20,0,true);
    return new Blob([...localParts,...centralParts,end],{type:'application/zip'});
  }

  function download(geojson, opts={}){
    const feats=geojson.features || [];
    const {shp,shx}=genShp(feats);
    const dbf=genDbf(feats);
    const prj=encodeString(opts.prj||'');
    const name=opts.types && opts.types.point ? opts.types.point : 'data';
    const files=[
      {name:`${name}.shp`,data:shp},
      {name:`${name}.shx`,data:shx},
      {name:`${name}.dbf`,data:dbf},
      {name:`${name}.prj`,data:prj}
    ];
    const zip=zipFiles(files);
    const url=URL.createObjectURL(zip);
    const link=document.createElement('a');
    link.href=url;
    link.download=(opts.folder||'shapefile')+'.zip';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  window.shpwrite={download};
})();
