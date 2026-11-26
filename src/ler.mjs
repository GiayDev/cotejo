import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { entradasZip, lerEntradaZip } from './zip.mjs';

export const EXTENSOES = new Set(['.txt', '.md', '.markdown', '.html', '.htm', '.docx']);

const PARTES_DOCX = /^word\/(document|footnotes|endnotes|header\d*|footer\d*)\.xml$/;

function decodificarTexto(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return buf.toString('latin1');
  }
}

function decodificarEntidades(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export function xmlWordParaTexto(xml) {
  return decodificarEntidades(
    xml
      .replace(/<w:(del|moveFrom)\b(?:[^>]*[^/>])?>[\s\S]*?<\/w:\1>/g, '')
      .replace(/<wp:posOffset>[^<]*<\/wp:posOffset>/g, '')
      .replace(/<w:tab\b[^>]*\/>/g, '\t')
      .replace(/<w:(br|cr)\b[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, ''),
  );
}

export function textoDeDocx(buf) {
  const entradas = entradasZip(buf).filter((e) => PARTES_DOCX.test(e.nome));
  if (!entradas.some((e) => e.nome === 'word/document.xml')) throw new Error('word/document.xml não encontrado: não parece um .docx');
  entradas.sort((a, b) => (a.nome === 'word/document.xml' ? -1 : b.nome === 'word/document.xml' ? 1 : a.nome.localeCompare(b.nome)));
  return entradas.map((e) => xmlWordParaTexto(lerEntradaZip(buf, e).toString('utf8'))).join('\n');
}

export function lerDocumento(caminho) {
  const buf = readFileSync(caminho);
  if (extname(caminho).toLowerCase() === '.docx') return textoDeDocx(buf);
  return decodificarTexto(buf);
}
