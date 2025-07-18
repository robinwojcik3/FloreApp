window.downloadShapefile = function(featureCollection, prjString, fileName = 'patrimonial_data') {
  const points = featureCollection.features.map(f => ({ x: f.geometry.coordinates[0], y: f.geometry.coordinates[1], props: f.properties }));
  if (points.length === 0) return;

  const bbox = points.reduce((b, p) => ({
    minX: Math.min(b.minX, p.x),
    minY: Math.min(b.minY, p.y),
    maxX: Math.max(b.maxX, p.x),
    maxY: Math.max(b.maxY, p.y)
  }), {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity});

  function shpBuffer() {
    const fileLength = 50 + points.length * 14; // 16-bit words
    const buf = new ArrayBuffer(fileLength * 2);
    const dv = new DataView(buf);
    dv.setInt32(0, 9994, false);
    for (let i = 4; i <= 20; i += 4) dv.setInt32(i, 0, false);
    dv.setInt32(24, fileLength, false);
    dv.setInt32(28, 1000, true);
    dv.setInt32(32, 1, true);
    dv.setFloat64(36, bbox.minX, true);
    dv.setFloat64(44, bbox.minY, true);
    dv.setFloat64(52, bbox.maxX, true);
    dv.setFloat64(60, bbox.maxY, true);
    dv.setFloat64(68, 0, true);
    dv.setFloat64(76, 0, true);
    dv.setFloat64(84, 0, true);
    dv.setFloat64(92, 0, true);
    let offset = 100;
    points.forEach((p, i) => {
      dv.setInt32(offset, i + 1, false);
      dv.setInt32(offset + 4, 10, false);
      dv.setInt32(offset + 8, 1, true);
      dv.setFloat64(offset + 12, p.x, true);
      dv.setFloat64(offset + 20, p.y, true);
      offset += 28;
    });
    return buf;
  }

  function shxBuffer() {
    const fileLength = 50 + points.length * 4;
    const buf = new ArrayBuffer(fileLength * 2);
    const dv = new DataView(buf);
    dv.setInt32(0, 9994, false);
    for (let i = 4; i <= 20; i += 4) dv.setInt32(i, 0, false);
    dv.setInt32(24, fileLength, false);
    dv.setInt32(28, 1000, true);
    dv.setInt32(32, 1, true);
    dv.setFloat64(36, bbox.minX, true);
    dv.setFloat64(44, bbox.minY, true);
    dv.setFloat64(52, bbox.maxX, true);
    dv.setFloat64(60, bbox.maxY, true);
    dv.setFloat64(68, 0, true);
    dv.setFloat64(76, 0, true);
    dv.setFloat64(84, 0, true);
    dv.setFloat64(92, 0, true);
    let offset = 50;
    points.forEach((p, i) => {
      dv.setInt32(100 + i*8, offset, false);
      dv.setInt32(104 + i*8, 10, false);
      offset += 14;
    });
    return buf;
  }

  function dbfBuffer() {
    const encoder = new TextEncoder();
    const fields = [
      { name: 'SPECIES', length: 254, prop: 'species' },
      { name: 'STATUS', length: 254, prop: 'status' },
      { name: 'ECOLOGY', length: 254, prop: 'ecology' }
    ];
    const recordLength = fields.reduce((s, f) => s + f.length, 1);
    const headerLength = 33 + 32 * fields.length;
    const buf = new ArrayBuffer(headerLength + recordLength * points.length + 1);
    const dv = new DataView(buf);
    const now = new Date();
    dv.setUint8(0, 3);
    dv.setUint8(1, now.getFullYear() - 1900);
    dv.setUint8(2, now.getMonth() + 1);
    dv.setUint8(3, now.getDate());
    dv.setUint32(4, points.length, true);
    dv.setUint16(8, headerLength, true);
    dv.setUint16(10, recordLength, true);
    let pos = 32;
    fields.forEach(f => {
      const nameBuf = encoder.encode(f.name);
      new Uint8Array(buf, pos, 11).set(nameBuf.slice(0, 11));
      pos += 11;
      dv.setUint8(pos, 'C'.charCodeAt(0));
      pos += 1; // field type
      pos += 4; // address not used
      dv.setUint8(pos, f.length); pos += 1; // field length
      dv.setUint8(pos, 0); pos += 1; // decimal count
      pos += 14; // reserved bytes
    });
    dv.setUint8(headerLength - 1, 0x0D);
    let offset = headerLength;
    points.forEach(p => {
      dv.setUint8(offset, 0x20); // not deleted
      offset += 1;
      fields.forEach(f => {
        const txt = (p.props[f.prop] || '').toString();
        const tbuf = encoder.encode(txt);
        const fieldBuf = new Uint8Array(buf, offset, f.length);
        fieldBuf.fill(0x20);
        fieldBuf.set(tbuf.slice(0, f.length));
        offset += f.length;
      });
    });
    new Uint8Array(buf)[offset] = 0x1A;
    return buf;
  }

  function crc32(buf) {
    const table = crc32.table || (crc32.table = (() => {
      let t = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[i] = c;
      }
      return t;
    })());
    let crc = -1;
    const u8 = new Uint8Array(buf);
    for (let i = 0; i < u8.length; i++) crc = (crc >>> 8) ^ table[(crc ^ u8[i]) & 0xff];
    return (crc ^ -1) >>> 0;
  }

  function zip(files) {
    let chunks = [];
    let central = [];
    let offset = 0;
    files.forEach(file => {
      const nameBuf = new TextEncoder().encode(file.name);
      const crc = crc32(file.data);
      const size = file.data.byteLength;
      const local = new ArrayBuffer(30 + nameBuf.length);
      const dv = new DataView(local);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true); // version needed to extract
      dv.setUint16(6, 0, true); // general purpose bit flag
      dv.setUint16(8, 0, true); // compression method
      dv.setUint16(10, 0, true); // last modification time
      dv.setUint16(12, 0, true); // last modification date
      dv.setUint32(14, crc, true); // CRC-32
      dv.setUint32(18, size, true); // compressed size
      dv.setUint32(22, size, true); // uncompressed size
      dv.setUint16(26, nameBuf.length, true);
      dv.setUint16(28, 0, true);
      new Uint8Array(local).set(nameBuf, 30);
      chunks.push(local, file.data);
      const centralHeader = new ArrayBuffer(46 + nameBuf.length);
      const cdv = new DataView(centralHeader);
      cdv.setUint32(0, 0x02014b50, true);
      cdv.setUint16(4, 20, true);
      cdv.setUint16(6, 20, true);
      cdv.setUint16(8, 0, true);
      cdv.setUint16(10, 0, true);
      cdv.setUint16(12, 0, true);
      cdv.setUint16(14, 0, true);
      cdv.setUint32(16, crc, true);
      cdv.setUint32(20, size, true);
      cdv.setUint32(24, size, true);
      cdv.setUint16(28, nameBuf.length, true);
      cdv.setUint16(30, 0, true);
      cdv.setUint16(32, 0, true);
      cdv.setUint16(34, 0, true);
      cdv.setUint16(36, 0, true);
      cdv.setUint32(38, 0, true);
      cdv.setUint32(42, offset, true);
      new Uint8Array(centralHeader).set(nameBuf, 46);
      central.push(centralHeader);
      offset += local.byteLength + size;
    });
    const centralSize = central.reduce((s, b) => s + b.byteLength, 0);
    const end = new ArrayBuffer(22);
    const edv = new DataView(end);
    edv.setUint32(0, 0x06054b50, true);
    edv.setUint16(8, files.length, true);
    edv.setUint16(10, files.length, true);
    edv.setUint32(12, centralSize, true);
    edv.setUint32(16, offset, true);
    edv.setUint16(20, 0, true);
    return new Blob([...chunks, ...central, end], { type: 'application/zip' });
  }

  const shp = shpBuffer();
  const shx = shxBuffer();
  const dbf = dbfBuffer();
  const prj = new TextEncoder().encode(prjString).buffer;
  const base = fileName.replace(/[\\/:*?"<>|]/g, '_');
  const blob = zip([
    { name: base + '.shp', data: shp },
    { name: base + '.shx', data: shx },
    { name: base + '.dbf', data: dbf },
    { name: base + '.prj', data: prj }
  ]);

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName + '.zip';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
