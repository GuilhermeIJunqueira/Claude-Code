// ===== Whom.doc9 - Gerenciador de Certificados Digitais =====

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  loadDashboard();
  loadCertificates();
  loadUsers();
  loadAuditLogs();
  initEventListeners();
});

// ===== NAVIGATION =====
function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      navigateTo(page);
    });
  });

  // View all links
  document.querySelectorAll('.view-all').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link.dataset.page);
    });
  });

  // Menu toggle for mobile
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

function navigateTo(page) {
  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');

  // Update page
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');

  // Update title
  const titles = {
    dashboard: 'Dashboard',
    certificates: 'Vault de Certificados',
    access: 'Gestao de Acessos',
    audit: 'Logs de Auditoria',
    reports: 'Relatorios de Compliance',
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
}

// ===== DASHBOARD =====
async function loadDashboard() {
  try {
    const res = await fetch('/api/dashboard');
    const data = await res.json();

    document.getElementById('statTotal').textContent = data.stats.totalCertificates;
    document.getElementById('statActive').textContent = data.stats.activeCertificates;
    document.getElementById('statExpiring').textContent = data.stats.expiringSoon;
    document.getElementById('statSessions').textContent = data.stats.activeSessions;

    renderActiveSessions(data.activeSessions);
    renderRecentActivity(data.recentLogs);
  } catch (err) {
    console.error('Erro ao carregar dashboard:', err);
  }
}

function renderActiveSessions(sessions) {
  const tbody = document.getElementById('activeSessionsTable');
  tbody.innerHTML = sessions.map(s => `
    <tr>
      <td><strong>${s.user}</strong></td>
      <td>${s.certificate}</td>
      <td>${s.system}</td>
      <td>${s.action}</td>
      <td>${s.startedAt}</td>
      <td><code>${s.ip}</code></td>
    </tr>
  `).join('');
}

function renderRecentActivity(logs) {
  const container = document.getElementById('recentActivity');
  container.innerHTML = logs.map(log => `
    <div class="activity-item">
      <div class="activity-dot ${log.status}"></div>
      <div class="activity-info">
        <div class="activity-text">
          <strong>${log.user}</strong> ${log.action} em <strong>${log.system}</strong>
        </div>
        <div class="activity-time">${log.timestamp}</div>
      </div>
    </div>
  `).join('');
}

// ===== CERTIFICATES =====
let allCertificates = [];

async function loadCertificates() {
  try {
    const res = await fetch('/api/certificates');
    allCertificates = await res.json();
    renderCertificates(allCertificates);
  } catch (err) {
    console.error('Erro ao carregar certificados:', err);
  }
}

function renderCertificates(certs) {
  const grid = document.getElementById('certificatesGrid');
  grid.innerHTML = certs.map(cert => {
    const statusLabels = { active: 'Ativo', expiring: 'Expirando', expired: 'Expirado', revoked: 'Revogado' };
    const isActionable = cert.status === 'active' || cert.status === 'expiring';
    return `
    <div class="cert-card">
      <div class="cert-card-header">
        <div>
          <div class="cert-name">${cert.name}</div>
          <div class="cert-holder">${cert.holder} | ${cert.cpfCnpj}</div>
        </div>
        <span class="cert-type-badge ${cert.type}">${cert.type}</span>
      </div>
      <div class="cert-details">
        <div class="cert-detail">
          <span class="cert-detail-label">Status</span>
          <span class="cert-detail-value"><span class="status-dot ${cert.status}">${statusLabels[cert.status]}</span></span>
        </div>
        <div class="cert-detail">
          <span class="cert-detail-label">Validade</span>
          <span class="cert-detail-value">${formatDate(cert.expiresAt)}</span>
        </div>
        <div class="cert-detail">
          <span class="cert-detail-label">Sessoes Ativas</span>
          <span class="cert-detail-value">${cert.activeSessions}</span>
        </div>
        <div class="cert-detail">
          <span class="cert-detail-label">Total de Usos</span>
          <span class="cert-detail-value">${cert.totalUses.toLocaleString('pt-BR')}</span>
        </div>
      </div>
      <div class="cert-actions">
        ${isActionable ? `<button class="btn btn-danger btn-sm" onclick="revokeCertificate(${cert.id})">Revogar Acesso</button>` : ''}
        ${cert.status === 'expiring' ? `<button class="btn btn-primary btn-sm" onclick="showToast('Renovacao iniciada via Certisign!', 'success')">Renovar</button>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="showCertDetails(${cert.id})">Detalhes</button>
      </div>
    </div>
  `;
  }).join('');
}

function filterCertificates() {
  const statusFilter = document.getElementById('filterCertStatus').value;
  const typeFilter = document.getElementById('filterCertType').value;
  let filtered = [...allCertificates];
  if (statusFilter !== 'all') filtered = filtered.filter(c => c.status === statusFilter);
  if (typeFilter !== 'all') filtered = filtered.filter(c => c.type === typeFilter);
  renderCertificates(filtered);
}

async function revokeCertificate(id) {
  if (!confirm('Tem certeza que deseja revogar o acesso a este certificado? Todas as sessoes ativas serao encerradas.')) return;
  try {
    const res = await fetch(`/api/certificates/${id}/revoke`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadCertificates();
      loadDashboard();
    }
  } catch (err) {
    showToast('Erro ao revogar certificado.', 'error');
  }
}

function showCertDetails(id) {
  const cert = allCertificates.find(c => c.id === id);
  if (!cert) return;
  const statusLabels = { active: 'Ativo', expiring: 'Expirando', expired: 'Expirado', revoked: 'Revogado' };
  openModal(`Detalhes - ${cert.name}`, `
    <div class="form-group">
      <label>Titular</label>
      <div class="form-control" style="background:var(--bg-primary)">${cert.holder}</div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>CPF/CNPJ</label>
        <div class="form-control" style="background:var(--bg-primary)">${cert.cpfCnpj}</div>
      </div>
      <div class="form-group">
        <label>Tipo</label>
        <div class="form-control" style="background:var(--bg-primary)">${cert.type}</div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Status</label>
        <div class="form-control" style="background:var(--bg-primary)"><span class="status-dot ${cert.status}">${statusLabels[cert.status]}</span></div>
      </div>
      <div class="form-group">
        <label>Validade</label>
        <div class="form-control" style="background:var(--bg-primary)">${formatDate(cert.expiresAt)}</div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Sessoes Ativas</label>
        <div class="form-control" style="background:var(--bg-primary)">${cert.activeSessions}</div>
      </div>
      <div class="form-group">
        <label>Total de Usos</label>
        <div class="form-control" style="background:var(--bg-primary)">${cert.totalUses.toLocaleString('pt-BR')}</div>
      </div>
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>`);
}

// ===== USERS =====
let allUsers = [];

async function loadUsers() {
  try {
    const res = await fetch('/api/users');
    allUsers = await res.json();
    renderUsers(allUsers);
    document.getElementById('userCount').textContent = `${allUsers.length} usuarios`;
  } catch (err) {
    console.error('Erro ao carregar usuarios:', err);
  }
}

function renderUsers(users) {
  const tbody = document.getElementById('usersTable');
  const roleLabels = { admin: 'Administrador', user: 'Colaborador', compliance: 'Compliance' };
  tbody.innerHTML = users.map(u => `
    <tr>
      <td><strong>${u.name}</strong></td>
      <td>${u.email}</td>
      <td><span class="badge">${roleLabels[u.role]}</span></td>
      <td>${u.group}</td>
      <td><span class="status-dot ${u.status}">${u.status === 'active' ? 'Ativo' : 'Inativo'}</span></td>
      <td>${u.lastAccess}</td>
      <td>
        <button class="btn btn-xs ${u.status === 'active' ? 'btn-danger' : 'btn-primary'}" onclick="toggleUser(${u.id})">
          ${u.status === 'active' ? 'Desativar' : 'Ativar'}
        </button>
        <button class="btn btn-xs btn-secondary" onclick="showAccessPolicy(${u.id})">Politicas</button>
      </td>
    </tr>
  `).join('');
}

async function toggleUser(id) {
  try {
    const res = await fetch(`/api/users/${id}/toggle`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadUsers();
    }
  } catch (err) {
    showToast('Erro ao alterar status do usuario.', 'error');
  }
}

function showAccessPolicy(id) {
  const user = allUsers.find(u => u.id === id);
  if (!user) return;
  openModal(`Politicas de Acesso - ${user.name}`, `
    <div class="form-group">
      <label>Certificados Permitidos</label>
      <select class="form-control" multiple style="height:80px">
        <option selected>Cert A1 - Escritorio Vezzi Lapolla</option>
        <option selected>Cert A3 - Araujo Augusto Advogados</option>
        <option>Cert A1 - Contabilidade Express</option>
      </select>
    </div>
    <div class="form-group">
      <label>Sistemas Permitidos (URLs)</label>
      <input class="form-control" value="pje.jus.br, esaj.tjsp.jus.br, eproc.trf4.jus.br">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Horario Permitido</label>
        <input class="form-control" value="08:00 - 20:00">
      </div>
      <div class="form-group">
        <label>IPs Autorizados</label>
        <input class="form-control" value="189.40.12.0/24">
      </div>
    </div>
    <div class="form-group">
      <label>Acoes Permitidas</label>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:6px">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;text-transform:none;letter-spacing:0;font-weight:400;color:var(--text-primary)">
          <input type="checkbox" checked> Assinatura Digital
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;text-transform:none;letter-spacing:0;font-weight:400;color:var(--text-primary)">
          <input type="checkbox" checked> Protocolo
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;text-transform:none;letter-spacing:0;font-weight:400;color:var(--text-primary)">
          <input type="checkbox" checked> Consulta
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;text-transform:none;letter-spacing:0;font-weight:400;color:var(--text-primary)">
          <input type="checkbox"> Transmissao SPED
        </label>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="showToast('Politicas salvas com sucesso!', 'success'); closeModal()">Salvar Politicas</button>
  `);
}

// ===== AUDIT LOGS =====
let allLogs = [];

async function loadAuditLogs() {
  try {
    const res = await fetch('/api/audit-logs');
    allLogs = await res.json();
    renderAuditLogs(allLogs);
    document.getElementById('logCount').textContent = `${allLogs.length} registros`;
  } catch (err) {
    console.error('Erro ao carregar logs:', err);
  }
}

function renderAuditLogs(logs) {
  const tbody = document.getElementById('auditTable');
  tbody.innerHTML = logs.map(log => `
    <tr>
      <td>${log.timestamp}</td>
      <td><strong>${log.user}</strong></td>
      <td>${log.action}</td>
      <td>${log.system}</td>
      <td>${log.certificate}</td>
      <td><code>${log.ip}</code></td>
      <td><span class="status-dot ${log.status}">${log.status === 'success' ? 'Sucesso' : 'Bloqueado'}</span></td>
    </tr>
  `).join('');
}

function filterLogs() {
  const statusFilter = document.getElementById('filterLogStatus').value;
  let filtered = [...allLogs];
  if (statusFilter !== 'all') filtered = filtered.filter(l => l.status === statusFilter);
  renderAuditLogs(filtered);
  document.getElementById('logCount').textContent = `${filtered.length} registros`;
}

// ===== EVENT LISTENERS =====
function initEventListeners() {
  // Certificate filters
  document.getElementById('filterCertStatus').addEventListener('change', filterCertificates);
  document.getElementById('filterCertType').addEventListener('change', filterCertificates);

  // Log filter
  document.getElementById('filterLogStatus').addEventListener('change', filterLogs);

  // Add certificate button
  document.getElementById('btnAddCert').addEventListener('click', showAddCertModal);

  // Add user button
  document.getElementById('btnAddUser').addEventListener('click', showAddUserModal);

  // Export logs
  document.getElementById('btnExportLogs').addEventListener('click', exportLogs);

  // Modal close
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Notifications
  document.getElementById('notifBtn').addEventListener('click', showNotifications);

  // Search
  document.getElementById('searchInput').addEventListener('input', handleSearch);
}

function showAddCertModal() {
  openModal('Importar Certificado Digital', `
    <div class="form-group">
      <label>Arquivo do Certificado (.pfx / .p12)</label>
      <input type="file" class="form-control" accept=".pfx,.p12" style="padding:8px">
    </div>
    <div class="form-group">
      <label>Senha do Certificado</label>
      <input type="password" class="form-control" placeholder="Digite a senha do certificado">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Tipo</label>
        <select class="form-control">
          <option>A1 - Arquivo Digital</option>
          <option>A3 - Token/Cartao</option>
        </select>
      </div>
      <div class="form-group">
        <label>Titular</label>
        <input class="form-control" placeholder="Nome do titular">
      </div>
    </div>
    <div class="form-group">
      <label>CPF/CNPJ do Titular</label>
      <input class="form-control" placeholder="00.000.000/0000-00">
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="showToast('Certificado importado para o vault com sucesso!', 'success'); closeModal()">Importar para o Vault</button>
  `);
}

function showAddUserModal() {
  openModal('Adicionar Usuario', `
    <div class="form-row">
      <div class="form-group">
        <label>Nome Completo</label>
        <input class="form-control" placeholder="Nome do usuario">
      </div>
      <div class="form-group">
        <label>E-mail</label>
        <input class="form-control" type="email" placeholder="email@empresa.com.br">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Perfil</label>
        <select class="form-control">
          <option>Colaborador</option>
          <option>Administrador</option>
          <option>Compliance / TI</option>
        </select>
      </div>
      <div class="form-group">
        <label>Grupo</label>
        <select class="form-control">
          <option>Advogados</option>
          <option>Socios</option>
          <option>Contadores</option>
          <option>Gestao TI</option>
          <option>Estagiarios</option>
        </select>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="showToast('Usuario adicionado com sucesso! Convite enviado por e-mail.', 'success'); closeModal()">Adicionar Usuario</button>
  `);
}

function exportLogs() {
  const headers = ['Data/Hora', 'Usuario', 'Acao', 'Sistema', 'Certificado', 'IP', 'Status'];
  const rows = allLogs.map(l => [l.timestamp, l.user, l.action, l.system, l.certificate, l.ip, l.status]);
  const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit_logs_whom_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Logs exportados com sucesso!', 'success');
}

function showNotifications() {
  openModal('Notificacoes', `
    <div class="activity-list" style="margin: -24px; max-height: 300px; overflow-y: auto;">
      <div class="activity-item">
        <div class="activity-dot" style="background:var(--accent-orange)"></div>
        <div class="activity-info">
          <div class="activity-text"><strong>Certificado expirando:</strong> Cert A1 - Maria Silva (PF) vence em 22 dias</div>
          <div class="activity-time">Hoje, 09:00</div>
        </div>
      </div>
      <div class="activity-item">
        <div class="activity-dot" style="background:var(--accent-red)"></div>
        <div class="activity-info">
          <div class="activity-text"><strong>Acesso bloqueado:</strong> Roberto Lima tentou acessar PJe fora do horario permitido</div>
          <div class="activity-time">Hoje, 13:22</div>
        </div>
      </div>
      <div class="activity-item">
        <div class="activity-dot" style="background:var(--accent-green)"></div>
        <div class="activity-info">
          <div class="activity-text"><strong>Renovacao disponivel:</strong> Parceira Certisign oferece renovacao com desconto para 2 certificados</div>
          <div class="activity-time">Ontem, 16:00</div>
        </div>
      </div>
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>`);
}

function handleSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  if (!query) {
    renderCertificates(allCertificates);
    renderUsers(allUsers);
    renderAuditLogs(allLogs);
    return;
  }
  // Filter certificates on certs page
  const filteredCerts = allCertificates.filter(c =>
    c.name.toLowerCase().includes(query) ||
    c.holder.toLowerCase().includes(query) ||
    c.cpfCnpj.includes(query)
  );
  renderCertificates(filteredCerts);

  // Filter users
  const filteredUsers = allUsers.filter(u =>
    u.name.toLowerCase().includes(query) ||
    u.email.toLowerCase().includes(query)
  );
  renderUsers(filteredUsers);
}

// ===== MODAL =====
function openModal(title, body, footer) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('modalFooter').innerHTML = footer || '';
  document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
}

// ===== TOAST =====
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  };
  toast.innerHTML = `${icons[type] || ''}<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ===== UTILS =====
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}
