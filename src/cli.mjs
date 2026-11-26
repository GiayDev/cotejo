import { readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { conferir } from './conferir.mjs';
import { lerDocumento, EXTENSOES } from './ler.mjs';

const VERSAO = '0.1.0';
const IGNORADAS = new Set(['.git', 'node_modules']);

const AJUDA = `uso: cotejo [opções] <arquivo|pasta>...

Confere se cada "R$ valor (valor por extenso)" do documento diz a mesma coisa.
Lê .txt, .md, .html e .docx. Em pastas, percorre esses formatos.

  --json       saída em JSON, uma lista de achados por arquivo
  --estrito    extenso que não foi possível ler também faz o código de saída ser 1
  --versao     mostra a versão
  -h, --ajuda  mostra esta ajuda

código de saída: 0 sem divergência, 1 com divergência, 2 erro de uso ou de leitura
`;

function coletar(caminho, arquivos, erros) {
  let info;
  try {
    info = statSync(caminho);
  } catch (e) {
    erros.push(`${caminho}: ${e.code === 'ENOENT' ? 'não existe' : e.message}`);
    return;
  }
  if (info.isDirectory()) {
    for (const d of readdirSync(caminho, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (d.isSymbolicLink() || IGNORADAS.has(d.name)) continue;
      const filho = join(caminho, d.name);
      if (d.isDirectory() || EXTENSOES.has(extname(d.name).toLowerCase())) coletar(filho, arquivos, erros);
    }
  } else arquivos.push(caminho);
}

export function executar(argv, saida = console.log, erro = console.error) {
  const opcoes = { json: false, estrito: false };
  const alvos = [];
  for (const a of argv) {
    if (a === '--json') opcoes.json = true;
    else if (a === '--estrito') opcoes.estrito = true;
    else if (a === '--versao') {
      saida(VERSAO);
      return 0;
    } else if (a === '-h' || a === '--ajuda') {
      saida(AJUDA.trimEnd());
      return 0;
    } else if (a.startsWith('-') && a !== '-') {
      erro(`opção desconhecida: ${a}`);
      return 2;
    } else alvos.push(a);
  }
  if (!alvos.length) {
    erro(AJUDA.trimEnd());
    return 2;
  }

  const arquivos = [];
  const erros = [];
  for (const alvo of alvos) coletar(alvo, arquivos, erros);

  const relatorio = [];
  let conferidos = 0;
  let divergencias = 0;
  let ilegiveis = 0;
  for (const arquivo of arquivos) {
    let achados;
    try {
      achados = conferir(lerDocumento(arquivo));
    } catch (e) {
      erros.push(`${arquivo}: ${e.message}`);
      continue;
    }
    conferidos += achados.length;
    const problemas = achados.filter((a) => a.status !== 'ok');
    divergencias += problemas.filter((a) => a.status === 'diverge').length;
    ilegiveis += problemas.filter((a) => a.status !== 'diverge').length;
    relatorio.push({ arquivo, conferidos: achados.length, problemas });
  }

  if (opcoes.json) {
    saida(JSON.stringify({ arquivos: relatorio, conferidos, divergencias, ilegiveis, erros }, null, 2));
  } else {
    for (const r of relatorio) {
      for (const p of r.problemas) {
        const rotulo = p.status === 'diverge' ? 'DIVERGE' : p.status === 'formato' ? 'FORMATO' : 'ILEGÍVEL';
        saida(`${r.arquivo}:${p.linha}:${p.coluna}  ${rotulo}  R$ ${p.numero}  (${p.detalhe})`);
        saida(`    escrito:  ${p.extenso}`);
        if (p.sugestao) saida(`    esperado: ${p.sugestao}`);
      }
    }
    saida(`${conferidos} valor(es) conferido(s) em ${relatorio.length} arquivo(s): ${divergencias} divergência(s), ${ilegiveis} não lido(s)`);
    for (const e of erros) erro(`erro: ${e}`);
  }
  if (erros.length) return 2;
  return divergencias > 0 || (opcoes.estrito && ilegiveis > 0) ? 1 : 0;
}
