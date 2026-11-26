import { inflateRawSync } from 'node:zlib';

const LIMITE_SAIDA = 256 * 1024 * 1024;

export function entradasZip(buf) {
  const minimo = Math.max(0, buf.length - 65557);
  let eocd = -1;
  for (let i = buf.length - 22; i >= minimo; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('não é um arquivo zip válido');
  const total = buf.readUInt16LE(eocd + 10);
  let pos = buf.readUInt32LE(eocd + 16);
  if (total === 0xffff || pos === 0xffffffff) throw new Error('zip64 não é suportado');
  const entradas = [];
  for (let i = 0; i < total; i++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 0x02014b50) throw new Error('diretório central do zip corrompido');
    const flags = buf.readUInt16LE(pos + 8);
    const metodo = buf.readUInt16LE(pos + 10);
    const tamComprimido = buf.readUInt32LE(pos + 20);
    const tamOriginal = buf.readUInt32LE(pos + 24);
    const tamNome = buf.readUInt16LE(pos + 28);
    const tamExtra = buf.readUInt16LE(pos + 30);
    const tamComentario = buf.readUInt16LE(pos + 32);
    const deslocamento = buf.readUInt32LE(pos + 42);
    const nome = buf.toString('utf8', pos + 46, pos + 46 + tamNome);
    entradas.push({ nome, flags, metodo, tamComprimido, tamOriginal, deslocamento });
    pos += 46 + tamNome + tamExtra + tamComentario;
  }
  return entradas;
}

export function lerEntradaZip(buf, entrada) {
  if (entrada.flags & 1) throw new Error(`${entrada.nome}: entrada criptografada`);
  if (entrada.tamComprimido === 0xffffffff || entrada.tamOriginal === 0xffffffff) throw new Error('zip64 não é suportado');
  if (entrada.tamOriginal > LIMITE_SAIDA) throw new Error(`${entrada.nome}: descompactado passa de 256 MB`);
  const d = entrada.deslocamento;
  if (d + 30 > buf.length || buf.readUInt32LE(d) !== 0x04034b50) throw new Error(`${entrada.nome}: cabeçalho local inválido`);
  const inicio = d + 30 + buf.readUInt16LE(d + 26) + buf.readUInt16LE(d + 28);
  const dados = buf.subarray(inicio, inicio + entrada.tamComprimido);
  if (entrada.metodo === 0) return Buffer.from(dados);
  if (entrada.metodo === 8) return inflateRawSync(dados, { maxOutputLength: LIMITE_SAIDA });
  throw new Error(`${entrada.nome}: método de compressão ${entrada.metodo} não suportado`);
}
