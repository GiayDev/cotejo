import { lerExtenso, valorPorExtenso, formatarMoeda, LIMITE_REAIS } from './extenso.mjs';

const PADRAO = /R\$\s*(\d[\d.]*(?:,\d+)?)\s*\(([^()]{1,400})\)/g;
const NUMERO = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;

export function lerNumero(texto) {
  const m = NUMERO.exec(texto);
  if (!m) return null;
  const reais = BigInt(m[1].replace(/\./g, ''));
  if (reais >= LIMITE_REAIS) return null;
  const centavos = m[2] ? BigInt(m[2].padEnd(2, '0')) : 0n;
  return reais * 100n + centavos;
}

function posicao(texto, indice) {
  let linha = 1;
  let inicio = 0;
  for (let i = texto.indexOf('\n'); i !== -1 && i < indice; i = texto.indexOf('\n', i + 1)) {
    linha++;
    inicio = i + 1;
  }
  return { linha, coluna: indice - inicio + 1 };
}

export function conferir(texto) {
  const resultados = [];
  for (const m of texto.matchAll(PADRAO)) {
    const { linha, coluna } = posicao(texto, m.index);
    const extenso = m[2].replace(/\s+/g, ' ').trim();
    const base = { linha, coluna, numero: m[1], extenso };
    const esperado = lerNumero(m[1]);
    if (esperado === null) {
      resultados.push({ ...base, status: 'formato', detalhe: `número fora do formato brasileiro: ${m[1]}` });
      continue;
    }
    const lido = lerExtenso(extenso);
    if (lido.erro) {
      resultados.push({ ...base, status: 'ilegivel', detalhe: lido.erro, sugestao: valorPorExtenso(esperado) });
    } else if (lido.centavos !== esperado) {
      resultados.push({
        ...base,
        status: 'diverge',
        detalhe: `o extenso lê ${formatarMoeda(lido.centavos)}`,
        sugestao: valorPorExtenso(esperado),
      });
    } else {
      resultados.push({ ...base, status: 'ok', unidade: lido.unidade });
    }
  }
  return resultados;
}
