import React from 'react'
import { caixasDaBorda } from './destinoDoClique'
import { semRaycast } from './raycastCena'

/**
 * A faixa da borda do chão (M5, escolha do usuário 23/11: «clicar na borda do chão manda atravessar»): quatro muros baixos e translúcidos, um em cada beira do quadrado, para o jogador VER onde clicar
 * para mandar a tropa a outro mapa. Só aparece com tropa selecionada (sem seleção a faixa não faz nada, e pintá-la enganaria). `raycast={semRaycast}`: o muro NUNCA captura o clique, que continua indo ao
 * chão de baixo (é o clique no chão que `destinoDoClique` lê). A cor é PROPOSTA minha (âmbar translúcido: não é verde nem vermelho de alerta, nem as 3 cores do minimapa); a escolha da cor é do usuário.
 * A GEOMETRIA vem de `caixasDaBorda` (o mesmo arquivo da regra do clique): o que se vê pintado é exatamente onde o clique manda atravessar.
 */
/** Altura do muro da borda, em metros [D-minha]: 1,5 m, visível de cima na câmera do Império (a medição de 23/11 mostrou que uma tira deitada não aparece). */
export const ALTURA_DO_MURO = 1.5

/**
 * Quanto o muro cobre o que está atrás dele [D-minha, cor e opacidade são propostas: o usuário escolhe]. 0,3 ficava quase invisível sobre a nuvem de visão (cinza claro, 92 % opaca): âmbar a 30 % sobre
 * cinza dá um bege de contraste baixo. 0,55 deixa a faixa clara sem tapar o chão por inteiro.
 */
export const OPACIDADE_DO_MURO = 0.55

/**
 * Ordem de desenho do muro: depois da nuvem e da penumbra (as duas ficam com `renderOrder` 0). O muro é DESENHADO POR CIMA de tudo (`depthTest` desligado): a nuvem de visão é uma coluna de 4 m com
 * `depthWrite`, que cobre a área inexplorada, e um muro de 1,5 m fica INTEIRO dentro dessa coluna: com o teste de profundidade ligado a nuvem o escondia (medido em 23/11 no jogo real: 36 pixels de diferença,
 * contra 32 do controle; com `depthTest` desligado, 44.852 pixels, 44.595 deles âmbar, contra 0 do controle). Como o muro só existe na faixa de 3 m da beira e só com tropa selecionada, desenhá-lo por cima
 * não esconde nada que importe.
 */
export const ORDEM_DO_MURO = 20

export const BordaDoMapa: React.FC<{ visivel: boolean }> = ({ visivel }) => {
  if (!visivel) return null
  // Um MURO baixo em pé, não uma tira deitada: medido no jogo real (23/11), a câmera do Império olha o chão de ~34 m de altura e muito inclinada, e uma tira deitada (plano a 1 cm ou a 15 cm do chão) ficava de perfil
  // e dava 0 pixels, enquanto uma caixa alta no mesmo lugar dava 18.923. `ALTURA_DO_MURO` é a menor altura que a medição mostrou visível de cima [D-minha: 1,5 m].
  const alto = ALTURA_DO_MURO
  return (
    <group name="borda-do-mapa" userData={{ borda: true }}>
      {caixasDaBorda().map((c) => (
        <mesh key={c.chave} position={[c.cx, -0.45 + alto / 2, c.cz]} raycast={semRaycast} renderOrder={ORDEM_DO_MURO}>
          <boxGeometry args={[c.hx * 2, alto, c.hz * 2]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={OPACIDADE_DO_MURO} depthWrite={false} depthTest={false} />
        </mesh>
      ))}
    </group>
  )
}
