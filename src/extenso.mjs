const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
const ESCALAS = [
  { valor: 10n ** 12n, singular: 'trilhão', plural: 'trilhões' },
  { valor: 10n ** 9n, singular: 'bilhão', plural: 'bilhões' },
  { valor: 10n ** 6n, singular: 'milhão', plural: 'milhões' },
];

export const LIMITE_REAIS = 10n ** 15n;

function grupo(n) {
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes = [];
  if (c) partes.push(CENTENAS[c]);
  if (r) partes.push(r < 20 ? UNIDADES[r] : DEZENAS[Math.floor(r / 10)] + (r % 10 ? ` e ${UNIDADES[r % 10]}` : ''));
  return partes.join(' e ');
}

export function inteiroPorExtenso(n) {
  if (typeof n !== 'bigint' || n < 0n || n >= LIMITE_REAIS) throw new RangeError('inteiro fora do intervalo suportado');
  if (n === 0n) return 'zero';
  const partes = [];
  let resto = n;
  for (const e of ESCALAS) {
    const q = resto / e.valor;
    if (q > 0n) {
      const g = Number(q);
      partes.push({ g, texto: g === 1 ? `um ${e.singular}` : `${grupo(g)} ${e.plural}` });
      resto %= e.valor;
    }
  }
  const mil = Number(resto / 1000n);
  if (mil > 0) {
    partes.push({ g: mil, texto: mil === 1 ? 'mil' : `${grupo(mil)} mil` });
    resto %= 1000n;
  }
  if (resto > 0n) partes.push({ g: Number(resto), texto: grupo(Number(resto)) });
  let saida = partes[0].texto;
  for (let i = 1; i < partes.length; i++) {
    const ultima = i === partes.length - 1;
    const liga = ultima && (partes[i].g < 100 || partes[i].g % 100 === 0) ? ' e ' : ' ';
    saida += liga + partes[i].texto;
  }
  return saida;
}

export function valorPorExtenso(centavos) {
  if (typeof centavos !== 'bigint' || centavos < 0n) throw new RangeError('valor inválido');
  const reais = centavos / 100n;
  const cents = Number(centavos % 100n);
  if (reais >= LIMITE_REAIS) throw new RangeError('valor acima do suportado');
  const partes = [];
  if (reais > 0n) {
    const texto = inteiroPorExtenso(reais);
    if (reais === 1n) partes.push(`${texto} real`);
    else if (reais % 1000000n === 0n) partes.push(`${texto} de reais`);
    else partes.push(`${texto} reais`);
  }
  if (cents > 0) partes.push(`${grupo(cents)} ${cents === 1 ? 'centavo' : 'centavos'}`);
  return partes.length ? partes.join(' e ') : 'zero reais';
}

const TOKENS = new Map();
const reg = (palavras, valor, tipo) => {
  for (const p of palavras.split(' ')) TOKENS.set(p, { valor: BigInt(valor), tipo });
};
reg('um hum uma', 1, 'u');
reg('dois duas', 2, 'u');
reg('tres', 3, 'u');
reg('quatro', 4, 'u');
reg('cinco', 5, 'u');
reg('seis', 6, 'u');
reg('sete', 7, 'u');
reg('oito', 8, 'u');
reg('nove', 9, 'u');
reg('dez', 10, 'd');
reg('vinte', 20, 'd');
reg('trinta', 30, 'd');
reg('quarenta', 40, 'd');
reg('cinquenta', 50, 'd');
reg('sessenta', 60, 'd');
reg('setenta', 70, 'd');
reg('oitenta', 80, 'd');
reg('noventa', 90, 'd');
reg('onze', 11, 't');
reg('doze', 12, 't');
reg('treze', 13, 't');
reg('quatorze catorze', 14, 't');
reg('quinze', 15, 't');
reg('dezesseis dezasseis', 16, 't');
reg('dezessete dezassete', 17, 't');
reg('dezoito', 18, 't');
reg('dezenove dezanove', 19, 't');
reg('cem cento', 100, 'c');
reg('duzentos duzentas', 200, 'c');
reg('trezentos trezentas', 300, 'c');
reg('quatrocentos quatrocentas', 400, 'c');
reg('quinhentos quinhentas', 500, 'c');
reg('seiscentos seiscentas', 600, 'c');
reg('setecentos setecentas', 700, 'c');
reg('oitocentos oitocentas', 800, 'c');
reg('novecentos novecentas', 900, 'c');
reg('mil', 1000, 'e');
reg('milhao milhoes', 10 ** 6, 'e');
reg('bilhao bilhoes', 10 ** 9, 'e');
reg('trilhao trilhoes', 10 ** 12, 'e');

const RANK = { c: 4, d: 3, u: 2 };

function semAcento(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function lerSegmento(tokens) {
  if (tokens.length === 1 && tokens[0] === 'zero') return { valor: 0n };
  let total = 0n;
  let atual = 0n;
  let ultimaEscala = null;
  let anterior = null;
  for (const t of tokens) {
    const info = TOKENS.get(t);
    if (!info) return { erro: `palavra não reconhecida: "${t}"` };
    if (info.tipo === 'e') {
      if (ultimaEscala !== null && info.valor >= ultimaEscala) return { erro: `"${t}" fora de ordem` };
      total += (atual === 0n ? 1n : atual) * info.valor;
      atual = 0n;
      ultimaEscala = info.valor;
      anterior = null;
      continue;
    }
    if (info.tipo === 't') {
      if (anterior !== null && anterior !== 'c') return { erro: `"${t}" depois de outra dezena ou unidade` };
      anterior = 't';
    } else {
      if (anterior === 't' || (anterior !== null && RANK[info.tipo] >= RANK[anterior])) return { erro: `"${t}" fora de ordem` };
      anterior = info.tipo;
    }
    atual += info.valor;
  }
  if (!tokens.length) return { erro: 'nenhum número' };
  return { valor: total + atual };
}

export function lerExtenso(texto) {
  const tokens = semAcento(String(texto).toLowerCase()).replace(/[^a-z]+/g, ' ').trim().split(' ').filter(Boolean);
  let reais = null;
  let centavos = null;
  let atual = [];
  for (const t of tokens) {
    if (t === 'real' || t === 'reais') {
      if (reais !== null || centavos !== null) return { erro: `"${t}" repetido ou fora de ordem` };
      reais = atual;
      atual = [];
    } else if (t === 'centavo' || t === 'centavos') {
      if (centavos !== null) return { erro: `"${t}" repetido` };
      centavos = atual;
      atual = [];
    } else if (t !== 'e' && t !== 'de' && t !== 'do') {
      atual.push(t);
    }
  }
  let unidade = 'ambas';
  if (reais === null && centavos === null) {
    unidade = 'nenhuma';
    reais = atual;
    atual = [];
  } else if (centavos === null) unidade = 'reais';
  else if (reais === null) unidade = 'centavos';
  if (atual.length) return { erro: `texto sobrando depois da unidade: "${atual.join(' ')}"` };
  let r = 0n;
  let c = 0n;
  if (reais !== null) {
    const seg = lerSegmento(reais);
    if (seg.erro) return { erro: seg.erro };
    r = seg.valor;
  }
  if (centavos !== null) {
    const seg = lerSegmento(centavos);
    if (seg.erro) return { erro: seg.erro };
    if (seg.valor > 99n) return { erro: 'centavos acima de 99' };
    c = seg.valor;
  }
  return { centavos: r * 100n + c, unidade };
}

export function formatarMoeda(centavos) {
  const reais = (centavos / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${reais},${(centavos % 100n).toString().padStart(2, '0')}`;
}
