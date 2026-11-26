# cotejo

Contratos, propostas e editais repetem cada valor duas vezes: `R$ 15.000,00 (quinze mil reais)`. Quando os dois não batem, alguém paga a diferença, e muitos editais dizem expressamente que vale o extenso. O cotejo lê o documento, acha cada par e avisa quando o número e as palavras dizem coisas diferentes.

```
$ cotejo exemplos/contrato-com-erros.txt
exemplos/contrato-com-erros.txt:9:30  DIVERGE  R$ 15.000,00  (o extenso lê R$ 150.000,00)
    escrito:  cento e cinquenta mil reais
    esperado: quinze mil reais
exemplos/contrato-com-erros.txt:11:37  ILEGÍVEL  R$ 1.250,50  (palavra não reconhecida: "reias")
    escrito:  mil duzentos e cinquenta reias e cinquenta centavos
    esperado: mil duzentos e cinquenta reais e cinquenta centavos
4 valor(es) conferido(s) em 1 arquivo(s): 1 divergência(s), 1 não lido(s)
```

Roda local, sem dependências, sem enviar o documento para lugar nenhum.

## Uso

Precisa de Node 20 ou mais novo. Foi testado só no Node 24, em Android (Termux, arm64).

```
git clone https://github.com/GiayDev/cotejo
node cotejo/bin/cotejo.mjs contrato.docx
node cotejo/bin/cotejo.mjs pasta-de-contratos/
```

Aceita arquivos `.txt`, `.md`, `.html` e `.docx`, ou pastas (`node_modules` e `.git` são ignoradas). Arquivo de texto que não for UTF-8 válido é lido como Latin-1.

Opções: `--json` para saída estruturada, `--estrito` para tratar extenso ilegível como erro, `--ajuda`.

Código de saída: `0` sem divergência, `1` com divergência (ou ilegível, com `--estrito`), `2` erro de uso ou de leitura. Dá para usar como etapa de revisão antes de assinar ou em CI de repositório de minutas.

## O que ele procura

O padrão é `R$` + número + extenso entre parênteses, com o parêntese podendo quebrar linha. O número precisa estar no formato brasileiro (`1.234,56`, `1234,5`, `1234`).

Do extenso ele aceita o que aparece na prática: `um mil`, `hum`, `catorze`/`quatorze`, vírgulas entre as classes, maiúsculas, `milhão de reais`, com ou sem a palavra `reais`. O que ele compara é o valor, não a ortografia dos conectivos; o texto em "esperado" segue uma convenção só, e outras formas corretas de escrever o mesmo valor também passam.

Palavra que não existe (`reias`), ordem impossível (`vinte e trinta`) e sobra de texto aparecem como `ILEGÍVEL`, com o motivo. Campo de modelo não preenchido (`R$ 1.000,00 (valor por extenso)`) cai nessa categoria.

No `.docx`, ele lê o corpo, rodapés, cabeçalhos e notas. Texto apagado com controle de alterações ativo é ignorado; texto inserido conta.

## O que ele não faz

- Não lê PDF. Converta para texto antes (o resultado depende do conversor).
- Só confere valor em reais com `R$` na frente e o extenso entre parênteses. Percentual, quantidade, prazo e valor sem `R$` ficam de fora.
- `R$ 1.000 (mil)`, sem a palavra reais, é aceito como R$ 1.000,00. `R$ 0,50 (cinquenta)` aparece como divergência porque `cinquenta` sem unidade é lido como reais.
- Valores a partir de 1 quatrilhão de reais são recusados.
- Não diz o que vale juridicamente quando há divergência.

## Testes

```
npm test
```

São 31 testes com `node:test`, sem fixtures binárias: o `.docx` de teste é montado em tempo de execução. Cobrem valores escritos à mão a partir das regras (`cem`/`cento`, `mil e quinhentos`, `um milhão de reais`), leitura de variações, ida e volta (gerar o extenso e ler de volta) em todos os valores de R$ 0,00 a R$ 300,00 e em 20 mil valores pseudoaleatórios até 999 trilhões, o scanner com linhas e colunas, `.docx` com número partido em vários trechos de formatação, texto apagado e entidades XML, e a CLI com códigos de saída.

A ida e volta sozinha só prova que o gerador e o leitor concordam entre si. Por isso, uma vez, fora do repositório, o leitor também foi conferido contra 7 mil frases geradas pela biblioteca `num2words` (pt_BR): leu todas corretamente. Os testes automáticos não dependem dela.

O `.docx` real só foi usado para ver se a extração de texto funciona: um modelo público de alteração contratual da JUCEB, que só tem campos em branco, portanto sem nenhum par para conferir. Nunca foi testado com contratos reais preenchidos, nem com arquivos de LibreOffice ou Google Docs.

## Estado

Versão 0.1.0. A leitura de `.docx` implementa só o necessário do formato zip (sem zip64, sem arquivo criptografado) e recusa o que não entende.

Licença MIT.
