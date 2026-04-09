const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Mock data
const certificates = [
  { id: 1, name: 'Cert A1 - Escritório Vezzi Lapolla', type: 'A1', holder: 'Thiago Vezzi', cpfCnpj: '12.345.678/0001-90', status: 'active', expiresAt: '2026-11-15', activeSessions: 3, totalUses: 1247 },
  { id: 2, name: 'Cert A3 - Araújo Augusto Advogados', type: 'A3', holder: 'Carlos Araújo', cpfCnpj: '98.765.432/0001-10', status: 'active', expiresAt: '2026-08-22', activeSessions: 1, totalUses: 856 },
  { id: 3, name: 'Cert A1 - Maria Silva (PF)', type: 'A1', holder: 'Maria Silva', cpfCnpj: '123.456.789-00', status: 'expiring', expiresAt: '2026-05-01', activeSessions: 0, totalUses: 432 },
  { id: 4, name: 'Cert A1 - Contabilidade Express', type: 'A1', holder: 'João Santos', cpfCnpj: '11.222.333/0001-44', status: 'active', expiresAt: '2027-03-10', activeSessions: 5, totalUses: 2103 },
  { id: 5, name: 'Cert A3 - Departamento Jurídico Corp', type: 'A3', holder: 'Ana Oliveira', cpfCnpj: '55.666.777/0001-88', status: 'expired', expiresAt: '2026-03-15', activeSessions: 0, totalUses: 678 },
  { id: 6, name: 'Cert A1 - Escritório Tributário ABC', type: 'A1', holder: 'Roberto Lima', cpfCnpj: '22.333.444/0001-55', status: 'active', expiresAt: '2026-12-30', activeSessions: 2, totalUses: 1589 },
  { id: 7, name: 'Cert A1 - Procuradoria Municipal', type: 'A1', holder: 'Fernanda Costa', cpfCnpj: '33.444.555/0001-66', status: 'revoked', expiresAt: '2026-09-20', activeSessions: 0, totalUses: 91 },
];

const users = [
  { id: 1, name: 'Thiago Vezzi', email: 'thiago@vezzilapolla.adv.br', role: 'admin', group: 'Sócios', status: 'active', lastAccess: '2026-04-09 14:32' },
  { id: 2, name: 'Carlos Araújo', email: 'carlos@araujoaugusto.adv.br', role: 'admin', group: 'Sócios', status: 'active', lastAccess: '2026-04-09 13:15' },
  { id: 3, name: 'Maria Silva', email: 'maria.silva@vezzilapolla.adv.br', role: 'user', group: 'Advogados', status: 'active', lastAccess: '2026-04-09 15:01' },
  { id: 4, name: 'João Santos', email: 'joao@contabilidadeexpress.com.br', role: 'user', group: 'Contadores', status: 'active', lastAccess: '2026-04-09 11:45' },
  { id: 5, name: 'Ana Oliveira', email: 'ana.oliveira@corpjuridico.com.br', role: 'compliance', group: 'Gestão TI', status: 'active', lastAccess: '2026-04-09 10:30' },
  { id: 6, name: 'Roberto Lima', email: 'roberto@tributarioabc.adv.br', role: 'user', group: 'Advogados', status: 'inactive', lastAccess: '2026-04-01 09:12' },
];

const auditLogs = [
  { id: 1, timestamp: '2026-04-09 15:01:23', user: 'Maria Silva', action: 'Assinatura Digital', system: 'PJe - TRT 2ª Região', certificate: 'Cert A1 - Escritório Vezzi Lapolla', ip: '189.40.12.55', status: 'success' },
  { id: 2, timestamp: '2026-04-09 14:55:10', user: 'Thiago Vezzi', action: 'Protocolo de Petição', system: 'e-SAJ - TJSP', certificate: 'Cert A1 - Escritório Vezzi Lapolla', ip: '189.40.12.55', status: 'success' },
  { id: 3, timestamp: '2026-04-09 14:32:45', user: 'Carlos Araújo', action: 'Consulta Processual', system: 'eProc - TRF4', certificate: 'Cert A3 - Araújo Augusto Advogados', ip: '200.155.78.32', status: 'success' },
  { id: 4, timestamp: '2026-04-09 14:15:00', user: 'João Santos', action: 'Transmissão SPED', system: 'e-CAC - Receita Federal', certificate: 'Cert A1 - Contabilidade Express', ip: '177.88.45.12', status: 'success' },
  { id: 5, timestamp: '2026-04-09 13:50:33', user: 'Robô RPA #01', action: 'Download de Guias', system: 'PGFN - Procuradoria', certificate: 'Cert A1 - Contabilidade Express', ip: '10.0.0.50', status: 'success' },
  { id: 6, timestamp: '2026-04-09 13:22:11', user: 'Roberto Lima', action: 'Tentativa de Acesso', system: 'PJe - TRT 15ª Região', certificate: 'Cert A1 - Escritório Tributário ABC', ip: '45.167.23.89', status: 'blocked' },
  { id: 7, timestamp: '2026-04-09 12:45:00', user: 'Ana Oliveira', action: 'Exportação de Relatório', system: 'Painel Whom', certificate: '-', ip: '200.155.78.32', status: 'success' },
  { id: 8, timestamp: '2026-04-09 12:10:55', user: 'Maria Silva', action: 'Assinatura Digital', system: 'e-SAJ - TJSP', certificate: 'Cert A1 - Escritório Vezzi Lapolla', ip: '189.40.12.55', status: 'success' },
  { id: 9, timestamp: '2026-04-09 11:45:22', user: 'João Santos', action: 'Envio eSocial', system: 'eSocial - Gov.br', certificate: 'Cert A1 - Contabilidade Express', ip: '177.88.45.12', status: 'success' },
  { id: 10, timestamp: '2026-04-09 11:00:00', user: 'Robô RPA #02', action: 'Consulta CNPJ', system: 'Receita Federal', certificate: 'Cert A1 - Contabilidade Express', ip: '10.0.0.51', status: 'success' },
];

const activeSessions = [
  { id: 1, user: 'Maria Silva', certificate: 'Cert A1 - Vezzi Lapolla', system: 'PJe - TRT 2ª Região', startedAt: '15:01', ip: '189.40.12.55', action: 'Assinatura Digital' },
  { id: 2, user: 'Thiago Vezzi', certificate: 'Cert A1 - Vezzi Lapolla', system: 'e-SAJ - TJSP', startedAt: '14:55', ip: '189.40.12.55', action: 'Protocolo' },
  { id: 3, user: 'Carlos Araújo', certificate: 'Cert A3 - Araújo Augusto', system: 'eProc - TRF4', startedAt: '14:32', ip: '200.155.78.32', action: 'Consulta' },
  { id: 4, user: 'João Santos', certificate: 'Cert A1 - Contab. Express', system: 'e-CAC', startedAt: '14:15', ip: '177.88.45.12', action: 'SPED' },
  { id: 5, user: 'Robô RPA #01', certificate: 'Cert A1 - Contab. Express', system: 'PGFN', startedAt: '13:50', ip: '10.0.0.50', action: 'Download Guias' },
];

// API Routes
app.get('/api/dashboard', (req, res) => {
  res.json({
    stats: {
      totalCertificates: certificates.length,
      activeCertificates: certificates.filter(c => c.status === 'active').length,
      expiringSoon: certificates.filter(c => c.status === 'expiring').length,
      expired: certificates.filter(c => c.status === 'expired').length,
      activeSessions: activeSessions.length,
      totalUsers: users.length,
      activeUsers: users.filter(u => u.status === 'active').length,
      todayActions: auditLogs.length,
      blockedAttempts: auditLogs.filter(l => l.status === 'blocked').length,
    },
    activeSessions,
    recentLogs: auditLogs.slice(0, 5),
  });
});

app.get('/api/certificates', (req, res) => res.json(certificates));
app.get('/api/users', (req, res) => res.json(users));
app.get('/api/audit-logs', (req, res) => res.json(auditLogs));

app.post('/api/certificates/:id/revoke', (req, res) => {
  const cert = certificates.find(c => c.id === parseInt(req.params.id));
  if (cert) {
    cert.status = 'revoked';
    cert.activeSessions = 0;
    res.json({ success: true, message: `Certificado "${cert.name}" revogado com sucesso.` });
  } else {
    res.status(404).json({ error: 'Certificado não encontrado' });
  }
});

app.post('/api/users/:id/toggle', (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (user) {
    user.status = user.status === 'active' ? 'inactive' : 'active';
    res.json({ success: true, message: `Usuário "${user.name}" ${user.status === 'active' ? 'ativado' : 'desativado'}.` });
  } else {
    res.status(404).json({ error: 'Usuário não encontrado' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Whom.doc9 - Gerenciador de Certificados Digitais`);
  console.log(`  Servidor rodando em http://localhost:${PORT}\n`);
});
