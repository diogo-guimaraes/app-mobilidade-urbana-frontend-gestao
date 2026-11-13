# Aceitar por gesto no app do motorista

Com a opção ligada, o motorista aceita ou recusa a chamada com a mão, sem tocar no celular. A câmera frontal só fica ligada enquanto a chamada está na tela.

- **Pegar** (fechar a mão que estava aberta): aceita.
- **Soltar** (abrir a mão que estava fechada): recusa.

O gesto faz o mesmo que os botões da chamada: aceitar segue o fluxo de sempre (no Negocia, manda a proposta pelo valor da oferta) e recusar é o X. Nada muda no backend nem na gestão: chegam as mesmas respostas de aceite e recusa.

## No app

O botão com a mão fica na home, acima do **Empilhar corridas**, e liga e desliga a opção. Ligado, ele fica amarelo; desligado, mostra a mão riscada. A escolha fica salva no aparelho e começa desligada.

Para ligar, o app pede a permissão da câmera. Se ela foi negada de vez, o botão abre as configurações do celular.

Na chamada, uma miniatura da câmera aparece no canto de cima, com a dica do gesto:

- Sem mão à vista: "✋→✊ aceita | ✊→✋ recusa".
- Mão aberta reconhecida: borda amarela e "✊ feche para aceitar".
- Mão fechada reconhecida: borda vermelha e "✋ abra para recusar".

## Como o gesto é reconhecido

Dois modelos do MediaPipe (Google, licença Apache 2.0) rodam no próprio aparelho, sem enviar imagem para nenhum servidor:

1. O detector de palma (`assets/modelos/detector_palma.tflite`) acha a mão no quadro.
2. O modelo de pontos (`assets/modelos/pontos_mao.tflite`) marca os 21 pontos da mão no recorte dela. Para cada dedo menos o polegar, compara a distância do punho até a ponta com a distância do punho até a base do dedo.

| Pose | Regra | Medido no aparelho |
|---|---|---|
| Aberta | todos os dedos acima de 1,2 e média acima de 1,4 | de 1,27 a 2,1 |
| Fechada | todos os dedos abaixo de 1,1 | de 0,54 a 0,98 |
| Nenhuma (meio do movimento) | o que fica entre as duas | de 1,1 a 1,35 |

O modelo de pontos também diz se há mesmo uma mão no recorte. Abaixo de 0,8, o quadro não conta.

## Proteções contra aceite ou recusa sem querer

- A pose de partida precisa aparecer em 3 quadros seguidos. A mão só de passagem não conta.
- A troca precisa acontecer em até 0,8 s. Fechar a mão devagar não decide.
- Os primeiros 0,8 s depois que a chamada aparece são ignorados.
- Uma chamada recebe uma decisão só. Depois dela, a câmera desliga.
- Mão parada, aberta ou fechada, não decide nada.

A decisão sai no primeiro quadro da pose de chegada. Se aparecer aceite ou recusa sem querer, o número de quadros exigidos fica em `QUADROS_FIM`, em `src/domain/gestoMao.ts`, junto com as outras regras e os testes em `tests/gestoMao.test.mjs`.

## Requisitos do build

A câmera usa módulos nativos (VisionCamera, fast-tflite e Nitro), então:

- **Não funciona no Expo Go.** O botão nem aparece lá. É preciso o build de desenvolvimento (`expo-dev-client`) ou o de produção.
- **Android 8.0 ou mais novo** (`minSdkVersion` 26, em `app.config.js`), exigido pelo redimensionamento da imagem na GPU.
- O plugin `plugins/withShaderDoResizer.js` copia o shader Vulkan já compilado (`assets/shaders/Resizer.comp.spv`) para o app no prebuild. Ao atualizar o `react-native-vision-camera-resizer`, gere o shader de novo com o `glslc` do NDK; o comando está no plugin.
- Os modelos aumentam o app em cerca de 7,8 MB.

## Simulador de corridas (desenvolvimento)

O frasco na borda esquerda da home abre **Simular corrida do motorista**, que só existe em desenvolvimento. Escolher qualquer opção já fecha o painel.

**Receber 5 corridas seguidas** mostra 5 chamadas diferentes, uma depois da outra, para treinar a sequência de decisões, inclusive pelo gesto. Aceitar ou recusar já chama a próxima, e deixar o tempo acabar conta como recusa. Dentro da sequência, aceitar não abre o embarque, só conta no placar. Ao fim, um aviso mostra quantas foram aceitas e quantas recusadas. Nada é enviado ao servidor.
