import { deflateRawSync, crc32 } from 'node:zlib';

export function montarZip(arquivos) {
  const locais = [];
  const centrais = [];
  let deslocamento = 0;
  for (const { nome, conteudo, metodo = 8 } of arquivos) {
    const bruto = Buffer.from(conteudo);
    const dados = metodo === 8 ? deflateRawSync(bruto) : bruto;
    const nomeBuf = Buffer.from(nome);
    const crc = crc32(bruto);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(metodo, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dados.length, 18);
    local.writeUInt32LE(bruto.length, 22);
    local.writeUInt16LE(nomeBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(metodo, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(dados.length, 20);
    central.writeUInt32LE(bruto.length, 24);
    central.writeUInt16LE(nomeBuf.length, 28);
    central.writeUInt32LE(deslocamento, 42);
    locais.push(local, nomeBuf, dados);
    centrais.push(central, nomeBuf);
    deslocamento += 30 + nomeBuf.length + dados.length;
  }
  const dirCentral = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(dirCentral.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...locais, dirCentral, fim]);
}

export function paragrafo(...trechos) {
  return `<w:p>${trechos.map((t) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`).join('')}</w:p>`;
}

export function docx(corpo, extras = []) {
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${corpo}</w:body></w:document>`;
  return montarZip([{ nome: '[Content_Types].xml', conteudo: '<Types/>' }, { nome: 'word/document.xml', conteudo: xml }, ...extras]);
}

export function lcg(semente) {
  let s = BigInt(semente);
  return () => {
    s = (s * 6364136223846793005n + 1442695040888963407n) & 0xffffffffffffffffn;
    return s >> 11n;
  };
}
