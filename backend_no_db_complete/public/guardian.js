(() => {
  'use strict';
  const $ = (s) => document.querySelector(s),
    $$ = (s) => [...document.querySelectorAll(s)];
  const STORE = 'guardian-v2';
  const defaultSettings = {
    profileVisible: {
      label: 'Perfil visível para contatos',
      description: 'Permitir que pessoas da sua rede vejam seu perfil.',
      value: true,
    },
    notifications: {
      label: 'Notificações de segurança',
      description: 'Receber alertas e atualizações importantes.',
      value: true,
    },
    privacyMode: {
      label: 'Modo de privacidade',
      description: 'Restringir detalhes públicos do seu perfil.',
      value: true,
    },
    cameraSharing: {
      label: 'Compartilhamento de câmeras',
      description: 'Permitir que contatos autorizados vejam suas câmeras.',
      value: true,
    },
    emergencyAlerts: {
      label: 'Alertas de emergência',
      description: 'Receber avisos imediatos de risco e emergência.',
      value: true,
    },
  };
  let state = {
    user: null,
    cameras: [],
    contacts: [],
    groups: [],
    conversations: [],
    activeChat: null,
    view: 'overview',
    contactTab: 'contacts',
    feed: [],
    communityFeed: [],
    alerts: [],
    achievements: [],
    reputation: null,
    settings: {},
  };
  let toastTimer;
  let cameraReportData = null;
  let cameraReportTarget = null;
  let liveHlsPlayer = null;
  const feedMediaUrls = new Set();
  const safe = (v = '') =>
    String(v).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const load = () => {
    try {
      return JSON.parse(localStorage.getItem(STORE) || '{}');
    } catch {
      return {};
    }
  };
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
  }
  function openModal(id) {
    $('#' + id).classList.remove('hidden');
  }
  function closeModal(id) {
    $('#' + id).classList.add('hidden');
    if (id === 'liveCameraModal') {
      liveHlsPlayer?.destroy();
      liveHlsPlayer = null;
      const player = $('#liveCameraPlayer');
      player.pause();
      player.removeAttribute('src');
      player.load();
    }
  }
  function showAuth(register = false) {
    $('#authScreen').classList.remove('hidden');
    $('#app').classList.add('hidden');
    $('#loginForm').classList.toggle('hidden', register);
    $('#registerForm').classList.toggle('hidden', !register);
    $('#authEyebrow').textContent = register
      ? 'COMECE SUA REDE DE CONFIANÇA'
      : 'BEM-VINDO DE VOLTA';
    $('#authTitle').textContent = register ? 'Crie sua conta' : 'Entre na sua conta';
    $('#authSub').textContent = register
      ? 'Crie seu espaço de segurança no Guardian.'
      : 'Acesse seu espaço de segurança.';
    $('#switchText').textContent = register ? 'Já tem uma conta?' : 'Ainda não tem uma conta?';
    $('#switchAuth').textContent = register ? 'Entrar' : 'Criar conta';
    $('#authError').textContent = '';
  }
  $('#switchAuth').onclick = () => showAuth($('#registerForm').classList.contains('hidden'));
  async function authRequest(path, data) {
    const res = await fetch('/api/auth/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    let d = {};
    try {
      d = await res.json();
    } catch {}
    if (!res.ok) throw Error(d.error || d.message || 'Não foi possível concluir.');
    return d;
  }
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const b = e.currentTarget.querySelector('button');
    b.disabled = true;
    b.textContent = 'Entrando…';
    try {
      const d = await authRequest('login', { email: f.get('email'), password: f.get('password') });
      state.user = d.usuario;
      state.user.token = d.token;
      startApp();
    } catch (err) {
      $('#authError').textContent =
        err.message + ' Se o backend não estiver iniciado, confira as instruções do README.';
    } finally {
      b.disabled = false;
      b.innerHTML = 'Entrar <span>→</span>';
    }
  });
  $('#registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const b = e.currentTarget.querySelector('button');
    b.disabled = true;
    try {
      const d = await authRequest('register', {
        name: f.get('name'),
        email: f.get('email'),
        cpf: f.get('cpf'),
        birthdate: f.get('birthdate'),
        password: f.get('password'),
      });
      state.user = d.usuario;
      state.user.token = d.token;
      startApp();
    } catch (err) {
      $('#authError').textContent = err.message;
    } finally {
      b.disabled = false;
    }
  });
  function currentKey() {
    return 'guardian-data-' + (state.user?.id || state.user?.email || 'guest');
  }
  function startApp() {
    const old = load();
    old.user = state.user;
    const data = old[currentKey()] || {};
    data.cameras = (data.cameras || []).map(({ streamUrl, ...camera }) => camera);
    old[currentKey()] = data;
    localStorage.setItem(STORE, JSON.stringify(old));
    state.cameras = data.cameras;
    state.contacts = data.contacts || [];
    state.groups = data.groups || [];
    state.conversations = data.conversations || [];
    state.feed = data.feed || [];
    state.communityFeed = [];
    state.alerts = data.alerts || [];
    state.achievements = [];
    state.reputation = null;
    state.settings = { ...defaultSettings, ...(data.settings || {}) };
    state.activeChat = null;
    $('#authScreen').classList.add('hidden');
    $('#app').classList.remove('hidden');
    const name = state.user?.name || state.user?.email?.split('@')[0] || 'Usuário';
    $('#userName').textContent = name;
    $('#userEmail').textContent = state.user?.email || '';
    $('#userAvatar').textContent = name.trim().charAt(0).toUpperCase();
    $('#topAvatar').textContent = name.trim().charAt(0).toUpperCase();
    $('#reputationLevel').textContent = 'Calculando nível...';
    $('#reputationSummary').textContent = 'Carregando atividades da sua conta.';
    $('#reputationScore').textContent = '0';
    $('#reputationRing').setAttribute('aria-label', 'Pontuação 0');
    $('#siteFeedbackComment').value = '';
    $('#siteFeedbackStatus').textContent =
      'Seu comentário fica associado à conta e não altera a pontuação de reputação.';
    $('#todayDate').textContent = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date());
    renderAll();
    showView('overview');
    loadServerCameras();
    loadReputation();
    loadSiteFeedback();
  }
  function persist() {
    const root = load();
    root.user = state.user;
    root[currentKey()] = {
      cameras: state.cameras
        .filter((camera) => !camera.serverManaged)
        .map(({ streamUrl, rtspUrl, ...camera }) => camera),
      contacts: state.contacts,
      groups: state.groups,
      conversations: state.conversations,
      feed: state.feed,
      alerts: state.alerts,
      achievements: state.achievements,
      settings: state.settings,
    };
    localStorage.setItem(STORE, JSON.stringify(root));
  }
  function authHeaders(extra = {}) {
    return { ...extra, Authorization: `Bearer ${state.user?.token || ''}` };
  }
  async function loadServerCameras() {
    try {
      const response = await fetch('/api/cameras', { headers: authHeaders() });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar as câmeras.');
      const localCameras = state.cameras.filter((camera) => !camera.serverManaged);
      state.cameras = [
        ...localCameras,
        ...result.map((camera) => ({
          ...camera,
          serverManaged: true,
          status:
            camera.releaseStatus === 'approved'
              ? 'Liberada automaticamente · privada'
              : 'Aguardando análise',
          report: { number: camera.reportNumber, date: String(camera.reportDate).slice(0, 10) },
        })),
      ];
      renderAll();
      renderRecordingCameras();
      if (state.view === 'recordings') loadRecordings();
    } catch (error) {
      toast(error.message || 'Não foi possível carregar as câmeras do servidor.');
    }
  }
  async function loadReputation() {
    try {
      const response = await fetch('/api/reputation', { headers: authHeaders() });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível calcular a reputação.');
      state.reputation = result;
      state.achievements = result.achievements || [];
      renderStats();
      renderFeed();
    } catch (error) {
      $('#reputationLevel').textContent = 'Nível indisponível';
      $('#reputationSummary').textContent =
        error.message || 'Não foi possível carregar sua atividade.';
    }
  }
  async function loadSiteFeedback() {
    try {
      const response = await fetch('/api/reputation/feedback', { headers: authHeaders() });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'Não foi possível carregar seu comentário.');
      if (result?.comment) {
        $('#siteFeedbackComment').value = result.comment;
        $('#siteFeedbackStatus').textContent =
          'Seu último comentário está salvo. Você pode editá-lo.';
      }
    } catch (error) {
      $('#siteFeedbackStatus').textContent =
        error.message || 'Não foi possível carregar seu comentário.';
    }
  }
  function showView(view) {
    state.view = view;
    $$('.view').forEach((v) => v.classList.add('hidden'));
    $('#view-' + view).classList.remove('hidden');
    $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    const labels = {
      overview: ['Visão geral', 'Bom ter você por aqui ✦'],
      feed: ['Feed', 'Comunidade em movimento'],
      alerts: ['Alertas', 'Seu radar de risco'],
      map: ['Mapa de câmeras', 'Mapa da comunidade'],
      cameras: ['Minhas câmeras', 'Suas câmeras, seu controle'],
      recordings: ['Transmissões e gravações', 'Vídeo privado, acesso autorizado'],
      messages: ['Mensagens', 'Converse com sua comunidade'],
      contacts: ['Contatos e grupos', 'Sua rede de confiança'],
      settings: ['Configurações', 'Sua conta, sua segurança'],
    };
    $('#pageCrumb').textContent = labels[view][0];
    $('#pageTitle').textContent = labels[view][1];
    if (view === 'messages') renderConversations();
    if (view === 'map') renderPublicCameras();
    if (view === 'contacts') renderContacts();
    if (view === 'feed') {
      renderFeed();
      loadCommunityFeed();
      loadReputation();
      loadSiteFeedback();
    }
    if (view === 'alerts') renderAlerts();
    if (view === 'recordings') {
      renderRecordingCameras();
      loadRecordings();
    }
    if (view === 'settings') renderSettings();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $$('[data-view]').forEach((b) => (b.onclick = () => showView(b.dataset.view)));
  $$('[data-goto]').forEach((b) => (b.onclick = () => showView(b.dataset.goto)));
  $('#logoutBtn').onclick = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    state.user = null;
    const saved = load();
    delete saved.user;
    localStorage.setItem(STORE, JSON.stringify(saved));
    showAuth(false);
  };
  function renderAll() {
    renderStats();
    renderCameras();
    renderPublicCameras();
    renderContacts();
    renderConversations();
    renderFeed();
    renderAlerts();
    renderSettings();
  }
  function renderStats() {
    $('#statCameras').textContent = state.cameras.length;
    $('#cameraCount').textContent = state.cameras.length;
    $('#statContacts').textContent = state.contacts.length;
    $('#statGroups').textContent = state.groups.length;
    $('#statShares').textContent = state.cameras.filter((c) => (c.sharedWith || []).length).length;
    const pub = state.cameras.filter((c) => c.isPublic && c.releaseStatus === 'approved');
    $('#mapCameraText').textContent = pub.length
      ? `· ${pub.length} câmera(s) publicada(s)`
      : '· Nenhuma câmera publicada';
    $('#mapEmpty').classList.toggle('hidden', pub.length > 0);
    const reputation = state.reputation;
    if (reputation) {
      $('#reputationLevel').textContent = `Nível ${reputation.level}`;
      $('#reputationSummary').textContent =
        `${reputation.communityPosts} publicações · ${reputation.cameras} câmeras cadastradas.`;
      $('#reputationScore').textContent = reputation.score;
      $('#reputationRing').setAttribute('aria-label', `Pontuação ${reputation.score}`);
    }
  }
  function cameraCard(c, owned = false) {
    const needsApproval = c.releaseStatus !== 'approved';
    const managed = c.serverManaged === true;
    const releaseLabel =
      c.releaseStatus === 'pending'
        ? 'Em análise'
        : c.releaseStatus === 'reviewing'
          ? 'Análise em andamento'
          : c.releaseStatus === 'approved'
            ? 'Liberada · privada'
            : c.releaseStatus === 'not_requested'
              ? 'BO informado'
              : 'BO obrigatório';
    const accessStatus = needsApproval
      ? `<span class="pill pending">${safe(releaseLabel)}</span>`
      : `<span class="pill ${!managed && c.isPublic ? 'public' : 'private'}">${!managed && c.isPublic ? '● Pública no mapa' : '🔒 Privada'}</span>`;
    const actions = owned
      ? `<div class="camera-actions">
          ${managed ? `<button class="mini-btn" data-camera-recordings="${safe(c.id)}">Gravações</button>` : ''}
          ${managed && !needsApproval ? `<button class="btn primary small" data-camera-live="${safe(c.id)}">Ao vivo</button><a class="mini-btn" href="/api/cameras/${encodeURIComponent(c.id)}/report-evidence">BO anexado</a>` : ''}
          ${
            !managed && c.releaseStatus === 'not_requested'
              ? `<button class="btn primary small" data-camera-release="${safe(c.id)}">Solicitar liberação</button>`
              : !managed && !c.releaseStatus
                ? `<button class="btn primary small" data-camera-report="${safe(c.id)}">Informar BO e solicitar liberação</button>`
                : ''
          }
          ${
            !managed && !needsApproval
              ? `<button class="mini-btn" data-camera-share="${safe(c.id)}">Compartilhar</button><button class="mini-btn" data-camera-toggle="${safe(c.id)}">${c.isPublic ? 'Tornar privada' : 'Publicar no mapa'}</button>`
              : ''
          }
          <button class="mini-btn danger" data-camera-delete="${safe(c.id)}">Excluir</button>
        </div>
        ${
          needsApproval
            ? `<p class="camera-review-note">${managed ? 'O acesso ao stream é privado ao proprietário. O envio do BO não verifica a autenticidade do documento.' : 'Câmera de cadastro local. Para transmitir, cadastre-a novamente com um endereço RTSP e o BO.'}</p>`
            : ''
        }`
      : '';
    return `<article class="camera-card"><div class="camera-symbol">▣</div><div class="camera-info"><h3>${safe(c.name)}</h3><p>⌖ ${safe(c.location || 'Local não informado')}</p><div class="camera-meta">${accessStatus}<span class="pill">${safe(c.status || 'Cadastrada')}</span>${owned && (c.report?.number || c.reportNumber) ? `<span class="pill">BO ${safe(c.report?.number || c.reportNumber)}</span>` : ''}</div>${actions}</div></article>`;
  }
  function renderCameras() {
    const list = $('#myCameraList');
    list.innerHTML = state.cameras.map((c) => cameraCard(c, true)).join('');
    $('#emptyCameras').classList.toggle('hidden', state.cameras.length > 0);
    $('#statCameras').textContent = state.cameras.length;
    list.querySelectorAll('[data-camera-toggle]').forEach(
      (b) =>
        (b.onclick = () => {
          const c = state.cameras.find((x) => String(x.id) === b.dataset.cameraToggle);
          if (c.releaseStatus !== 'approved') {
            toast('A câmera precisa ser liberada antes de ser publicada.');
            return;
          }
          c.isPublic = !c.isPublic;
          persist();
          renderAll();
          toast(c.isPublic ? 'Câmera publicada no mapa.' : 'Câmera removida do mapa público.');
        })
    );
    list.querySelectorAll('[data-camera-delete]').forEach(
      (b) =>
        (b.onclick = async () => {
          if (confirm('Excluir esta câmera do seu painel?')) {
            const camera = state.cameras.find((item) => String(item.id) === b.dataset.cameraDelete);
            if (camera?.serverManaged) {
              try {
                const response = await fetch(`/api/cameras/${encodeURIComponent(camera.id)}`, {
                  method: 'DELETE',
                  headers: authHeaders(),
                });
                if (!response.ok) {
                  const result = await response.json();
                  throw new Error(result.error || 'Não foi possível excluir a câmera.');
                }
              } catch (error) {
                toast(error.message || 'Não foi possível excluir a câmera.');
                return;
              }
            }
            state.cameras = state.cameras.filter((c) => String(c.id) !== b.dataset.cameraDelete);
            persist();
            renderAll();
            toast('Câmera excluída.');
          }
        })
    );
    list
      .querySelectorAll('[data-camera-share]')
      .forEach((b) => (b.onclick = () => openShareModal(b.dataset.cameraShare)));
    list.querySelectorAll('[data-camera-release]').forEach(
      (b) =>
        (b.onclick = () => {
          const c = state.cameras.find((camera) => String(camera.id) === b.dataset.cameraRelease);
          if (!c || c.releaseStatus !== 'not_requested') return;
          c.releaseStatus = 'pending';
          c.status = 'Aguardando análise';
          c.releaseRequestedAt = new Date().toISOString();
          persist();
          renderAll();
          toast(
            'Solicitação registrada neste dispositivo; a análise exige integração com o servidor.'
          );
        })
    );
    list
      .querySelectorAll('[data-camera-report]')
      .forEach((button) => (button.onclick = () => openCameraModal(button.dataset.cameraReport)));
    list
      .querySelectorAll('[data-camera-live]')
      .forEach((button) => (button.onclick = () => openLiveCamera(button.dataset.cameraLive)));
    list
      .querySelectorAll('[data-camera-recordings]')
      .forEach(
        (button) => (button.onclick = () => openCameraRecordings(button.dataset.cameraRecordings))
      );
  }
  function renderPublicCameras() {
    const q = ($('#mapSearch')?.value || '').toLowerCase();
    const pub = state.cameras.filter(
      (c) =>
        c.isPublic &&
        c.releaseStatus === 'approved' &&
        `${c.name} ${c.location}`.toLowerCase().includes(q)
    );
    $('#publicCameraTotal').textContent = pub.length + ' câmera(s) pública(s)';
    $('#publicCameraList').innerHTML = pub.map((c) => cameraCard(c, false)).join('');
    if (
      pub.length === 1 &&
      Number.isFinite(Number(pub[0].latitude)) &&
      Number.isFinite(Number(pub[0].longitude))
    )
      $('#googleMap').src =
        `https://maps.google.com/maps?q=${encodeURIComponent(pub[0].latitude + ',' + pub[0].longitude)}&z=15&output=embed`;
    else if (q && pub.length === 0)
      $('#googleMap').src = `https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
    else if (!q && pub.length === 0)
      $('#googleMap').src = 'https://maps.google.com/maps?q=Brasil&z=5&output=embed';
  }
  function approvedServerCameras() {
    return state.cameras.filter(
      (camera) => camera.serverManaged && camera.releaseStatus !== 'rejected'
    );
  }
  function renderRecordingCameras(selectedId) {
    const select = $('#recordingCameraFilter');
    if (!select) return;
    const previous = selectedId || select.value;
    const cameras = approvedServerCameras();
    select.innerHTML = cameras
      .map((camera) => `<option value="${safe(camera.id)}">${safe(camera.name)}</option>`)
      .join('');
    select.disabled = cameras.length === 0;
    if (cameras.some((camera) => String(camera.id) === String(previous))) select.value = previous;
    if (!cameras.length) {
      $('#recordingsMessage').textContent =
        'Nenhuma câmera sua está disponível para consultar gravações.';
      $('#recordingList').replaceChildren();
    }
  }
  async function loadRecordings() {
    const cameraId = $('#recordingCameraFilter').value;
    const message = $('#recordingsMessage');
    const list = $('#recordingList');
    if (!cameraId) {
      message.textContent = 'Selecione uma câmera sua para consultar gravações disponíveis.';
      list.replaceChildren();
      return;
    }
    message.textContent = 'Buscando gravações...';
    list.replaceChildren();
    const query = new URLSearchParams();
    for (const [field, parameter] of [
      ['recordingFrom', 'from'],
      ['recordingTo', 'to'],
      ['recordingTimeFrom', 'timeFrom'],
      ['recordingTimeTo', 'timeTo'],
    ]) {
      const value = $('#' + field).value;
      if (value) query.set(parameter, value);
    }
    try {
      const response = await fetch(
        `/api/cameras/${encodeURIComponent(cameraId)}/recordings?${query}`,
        { headers: authHeaders() }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar as gravações.');
      if (!result.length) {
        message.textContent = 'Nenhuma gravação encontrada para os filtros selecionados.';
        return;
      }
      message.textContent = `${result.length} gravação(ões) encontrada(s).`;
      list.innerHTML = result
        .map(
          (recording) => `
            <article class="recording-item">
              <div>
                <strong>${safe(recording.date)} · ${safe(recording.time)}</strong>
                <small>${(recording.sizeBytes / (1024 * 1024)).toFixed(1)} MB</small>
              </div>
              <div class="recording-actions">
                <button class="btn secondary small" data-play-recording="${safe(recording.downloadUrl)}" data-recording-label="${safe(recording.date)} ${safe(recording.time)}">Reproduzir</button>
                <a class="mini-btn" href="${safe(recording.downloadUrl)}?download=1">Baixar</a>
              </div>
            </article>
          `
        )
        .join('');
      list.querySelectorAll('[data-play-recording]').forEach((button) => {
        button.onclick = () => {
          const player = $('#recordingPlayer');
          player.pause();
          player.src = button.dataset.playRecording;
          player.load();
          $('#recordingPlayerTitle').textContent = `Gravação · ${button.dataset.recordingLabel}`;
          $('#recordingPlayerWrap').classList.remove('hidden');
          player.play().catch(() => {
            $('#recordingsMessage').textContent =
              'A gravação foi carregada. Pressione Reproduzir no player para iniciar.';
          });
        };
      });
    } catch (error) {
      message.textContent = error.message || 'Falha ao carregar as gravações.';
    }
  }
  async function openLiveCamera(cameraId) {
    const camera = state.cameras.find(
      (item) => item.serverManaged && String(item.id) === String(cameraId)
    );
    if (!camera || camera.releaseStatus !== 'approved') return;
    const video = $('#liveCameraPlayer');
    const status = $('#liveCameraStatus');
    $('#liveCameraTitle').textContent = camera.name;
    status.textContent = 'Verificando conexão autorizada...';
    video.pause();
    video.removeAttribute('src');
    video.load();
    liveHlsPlayer?.destroy();
    liveHlsPlayer = null;
    openModal('liveCameraModal');
    try {
      const response = await fetch(`/api/cameras/${encodeURIComponent(camera.id)}/status`, {
        headers: authHeaders(),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível verificar a conexão.');
      if (result.status !== 'online') {
        status.textContent = 'Câmera aprovada, mas sem transmissão ativa no momento.';
        return;
      }
      const source = `/api/cameras/${encodeURIComponent(camera.id)}/live/index.m3u8`;
      const HlsPlayer = window.Hls;
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = source;
      } else if (HlsPlayer?.isSupported()) {
        liveHlsPlayer = new HlsPlayer({ enableWorker: true });
        liveHlsPlayer.on(HlsPlayer.Events.ERROR, (_event, data) => {
          if (data.fatal) status.textContent = 'Não foi possível reproduzir este fluxo HLS.';
        });
        liveHlsPlayer.loadSource(source);
        liveHlsPlayer.attachMedia(video);
      } else {
        status.textContent = 'Este navegador não oferece suporte à reprodução HLS.';
        return;
      }
      status.textContent = 'Transmissão privada conectada. O acesso é restrito ao proprietário.';
    } catch (error) {
      status.textContent = error.message || 'Não foi possível abrir a transmissão.';
    }
  }
  function openCameraRecordings(cameraId) {
    renderRecordingCameras(cameraId);
    showView('recordings');
  }
  $('#mapSearch').addEventListener('input', renderPublicCameras);
  $('#refreshMap').onclick = () => {
    renderPublicCameras();
    toast('Mapa atualizado.');
  };
  function setCameraStep(step) {
    const reportStep = $('#cameraReportStep');
    const detailsStep = $('#cameraDetailsStep');
    reportStep.classList.toggle('hidden', step !== 1);
    detailsStep.classList.toggle('hidden', step !== 2);
    reportStep.querySelectorAll('input, button').forEach((control) => {
      control.disabled = step !== 1;
    });
    detailsStep.querySelectorAll('input, button').forEach((control) => {
      control.disabled = step !== 2;
    });
    $$('[data-step-indicator]').forEach((indicator) => {
      const active = Number(indicator.dataset.stepIndicator) === step;
      indicator.classList.toggle('active', active);
      indicator.classList.toggle('complete', Number(indicator.dataset.stepIndicator) < step);
    });
  }
  function openCameraModal(cameraId) {
    $('#cameraError').textContent = '';
    $('#cameraDetailsError').textContent = '';
    $('#cameraForm').reset();
    cameraReportData = null;
    cameraReportTarget = cameraId
      ? state.cameras.find((camera) => String(camera.id) === String(cameraId)) || null
      : null;
    $('#cameraModalTitle').textContent = cameraReportTarget
      ? 'Adicionar BO à câmera'
      : 'Cadastrar câmera';
    $('#cameraSubmitButton').textContent = cameraReportTarget
      ? 'Salvar BO e liberar acesso privado'
      : 'Cadastrar e liberar acesso privado';
    if (cameraReportTarget) {
      $('#cameraForm').elements.name.value = cameraReportTarget.name || '';
      $('#cameraForm').elements.location.value = cameraReportTarget.location || '';
      $('#cameraForm').elements.latitude.value = cameraReportTarget.latitude ?? '';
      $('#cameraForm').elements.longitude.value = cameraReportTarget.longitude ?? '';
    }
    setCameraStep(1);
    openModal('cameraModal');
  }
  $('#openCameraModal').onclick = $('#emptyAddCamera').onclick = () => openCameraModal();
  $('#continueCameraForm').onclick = () => {
    const form = $('#cameraForm');
    const reportNumber = form.elements.boNumber.value.trim();
    const reportDate = form.elements.boDate.value;
    const reportFile = form.elements.reportFile.files[0];
    const error = $('#cameraError');
    error.textContent = '';
    if (!reportNumber || !reportDate) {
      error.textContent = 'Informe o número e a data do BO para continuar.';
      return;
    }
    if (new Date(reportDate) > new Date(new Date().toDateString())) {
      error.textContent = 'A data do BO não pode estar no futuro.';
      return;
    }
    if (!reportFile) {
      error.textContent = 'Anexe o BO em PDF, JPG, PNG, WebP, MP4 ou WebM.';
      return;
    }
    if (reportFile.size > 10 * 1024 * 1024) {
      error.textContent = 'O arquivo do BO deve ter até 10 MB.';
      return;
    }
    if (
      ![
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'video/mp4',
        'video/webm',
      ].includes(reportFile.type)
    ) {
      error.textContent = 'Escolha um arquivo PDF, JPG, PNG, WebP, MP4 ou WebM.';
      return;
    }
    cameraReportData = { number: reportNumber, date: reportDate };
    setCameraStep(2);
  };
  $('#backCameraForm').onclick = () => {
    cameraReportData = null;
    $('#cameraDetailsError').textContent = '';
    setCameraStep(1);
  };
  $('#searchRecordings').onclick = loadRecordings;
  $('#recordingCameraFilter').addEventListener('change', loadRecordings);
  $('#closeRecordingPlayer').onclick = () => {
    const player = $('#recordingPlayer');
    player.pause();
    player.removeAttribute('src');
    player.load();
    $('#recordingPlayerWrap').classList.add('hidden');
  };
  $('#cameraForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#cameraDetailsError').textContent = '';
    if (!cameraReportData) {
      setCameraStep(1);
      $('#cameraError').textContent = 'Preencha primeiro os dados do boletim de ocorrência.';
      return;
    }
    const f = new FormData(e.currentTarget);
    const reportFile = e.currentTarget.elements.reportFile.files[0];
    const latitude = f.get('latitude') ? Number(f.get('latitude')) : null;
    const longitude = f.get('longitude') ? Number(f.get('longitude')) : null;
    if ((latitude === null) !== (longitude === null)) {
      $('#cameraDetailsError').textContent =
        'Informe latitude e longitude juntas ou deixe ambas vazias.';
      return;
    }
    if (!window.isSecureContext) {
      $('#cameraDetailsError').textContent =
        'Use HTTPS para enviar as credenciais da câmera com segurança.';
      return;
    }
    const submitButton = $('#cameraSubmitButton');
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando e liberando acesso privado…';
    try {
      const reportData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('Não foi possível ler o arquivo do BO.'));
        reader.readAsDataURL(reportFile);
      });
      const response = await fetch('/api/cameras', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name: String(f.get('name') || '').trim(),
          location: String(f.get('location') || '').trim(),
          latitude,
          longitude,
          reportNumber: cameraReportData.number,
          reportDate: cameraReportData.date,
          reportEvidence: {
            fileName: reportFile.name,
            mimeType: reportFile.type,
            data: reportData,
          },
          rtspUrl: String(f.get('rtspUrl') || '').trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível cadastrar a câmera.');
      const camera = {
        ...result,
        serverManaged: true,
        status: 'Liberada automaticamente · privada',
        report: { number: result.reportNumber, date: String(result.reportDate).slice(0, 10) },
      };
      if (cameraReportTarget && !cameraReportTarget.serverManaged) {
        state.cameras = state.cameras.filter(
          (existing) => String(existing.id) !== String(cameraReportTarget.id)
        );
      }
      state.cameras.unshift(camera);
      cameraReportTarget = null;
      cameraReportData = null;
      persist();
      renderAll();
      closeModal('cameraModal');
      showView('cameras');
      loadReputation();
      toast('Câmera liberada para sua conta. O stream continua privado.');
    } catch (error) {
      $('#cameraDetailsError').textContent =
        error.message || 'Não foi possível cadastrar a câmera.';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Cadastrar e liberar acesso privado';
    }
  });
  $$('[data-close]').forEach((b) => (b.onclick = () => closeModal(b.dataset.close)));
  $$('.modal-backdrop').forEach((m) =>
    m.addEventListener('click', (event) => {
      if (event.target === m) closeModal(m.id);
    })
  );
  $('#addContactBtn').onclick = $('#emptyAddContact').onclick = () => {
    $('#contactError').textContent = '';
    $('#contactForm').reset();
    openModal('contactModal');
  };
  $('#contactForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get('email').trim().toLowerCase();
    if (email === state.user?.email?.toLowerCase()) {
      $('#contactError').textContent = 'Você já é o próprio titular desta conta.';
      return;
    }
    if (state.contacts.some((c) => c.email.toLowerCase() === email)) {
      $('#contactError').textContent = 'Este contato já está na sua lista.';
      return;
    }
    const name = email
      .split('@')[0]
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, (x) => x.toUpperCase());
    state.contacts.push({ id: Date.now(), name, email, status: 'Convite enviado' });
    persist();
    renderContacts();
    renderStats();
    closeModal('contactModal');
    toast(
      'Contato adicionado à sua lista local. A validação com outros usuários exige API de contatos.'
    );
  });
  function renderContacts() {
    const q = ($('#contactSearch')?.value || '').toLowerCase();
    const list = state.contacts.filter((c) => (c.name + ' ' + c.email).toLowerCase().includes(q));
    $('#contactCountLabel').textContent = state.contacts.length + ' contatos';
    $('#contactList').innerHTML = list
      .map(
        (c) =>
          `<article class="person-card"><span class="avatar">${safe(c.name[0] || '?')}</span><h3>${safe(c.name)}</h3><p>${safe(c.email)}</p><div class="person-actions"><button class="btn primary small" data-chat-contact="${c.id}">Mensagem</button><button class="mini-btn" data-contact-remove="${c.id}">Remover</button></div></article>`
      )
      .join('');
    $('#emptyContacts').classList.toggle('hidden', state.contacts.length > 0);
    $('#contactsPane').classList.toggle('hidden', state.contactTab !== 'contacts');
    $('#groupsPane').classList.toggle('hidden', state.contactTab !== 'groups');
    $('#groupList').innerHTML = state.groups
      .map(
        (g) =>
          `<article class="person-card"><span class="avatar">◉</span><h3>${safe(g.name)}</h3><p>${safe(g.description || 'Grupo privado')}</p><div class="group-members">${g.members.length} participante(s)</div><div class="person-actions"><button class="btn primary small" data-chat-group="${g.id}">Abrir conversa</button><button class="mini-btn danger" data-group-remove="${g.id}">Excluir</button></div></article>`
      )
      .join('');
    $('#emptyGroups').classList.toggle('hidden', state.groups.length > 0);
    $('#contactList')
      .querySelectorAll('[data-chat-contact]')
      .forEach(
        (b) =>
          (b.onclick = () => {
            const c = state.contacts.find((c) => String(c.id) === b.dataset.chatContact);
            const conv = ensureConversation('contact', c.id, c.name);
            state.activeChat = conv.id;
            persist();
            showView('messages');
            renderConversations();
            openChat(conv.id);
          })
      );
    $('#contactList')
      .querySelectorAll('[data-contact-remove]')
      .forEach(
        (b) =>
          (b.onclick = () => {
            state.contacts = state.contacts.filter((c) => String(c.id) !== b.dataset.contactRemove);
            persist();
            renderContacts();
            renderStats();
          })
      );
    $('#groupList')
      .querySelectorAll('[data-chat-group]')
      .forEach(
        (b) =>
          (b.onclick = () => {
            const g = state.groups.find((g) => String(g.id) === b.dataset.chatGroup);
            const conv = ensureConversation('group', g.id, g.name);
            state.activeChat = conv.id;
            persist();
            showView('messages');
            renderConversations();
            openChat(conv.id);
          })
      );
    $('#groupList')
      .querySelectorAll('[data-group-remove]')
      .forEach(
        (b) =>
          (b.onclick = () => {
            state.groups = state.groups.filter((g) => String(g.id) !== b.dataset.groupRemove);
            persist();
            renderContacts();
            renderStats();
          })
      );
  }
  $$('[data-tab]').forEach(
    (b) =>
      (b.onclick = () => {
        state.contactTab = b.dataset.tab;
        $$('[data-tab]').forEach((t) => t.classList.toggle('active', t === b));
        renderContacts();
      })
  );
  $('#contactSearch').addEventListener('input', renderContacts);
  function openGroupModal() {
    if (!state.contacts.length) {
      toast('Adicione contatos antes de criar um grupo.');
      openModal('contactModal');
      return;
    }
    $('#groupForm').reset();
    $('#groupError').textContent = '';
    $('#groupMembers').innerHTML = state.contacts
      .map((c) => `<option value="${c.id}">${safe(c.name)} — ${safe(c.email)}</option>`)
      .join('');
    openModal('groupModal');
  }
  $('#createGroupBtn').onclick = $('#emptyCreateGroup').onclick = openGroupModal;
  $('#groupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const members = [...$('#groupMembers').selectedOptions].map((o) => Number(o.value));
    const g = {
      id: Date.now(),
      name: f.get('name').trim(),
      description: f.get('description').trim(),
      members,
      createdAt: new Date().toISOString(),
    };
    state.groups.unshift(g);
    const conv = ensureConversation('group', g.id, g.name);
    state.activeChat = conv.id;
    persist();
    renderContacts();
    renderStats();
    closeModal('groupModal');
    showView('messages');
    renderConversations();
    openChat(conv.id);
    toast('Grupo criado neste dispositivo.');
  });
  function ensureConversation(type, ref, name) {
    let c = state.conversations.find((x) => x.type === type && String(x.ref) === String(ref));
    if (!c) {
      c = { id: Date.now() + Math.random(), type, ref, name, messages: [] };
      state.conversations.unshift(c);
    }
    return c;
  }
  function renderConversations() {
    const q = ($('#conversationSearch')?.value || '').toLowerCase();
    const list = state.conversations.filter((c) => c.name.toLowerCase().includes(q));
    $('#conversationItems').innerHTML =
      list
        .map(
          (c) =>
            `<button class="conversation-item ${String(c.id) === String(state.activeChat) ? 'active' : ''}" data-open-chat="${c.id}"><span class="avatar">${c.type === 'group' ? '◉' : safe(c.name[0] || '?')}</span><span><b>${safe(c.name)}</b><small>${safe(c.messages.at(-1)?.text || (c.type === 'group' ? 'Grupo privado' : 'Conversa privada'))}</small></span></button>`
        )
        .join('') ||
      '<div class="empty-inline">Nenhuma conversa ainda.<br>Adicione um contato ou crie um grupo.</div>';
    $('#conversationItems')
      .querySelectorAll('[data-open-chat]')
      .forEach((b) => (b.onclick = () => openChat(b.dataset.openChat)));
  }
  $('#conversationSearch').addEventListener('input', renderConversations);
  function openChat(id) {
    const c = state.conversations.find((c) => String(c.id) === String(id));
    if (!c) return;
    state.activeChat = c.id;
    $('#chatEmpty').classList.add('hidden');
    $('#chatActive').classList.remove('hidden');
    $('#chatName').textContent = c.name;
    $('#chatSubtitle').textContent =
      c.type === 'group'
        ? 'Grupo privado · ' +
          (state.groups.find((g) => String(g.id) === String(c.ref))?.members.length || 0) +
          ' participante(s)'
        : 'Conversa privada';
    $('#chatAvatar').textContent = c.type === 'group' ? '◉' : c.name[0] || '?';
    $('#chatMessages').innerHTML = c.messages
      .map(
        (m) =>
          `<div class="message-bubble ${m.mine ? 'mine' : ''}">${safe(m.text)}${m.file ? `<br><a href="${safe(m.file.url)}" target="_blank" rel="noopener">${safe(m.file.name)}</a>` : ''}<small>${safe(m.time)}</small></div>`
      )
      .join('');
    $('#chatMessages').scrollTop = $('#chatMessages').scrollHeight;
    renderConversations();
  }
  $('#messageForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#messageInput');
    const text = input.value.trim();
    if (!text) return;
    const c = state.conversations.find((c) => String(c.id) === String(state.activeChat));
    if (!c) return;
    c.messages.push({
      text,
      mine: true,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    });
    input.value = '';
    persist();
    openChat(c.id);
  });
  $('#attachBtn').onclick = () => $('#mediaInput').click();
  $('#mediaInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const c = state.conversations.find((c) => String(c.id) === String(state.activeChat));
    if (!c) {
      toast('Abra uma conversa antes de anexar arquivos.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast('Arquivo muito grande. O limite local é 25 MB.');
      return;
    }
    const url = URL.createObjectURL(file);
    c.messages.push({
      text: 'Arquivo selecionado (prévia local)',
      file: { name: file.name, url },
      mine: true,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    });
    persist();
    openChat(c.id);
    toast(
      'Prévia do arquivo nesta sessão. Para compartilhar com outras pessoas, é necessário armazenamento de mídia no servidor.'
    );
    e.target.value = '';
  });
  $('#shareCameraBtn').onclick = () => openShareModal();
  function openShareModal(cameraId) {
    const list = state.cameras.filter(
      (camera) => camera.releaseStatus === 'approved' && !camera.serverManaged
    );
    if (!list.length) {
      toast('Só é possível compartilhar câmeras liberadas após a conferência do BO.');
      return;
    }
    $('#shareCameraChoices').innerHTML = list
      .map(
        (c) =>
          `<div class="share-choice"><div><b>${safe(c.name)}</b><small>${safe(c.location)} · ${c.isPublic ? 'Pública' : 'Privada'}</small></div><button class="btn primary small" data-share-select="${c.id}">Compartilhar</button></div>`
      )
      .join('');
    $('#shareCameraChoices')
      .querySelectorAll('[data-share-select]')
      .forEach(
        (b) =>
          (b.onclick = () => {
            const c = state.cameras.find((c) => String(c.id) === b.dataset.shareSelect);
            const conv = state.conversations.find((c) => String(c.id) === String(state.activeChat));
            if (conv) {
              conv.messages.push({
                text: `Câmera compartilhada: ${c.name} — ${c.location}`,
                mine: true,
                time: new Date().toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              });
              persist();
              openChat(conv.id);
            }
            closeModal('shareModal');
            toast('Referência da câmera adicionada à conversa local.');
          })
      );
    openModal('shareModal');
  }
  function renderFeed() {
    const list = $('#feedList');
    if (!list) return;
    feedMediaUrls.forEach((url) => URL.revokeObjectURL(url));
    feedMediaUrls.clear();
    const feed = [...(state.communityFeed || []), ...(state.feed || [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (!feed.length) {
      list.innerHTML = `
        <div class="feed-empty">
          <span class="empty-icon">◎</span>
          <h3>Seu feed começa aqui</h3>
          <p>Compartilhe uma foto, um vídeo ou uma atualização com a comunidade.</p>
        </div>`;
      return;
    }
    list.innerHTML = feed
      .map((item) => {
        const itemId = safe(item.id);
        const isCommunityPost = Boolean(item.userId);
        return `
          <article class="feed-card" data-post-id="${itemId}">
            <div class="feed-head">
              <span class="avatar">${safe((item.author || 'U').trim().charAt(0).toUpperCase())}</span>
              <div>
                <b>${safe(item.author || 'Usuário')}</b>
                <small>${isCommunityPost ? 'Comunidade Guardian' : safe(item.role || 'Sua publicação')}</small>
              </div>
              <span class="tag-badge">${safe(item.category || item.type || 'Comunidade')}</span>
            </div>
            ${item.content || item.text ? `<p>${safe(item.content || item.text)}</p>` : ''}
            ${
              item.media?.length
                ? `<div class="feed-media-viewer" data-media-for="${itemId}">
                    <span class="media-loading">Carregando mídia…</span>
                  </div>`
                : ''
            }
            <div class="feed-post-date">${safe(
              item.createdAt
                ? new Date(item.createdAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Agora'
            )}</div>
            <div class="feed-actions">
              <span>◎ Publicação da comunidade</span>
              ${item.comments?.length ? `<span>💬 ${item.comments.length} comentário(s)</span>` : ''}
            </div>
            <div class="comment-stack">
              ${(item.comments || [])
                .map(
                  (comment) => `
                    <div class="comment-item">
                      <strong>${safe(comment.author || 'Usuário')}</strong>
                      <span>${safe(comment.text)}</span>
                      <small>${safe(comment.time || 'agora')}</small>
                    </div>
                  `
                )
                .join('')}
            </div>
            ${
              !isCommunityPost
                ? `<form class="comment-form" data-feed-comment="${itemId}">
              <input name="comment" maxlength="120" placeholder="Adicionar comentário" aria-label="Adicionar comentário" />
              <button type="submit" class="mini-btn">Enviar</button>
            </form>`
                : ''
            }
          </article>
        `;
      })
      .join('');
    loadFeedMedia();
    const comments = $('#feedComments');
    if (comments) {
      const recentComments = feed.flatMap((item) =>
        (item.comments || []).map((comment) => ({ ...comment, postAuthor: item.author }))
      );
      comments.innerHTML = recentComments.length
        ? recentComments
            .slice(0, 3)
            .map(
              (comment) =>
                `<div class="comment-item"><strong>${safe(comment.author || 'Usuário')}</strong><span>${safe(comment.text)}</span><small>${safe(comment.time || comment.postAuthor || 'agora')}</small></div>`
            )
            .join('')
        : '<div class="empty-inline">Ainda não há comentários.</div>';
    }
    const achievements = $('#miniAchievements');
    if (achievements) {
      achievements.innerHTML = state.achievements?.length
        ? state.achievements
            .map(
              (achievement) =>
                `<div class="mini-badge"><span>${safe(achievement.icon || '✦')}</span><div><strong>${safe(achievement.title)}</strong><small>${safe(achievement.detail)}</small></div></div>`
            )
            .join('')
        : '<div class="empty-inline">Conquistas verificadas aparecerão aqui.</div>';
    }
    $('#feedList')
      ?.querySelectorAll('[data-feed-comment]')
      .forEach((form) => {
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          const input = form.querySelector('input[name="comment"]');
          const text = input.value.trim();
          if (!text) return;
          const id = Number(form.dataset.feedComment);
          const item = state.feed.find((entry) => String(entry.id) === String(id));
          if (!item) return;
          item.comments = item.comments || [];
          item.comments.push({ author: state.user?.name || 'Você', text, time: 'agora' });
          persist();
          renderFeed();
        });
      });
  }

  async function loadCommunityFeed() {
    try {
      const response = await fetch('/api/feed', {
        headers: { Authorization: `Bearer ${state.user?.token || ''}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o feed.');
      state.communityFeed = data;
      renderFeed();
    } catch (error) {
      toast(error.message || 'Falha ao carregar as publicações da comunidade.');
    }
  }

  function loadFeedMedia() {
    $('#feedList')
      ?.querySelectorAll('[data-media-for]')
      .forEach(async (container) => {
        const postId = container.dataset.mediaFor;
        const post = state.communityFeed.find((item) => String(item.id) === postId);
        if (!post) return;
        for (const media of post.media || []) {
          try {
            const response = await fetch(
              `/api/feed/${encodeURIComponent(postId)}/media/${encodeURIComponent(media.id)}`,
              {
                headers: { Authorization: `Bearer ${state.user?.token || ''}` },
              }
            );
            if (!response.ok) throw new Error('Mídia indisponível.');
            const blob = await response.blob();
            if (!container.isConnected) continue;
            const url = URL.createObjectURL(blob);
            feedMediaUrls.add(url);
            const element =
              media.mediaType === 'video'
                ? document.createElement('video')
                : document.createElement('img');
            element.src = url;
            if (element instanceof HTMLVideoElement) {
              element.controls = true;
              element.playsInline = true;
              element.preload = 'metadata';
              element.setAttribute('aria-label', `Vídeo publicado por ${post.author}`);
            } else {
              element.alt = `Foto publicada por ${post.author}`;
              element.loading = 'lazy';
            }
            container.replaceChildren(element);
          } catch {
            container.textContent = 'Não foi possível carregar esta mídia.';
            container.classList.add('media-error');
          }
        }
      });
  }

  function renderAlerts() {
    const list = $('#alertList');
    if (!list) return;
    const alerts = state.alerts || [];
    list.innerHTML = alerts.length
      ? alerts
          .map(
            (alert) => `
          <article class="alert-card">
            <div class="alert-top">
              <span class="alert-badge ${alert.severity || 'low'}">${
                alert.severity === 'critical'
                  ? 'Crítico'
                  : alert.severity === 'high'
                    ? 'Alto'
                    : alert.severity === 'medium'
                      ? 'Médio'
                      : 'Baixo'
              }</span>
              <span class="muted">${safe(alert.time || 'agora')}</span>
            </div>
            <h3>${safe(alert.title)}</h3>
            <div class="alert-meta">${safe(alert.summary)}</div>
            <p>${safe(alert.details)}</p>
            ${alert.location ? `<div class="alert-meta">⌖ ${safe(alert.location)}</div>` : ''}
            <div class="alert-footer">
              <span class="muted">Registrado ${safe(alert.time || 'agora')}</span>
              <span class="muted">Alerta local</span>
            </div>
          </article>
        `
          )
          .join('')
      : `<div class="feed-empty alert-empty">
          <span class="empty-icon">⚑</span>
          <h3>Nenhum alerta registrado</h3>
          <p>Quando houver alertas ou atualizações relevantes, eles aparecerão aqui.</p>
        </div>`;
  }

  function renderSettings() {
    const list = $('#settingsList');
    if (!list) return;
    const entries = Object.entries(state.settings || defaultSettings);
    list.innerHTML = entries
      .map(
        ([key, value]) => `
          <label class="toggle-item">
            <div>
              <strong>${safe(value.label || key)}</strong>
              <small>${safe(value.description || '')}</small>
            </div>
            <span class="switch">
              <input type="checkbox" data-setting-name="${key}" ${value.value ? 'checked' : ''} />
              <span class="slider"></span>
            </span>
          </label>
        `
      )
      .join('');
    list.querySelectorAll('[data-setting-name]').forEach((input) => {
      input.addEventListener('change', (event) => {
        const name = event.target.dataset.settingName;
        if (!state.settings[name]) return;
        state.settings[name].value = event.target.checked;
        persist();
      });
    });
    const profileName = $('#profileNameInput');
    const profileEmail = $('#profileEmailInput');
    const profileBio = $('#profileBioInput');
    if (profileName && state.user) {
      profileName.value = state.user.name || '';
      profileEmail.value = state.user.email || '';
      profileBio.value = state.user.bio || '';
    }
  }

  $('#feedForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const text = String(form.get('text') || '').trim();
    const file = form.get('media');
    const submitButton = formElement.querySelector('button[type="submit"]');
    if (!text && !(file instanceof File && file.size)) {
      toast('Escreva uma legenda ou escolha uma foto/vídeo para compartilhar.');
      return;
    }
    if (file instanceof File && file.size > 4 * 1024 * 1024) {
      toast('O arquivo deve ter até 4 MB.');
      return;
    }
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando…';
    (async () => {
      try {
        let media;
        if (file instanceof File && file.size) {
          const data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(',')[1]);
            reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
            reader.readAsDataURL(file);
          });
          media = { fileName: file.name, mimeType: file.type, data };
        }
        const response = await fetch('/api/feed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.user?.token || ''}`,
          },
          body: JSON.stringify({
            content: text,
            category: String(form.get('type') || 'Comunidade'),
            media,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Não foi possível publicar.');
        state.communityFeed = [result, ...(state.communityFeed || [])];
        formElement.reset();
        $('#feedMediaPreview').classList.add('hidden');
        renderFeed();
        loadReputation();
        toast('Publicação compartilhada com a comunidade.');
      } catch (error) {
        toast(error.message || 'Falha ao publicar no feed.');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Compartilhar';
      }
    })();
  });

  $('#siteFeedbackForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const comment = form.elements.comment.value.trim();
    const submitButton = form.querySelector('button[type="submit"]');
    if (!comment) {
      $('#siteFeedbackStatus').textContent = 'Escreva um comentário antes de enviar.';
      return;
    }
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando…';
    try {
      const response = await fetch('/api/reputation/feedback', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ comment }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível enviar seu comentário.');
      $('#siteFeedbackStatus').textContent = result.message;
      toast(result.message);
    } catch (error) {
      $('#siteFeedbackStatus').textContent = error.message || 'Falha ao enviar comentário.';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Enviar comentário';
    }
  });

  $('#feedMediaInput')?.addEventListener('change', (event) => {
    const file = event.currentTarget.files[0];
    const preview = $('#feedMediaPreview');
    preview.replaceChildren();
    if (!file) {
      preview.classList.add('hidden');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      event.currentTarget.value = '';
      preview.classList.add('hidden');
      toast('O arquivo deve ter até 4 MB.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'].includes(file.type)) {
      event.currentTarget.value = '';
      preview.classList.add('hidden');
      toast('Escolha uma foto JPG, PNG ou WebP, ou vídeo MP4 ou WebM.');
      return;
    }
    const url = URL.createObjectURL(file);
    feedMediaUrls.add(url);
    const element = file.type.startsWith('video/')
      ? document.createElement('video')
      : document.createElement('img');
    element.src = url;
    if (element instanceof HTMLVideoElement) {
      element.controls = true;
      element.muted = true;
      element.playsInline = true;
    } else {
      element.alt = 'Prévia da foto escolhida';
    }
    preview.append(element);
    preview.classList.remove('hidden');
  });

  $('#profileForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!state.user) return;
    state.user.name = String(form.get('name') || state.user.name || 'Usuário');
    state.user.email = String(form.get('email') || state.user.email || '');
    state.user.bio = String(form.get('bio') || '');
    persist();
    startApp();
    toast('Perfil atualizado localmente.');
  });

  $('#createAlertBtn')?.addEventListener('click', () => {
    $('#alertForm').reset();
    $('#alertFormError').textContent = '';
    openModal('alertModal');
  });

  $('#alertForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') || '').trim();
    if (!title) {
      $('#alertFormError').textContent = 'Informe o motivo do alerta.';
      return;
    }
    const alert = {
      id: Date.now(),
      severity: String(form.get('severity') || 'medium'),
      title,
      summary: title,
      time: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
      details: String(form.get('details') || '').trim() || 'Sem detalhes adicionais.',
      location: String(form.get('location') || '').trim(),
    };
    state.alerts = [alert, ...(state.alerts || [])];
    persist();
    renderAlerts();
    closeModal('alertModal');
    toast('Alerta registrado neste dispositivo.');
  });

  $('#supportBtn')?.addEventListener('click', () => {
    toast('Suporte acionado. Seu pedido foi registrado localmente e será revisado em breve.');
  });

  $('#notificationBtn').onclick = () =>
    toast('Você está em dia! Notificações em tempo real precisam de integração com o servidor.');
  $('#profileButton').onclick = () =>
    toast('Perfil: ' + (state.user?.name || state.user?.email || 'Usuário'));
  const saved = load();
  if (saved.user && saved.user.token) {
    state.user = saved.user;
    startApp();
  } else showAuth(false);
})();
