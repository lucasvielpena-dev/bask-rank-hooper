# Times, convites e amistosos

## Regras aprovadas
- **Tipos de time:** fechado (entrada só por convite) ou aberto (entrada por pedido, aprovado por capitão).
- **Quem cria:** qualquer usuário cadastrado. O criador é o primeiro capitão.
- **Capitães:** até 2 por time, indicados pelo criador.
- **Limite:** 12 jogadores por time, contando capitães.
- **Dia bloqueado:** um jogador não pode ter mais de um jogo de **time, torneio ou amistoso** no mesmo dia (dia inteiro, sem horário). **Rachão não bloqueia.**
- **Vários times:** um jogador pode estar em vários times, desde que os jogos sejam em dias diferentes.
- **Amistoso:** convite entre dois times, com data e local. Depois de jogado, vira partida com placar.
- **Onde fica no app:** Competições → aba Times. Convites chegam pelas notificações já existentes.

## Fases
1. **Banco:** tabelas `times`, `time_membros`, `amistosos` e as regras no banco (12 membros, 2 capitães, dia bloqueado). Testar com dois usuários de teste.
2. **Criar e listar times** em Competições → Times.
3. **Convites e pedidos**, com aceite, recusa e aprovação de capitão.
4. **Usar o time** em rachão e torneio: elenco copiado e travado durante o jogo.
5. **Amistosos**: proposta, aceite e partida com placar.

Cada fase tem teste no celular antes da próxima. Nada é aplicado no banco sem o SQL ser rodado pelo responsável.

## Pendências
- Torneio aceita 10 ou 12 jogadores por equipe? (a decidir)
- Quem pode criar time: qualquer cadastrado ou só perfil completo? (a decidir)
- Atualização automática por cidade segue desligada; convites dependem das notificações existentes.
