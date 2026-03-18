# Logic Defense — Audio Assets

Drop your audio files here. The engine uses Howler.js for BGM and Web Audio API synthesis for SFX.

## BGM (Background Music) — Howler.js

| Arquivo | Uso | Specs recomendados |
|---|---|---|
| `bgm.mp3` | Trilha principal do jogo (loop) | MP3 192kbps, ~2-4 min, sem silêncio nos extremos |
| `bgm.ogg` | Fallback OGG do bgm.mp3 | OGG equivalente |
| `bgm_boss.mp3` | Trilha alternativa para waves de chefe (rounds 10, 20, 30...) | MP3 192kbps, mesmo BPM ou 15% mais rápido |
| `bgm_boss.ogg` | Fallback OGG do bgm_boss.mp3 | OGG equivalente |

> **Dica de Fade:** O Howler faz fade in de 1,5s ao iniciar e fade out de 0,8s ao trocar. Garanta que seus arquivos não comecem com cliques ou pops.

## SFX (Sound Effects) — Web Audio API (synthesized)

Os efeitos sonoros são **gerados em tempo real** via Web Audio API — nenhum arquivo necessário.
São substituíveis por arquivos Howler caso queira sons custom:

| Tipo | Descrição |
|---|---|
| `shoot` | Disparo rápido das torres de soma |
| `sniper` | Disparo da torre divisão (sniper) |
| `hit` | Impacto de projétil no inimigo |
| `correct` | Resposta correta na fase MATH |
| `wrong` | Resposta errada / timeout |
| `upgrade` | Upgrade de torre |
| `heal` | Vida ganha (wave perfeita) |
| `cinematic` | Rotação do mapa |
| `spin` | Roleta SPIN Esfera girando |

## Como substituir SFX por arquivos reais

Em `useAudio.ts`, localize o `SFX_FILES` map e descomente os caminhos.
Adicione os arquivos `.wav` ou `.mp3` nesta pasta.
