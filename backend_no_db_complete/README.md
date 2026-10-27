# Guardian — protótipo com integração de câmeras configurável

Esta versão melhora a interface do projeto e acrescenta um protótipo navegável de mapa, gestão de câmeras, contatos, grupos e mensagens.

## Executar localmente

1. Instale o Node.js LTS.
2. Abra um terminal na pasta `backend_no_db_complete`.
3. Execute `npm install`.
4. Copie `.env.example` para `.env`, configure `JWT_SECRET` e gere `CAMERA_ENCRYPTION_KEY` como descrito abaixo. O backend não inicia sem uma chave válida. Não publique o `.env`.
5. Execute `npm run start:static`.
6. Acesse `http://localhost:4000`.

O banco SQLite é criado pelo backend quando inicializado. O login e o cadastro usam as rotas de autenticação existentes.

## Preparar execução com Docker

O `compose.yaml` prepara dois serviços separados: o backend Guardian e o MediaMTX. O banco SQLite e as gravações usam volumes Docker persistentes. Apenas o backend publica uma porta, vinculada por padrão a `127.0.0.1:4000`; as portas de controle e HLS do MediaMTX ficam somente na rede privada do Compose. A imagem MediaMTX está fixada na versão `1.21.3`.

1. Instale Docker Engine com o plugin Docker Compose ou Docker Desktop.
2. No diretório `backend_no_db_complete`, copie `.env.example` para `.env`.
3. Configure `JWT_SECRET`, `CAMERA_ENCRYPTION_KEY`, `MEDIAMTX_API_PASSWORD` e `MEDIAMTX_HLS_PASSWORD` localmente. Gere segredos fortes; por exemplo, `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Use um segredo diferente para cada variável e não envie os valores por chat nem os inclua no Git.
4. Para habilitar o cadastro real de câmeras, configure `CAMERA_ALLOWED_NETWORKS` com os CIDRs privados da rede que o host Docker está autorizado a acessar. Sem isso, o backend recusa cadastros de câmera.
5. Execute `docker compose up --build` e acesse `http://localhost:4000`. O backend precisa de `CAMERA_ENCRYPTION_KEY` válida e das credenciais MediaMTX; o Compose encerra a configuração com erro claro se essas variáveis obrigatórias estiverem vazias.
6. Pare com `docker compose down`. Os volumes permanecem. Não use `docker compose down -v` em instalações com dados que queira preservar.

O Compose usa HTTP para a comunicação entre containers apenas pelo hostname `mediamtx`, explicitamente confiado em `MEDIAMTX_INTERNAL_HOSTS`. Esse hostname de confiança libera HTTP somente para esse serviço; demais hosts continuam obrigados a usar HTTPS e a allowlist `MEDIAMTX_ALLOWED_HOSTS`. Não publique portas MediaMTX no host. Em VPS, mantenha o backend ligado a loopback e use um proxy reverso com TLS para acesso externo. Configure firewall/roteamento do host Docker para alcançar apenas as redes de câmeras autorizadas; a rede bridge do Docker precisa ter rota até elas.

Faça backups consistentes do volume do banco, do volume de gravações e da chave `CAMERA_ENCRYPTION_KEY`, mantendo a chave separada dos backups de dados. A perda da chave torna os dados cifrados irrecuperáveis.

## O que está implementado nesta entrega

- Interface responsiva com painel, navegação e identidade visual Guardian.
- Tela de login e cadastro conectada às rotas de autenticação já existentes.
- Cadastro autenticado de câmeras RTSP/RTSPS, exigindo número, data e anexo do BO antes dos dados de conexão; aceita PDF, JPG/JPEG, PNG, WebP, MP4 e WebM até 10 MB.
- Acesso à câmera provisionado automaticamente após o cadastro e restrito ao proprietário. Transmissões reais não são publicadas nem compartilhadas automaticamente; anexar um BO não verifica sua autenticidade.
- Gravações podem ser listadas, reproduzidas e baixadas pelo proprietário sem aguardar aprovação administrativa, sempre dentro da conta autenticada.
- Credenciais RTSP, número do BO e conteúdo do arquivo anexado cifrados com AES-256-GCM no banco; evidências disponíveis somente ao proprietário e nunca devolvidas em listagens.
- Provisionamento de path no MediaMTX após o cadastro, proxy HLS autenticado por proprietário e APIs autenticadas de gravações com filtros por data/horário e download com suporte a Range.
- Retenção de gravações configurável de 1 a 30 dias (30 dias por padrão), com exclusão automática gerenciada pelo MediaMTX.
- Reprovisionamento automático dos paths aprovados no início do backend e após reinícios do MediaMTX.
- Visualização de mapa do Google Maps incorporado e listagem de câmeras públicas cadastradas nesta sessão/conta local.
- Gestão local de contatos, criação de grupos e conversas de demonstração.
- Composição de mensagens, prévia local de arquivos e ação de referência de câmera em uma conversa.
- Avisos claros quando uma função depende de infraestrutura externa.
- Feedback privado sobre o Guardian e nível de participação com conquistas, calculado por publicações e câmeras cadastradas.

## Configuração da integração de câmeras

O backend está preparado para RTSP genérico e MediaMTX v1.21.3 ou compatível, mas esta máquina ainda não tem MediaMTX instalado e nenhum modelo/firmware de câmera foi informado. Não há câmera conectada nesta entrega; transmissão, gravação e compatibilidade física ainda precisam ser comprovadas no servidor autorizado.

1. Instale e execute o MediaMTX em um computador/servidor autorizado que alcance as câmeras pela VPN/rede privada. Mantenha a Control API, HLS e gravações em loopback ou em uma rede privada protegida por firewall; não exponha as portas RTSP, HLS, WebRTC ou API publicamente.
2. Crie no MediaMTX um usuário de Control API com permissão `api` e um usuário de reprodução com permissão `read`. Configure os endereços/portas no `.env` local do backend; não coloque usuários ou senhas no frontend.
3. Configure `CAMERA_ENCRYPTION_KEY` com uma chave aleatória de 32 bytes codificada em Base64. Gere uma localmente no terminal:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   Copie o valor para o `.env` local ou para o gerenciador de segredos do servidor. Não o envie ao chat, não o registre em logs e mantenha backup seguro separado do banco: sem essa chave, credenciais e anexos de BO não podem ser descriptografados. O `.env` está excluído do Git.

   Se houver dados cifrados com a configuração antiga `CAMERA_CREDENTIALS_KEY`, faça primeiro um backup do banco. Configure a nova `CAMERA_ENCRYPTION_KEY` e, temporariamente, a chave antiga em `CAMERA_LEGACY_ENCRYPTION_KEY`; na inicialização o backend migra os registros para a chave nova sem gravar texto puro. Confirme a inicialização e o acesso aos dados antes de remover a variável legada. Se a migração falhar, o servidor não inicia; mantenha o backup e as duas chaves, corrija a configuração e tente novamente. Não substitua uma chave sem preservar a anterior durante a migração.

4. Preencha `CAMERA_ALLOWED_NETWORKS` somente com os CIDRs IPv4 privados da rede autorizada da VPN e `CAMERA_ALLOWED_RTSP_PORTS` com as portas permitidas. `CAMERA_REVIEWER_IDS` permanece disponível para pedidos legados pendentes. Sem allowlist, criptografia e configuração MediaMTX, as operações falham fechadas.
5. Configure `MEDIAMTX_RECORDINGS_PATH` como caminho visto pelo MediaMTX e `RECORDINGS_DIRECTORY` como o mesmo volume/caminho visto pelo backend. Use um armazenamento com espaço monitorado; `CAMERA_RECORDING_RETENTION_DAYS=30` aplica a política escolhida.
6. Configure `MEDIAMTX_ALLOWED_HOSTS` com o hostname exato do MediaMTX se estiver remoto. Endpoints remotos devem usar HTTPS; em instalação local, mantenha API/HLS em `127.0.0.1`.
7. Cadastre a câmera com o endereço RTSP fornecido pelo fabricante e anexe o BO. O endereço precisa apontar para IPv4 dentro da rede autorizada e usar uma porta permitida. A integração provisiona o acesso privado do proprietário; o envio do arquivo não atesta sua autenticidade e não habilita compartilhamento público.

O arquivo do BO é cifrado com `CAMERA_ENCRYPTION_KEY` e pode ser baixado pelo proprietário na lista de câmeras. A chave precisa ser protegida e mantida em backup, pois também é necessária para descriptografar anexos existentes.

## Reputação e feedback

O nível é uma pontuação de participação calculada no servidor: 10 pontos por publicação (até cinco) e 15 por câmera cadastrada (até duas), total máximo de 80. Conquistas são geradas a partir dessas atividades. O comentário sobre o site é associado à conta, não é exibido publicamente e pode ser atualizado; não altera a pontuação. Esse nível não valida identidade, confiabilidade ou segurança de uma pessoa.

Não envie URLs RTSP, senhas, chaves, CIDRs internos ou documentos de BO em chamados/chat. Configure-os diretamente no servidor autorizado. A aplicação não consulta uma autoridade externa para validar a autenticidade do BO.

## Limitações antes do uso com pessoas reais

Contatos, grupos e mensagens continuam protótipos locais. As câmeras RTSP do backend são privadas ao proprietário; compartilhamento público/de contatos não está integrado à autorização de streams. Os cadastros antigos locais não se tornam automaticamente câmeras reais. O arquivo anexado é validado por formato/tamanho, mas não é verificado junto a uma autoridade externa.

O MediaMTX e o equipamento não foram instalados/conectados neste ambiente, então não foram verificados RTSP/ONVIF, transmissão ao vivo, gravação, armazenamento, retenção ou reprodução de uma câmera física. Teste essas funções em rede privada autorizada antes da implantação. Não compartilhe streams privados publicamente.

## Estrutura principal

- `public/index.html` — aplicação web.
- `public/guardian.css` — estilos responsivos.
- `public/guardian.js` — interações de protótipo.
- `server.js` e `src/routes/` — backend Express e APIs autenticadas.
- `src/services/cameraSecurity.js` — validação de rede e cifragem das credenciais RTSP.
- `src/services/mediaMtx.js` — Control API, HLS e retenção MediaMTX.

## Próximos passos recomendados

1. Instalar/configurar MediaMTX e definir a rede autorizada, credenciais administrativas e IDs dos revisores no servidor.
2. Testar com o modelo/firmware real de câmera e verificar os fluxos de live, gravação, filtros, download e expiração de 30 dias.
3. Adicionar controles de auditoria e monitoramento do cadastro de BO antes de uso comunitário.
4. Implementar autorização por contato/grupo caso streams venham a ser compartilhados.
5. Executar revisão de segurança, backup/rotação da chave de criptografia e testes de carga/armazenamento antes de publicar.
