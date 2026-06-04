// Authentication check
async function checkAuth() {
  const res = await fetch('/api/me');
  const data = await res.json();
  if (!data.authenticated) {
    window.location.href = '/admin/login.html';
  } else {
    loadAllData();
  }
}
checkAuth();

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/admin/login.html';
});

// Tab switching
const tabs = ['cs', 'settings', 'leads'];
tabs.forEach(tab => {
  document.getElementById(`tab-${tab}`).addEventListener('click', () => {
    // Reset all tabs
    tabs.forEach(t => {
      document.getElementById(`tab-${t}`).className = 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm';
      document.getElementById(`panel-${t}`).classList.add('hidden');
    });
    // Active tab
    document.getElementById(`tab-${tab}`).className = 'border-blue-500 text-blue-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm';
    document.getElementById(`panel-${tab}`).classList.remove('hidden');
  });
});

async function loadAllData() {
  loadSettings();
  loadCS();
  loadLeads();
}

// --- SETTINGS ---
async function loadSettings() {
  const res = await fetch('/api/admin/settings');
  const data = await res.json();
  if (data) {
    document.getElementById('notion_token').value = data.notion_token || '';
    document.getElementById('notion_database_id').value = data.notion_database_id || '';
    document.getElementById('wa_template').value = data.wa_template || '';
  }
}

document.getElementById('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const alertBox = document.getElementById('settingsAlert');
  
  const payload = {
    notion_token: document.getElementById('notion_token').value,
    notion_database_id: document.getElementById('notion_database_id').value,
    wa_template: document.getElementById('wa_template').value
  };

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alertBox.textContent = 'Pengaturan berhasil disimpan!';
      alertBox.className = 'p-4 rounded-md text-sm mb-4 bg-green-50 text-green-700 block';
    } else {
      throw new Error();
    }
  } catch (err) {
    alertBox.textContent = 'Gagal menyimpan pengaturan.';
    alertBox.className = 'p-4 rounded-md text-sm mb-4 bg-red-50 text-red-700 block';
  }
  
  setTimeout(() => alertBox.classList.add('hidden'), 3000);
});

// --- CS MANAGEMENT ---
let currentCsList = [];

async function loadCS() {
  const res = await fetch('/api/admin/cs');
  currentCsList = await res.json();
  renderCSTable();
}

function renderCSTable() {
  const tbody = document.getElementById('csTableBody');
  tbody.innerHTML = '';
  
  currentCsList.forEach(cs => {
    const statusBadge = cs.is_active 
      ? `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Aktif</span>`
      : `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Nonaktif</span>`;
      
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${cs.name}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${cs.phone_number}</td>
      <td class="px-6 py-4 whitespace-nowrap">${statusBadge}</td>
      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button onclick="editCs(${cs.id})" class="text-indigo-600 hover:text-indigo-900 mr-3">Edit</button>
        <button onclick="deleteCs(${cs.id})" class="text-red-600 hover:text-red-900">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openCsModal() {
  document.getElementById('csForm').reset();
  document.getElementById('cs_id').value = '';
  document.getElementById('modal-title').textContent = 'Tambah CS Baru';
  document.getElementById('csModal').classList.remove('hidden');
}

function closeCsModal() {
  document.getElementById('csModal').classList.add('hidden');
}

function editCs(id) {
  const cs = currentCsList.find(c => c.id === id);
  if (cs) {
    document.getElementById('cs_id').value = cs.id;
    document.getElementById('cs_name').value = cs.name;
    document.getElementById('cs_phone').value = cs.phone_number;
    document.getElementById('cs_active').checked = cs.is_active == 1;
    document.getElementById('modal-title').textContent = 'Edit CS';
    document.getElementById('csModal').classList.remove('hidden');
  }
}

document.getElementById('csForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = document.getElementById('cs_id').value;
  const payload = {
    name: document.getElementById('cs_name').value,
    phone_number: document.getElementById('cs_phone').value,
    is_active: document.getElementById('cs_active').checked
  };

  const url = id ? `/api/admin/cs/${id}` : '/api/admin/cs';
  const method = id ? 'PUT' : 'POST';

  await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  closeCsModal();
  loadCS();
});

function deleteCs(id) {
  showConfirmModal('Apakah Anda yakin ingin menghapus CS ini?', async () => {
    await fetch(`/api/admin/cs/${id}`, { method: 'DELETE' });
    loadCS();
  });
}

// --- LEADS ---
let currentLeadsList = [];

async function loadLeads() {
  const res = await fetch('/api/admin/leads');
  currentLeadsList = await res.json();
  
  const tbody = document.getElementById('leadsTableBody');
  tbody.innerHTML = '';
  
  currentLeadsList.forEach(lead => {
    const date = new Date(lead.created_at).toLocaleString('id-ID');
    let syncBadge = '';
    if (lead.sync_status === 'SUCCESS') syncBadge = `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">OK</span>`;
    else if (lead.sync_status === 'FAILED') syncBadge = `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Fail</span>`;
    else syncBadge = `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${date}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${lead.customer_name}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lead.customer_phone}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lead.product}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lead.assigned_cs}</td>
      <td class="px-6 py-4 whitespace-nowrap">${syncBadge}</td>
      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button onclick="editLead(${lead.id})" class="text-indigo-600 hover:text-indigo-900 mr-3">Edit</button>
        <button onclick="deleteLead(${lead.id})" class="text-red-600 hover:text-red-900">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openLeadModal() {
  document.getElementById('leadForm').reset();
  document.getElementById('lead_id').value = '';
  document.getElementById('leadModal').classList.remove('hidden');
}

function closeLeadModal() {
  document.getElementById('leadModal').classList.add('hidden');
}

function editLead(id) {
  const lead = currentLeadsList.find(l => l.id === id);
  if (lead) {
    // Populate CS select dropdown first
    const csSelect = document.getElementById('lead_cs');
    csSelect.innerHTML = '';
    currentCsList.forEach(cs => {
      const option = document.createElement('option');
      option.value = cs.phone_number;
      option.textContent = `${cs.name} (${cs.phone_number})`;
      csSelect.appendChild(option);
    });

    document.getElementById('lead_id').value = lead.id;
    document.getElementById('lead_name').value = lead.customer_name;
    document.getElementById('lead_phone').value = lead.customer_phone;
    document.getElementById('lead_product').value = lead.product;
    document.getElementById('lead_cs').value = lead.assigned_cs;
    document.getElementById('lead_sync_status').value = lead.sync_status;
    document.getElementById('leadModal').classList.remove('hidden');
  }
}

document.getElementById('leadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = document.getElementById('lead_id').value;
  const payload = {
    customer_name: document.getElementById('lead_name').value,
    customer_phone: document.getElementById('lead_phone').value,
    product: document.getElementById('lead_product').value,
    assigned_cs: document.getElementById('lead_cs').value,
    sync_status: document.getElementById('lead_sync_status').value
  };

  await fetch(`/api/admin/leads/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  closeLeadModal();
  loadLeads();
});

function deleteLead(id) {
  showConfirmModal('Apakah Anda yakin ingin menghapus lead ini?', async () => {
    await fetch(`/api/admin/leads/${id}`, { method: 'DELETE' });
    loadLeads();
  });
}

// --- CUSTOM CONFIRM MODAL LOGIC ---
let onConfirmAction = null;

function showConfirmModal(message, action) {
  document.getElementById('confirm-modal-message').textContent = message;
  onConfirmAction = action;
  document.getElementById('confirmModal').classList.remove('hidden');
}

function closeConfirmModal() {
  document.getElementById('confirmModal').classList.add('hidden');
  onConfirmAction = null;
}

document.getElementById('confirmBtn').addEventListener('click', async () => {
  const btn = document.getElementById('confirmBtn');
  btn.disabled = true;
  btn.textContent = 'Menghapus...';
  
  if (onConfirmAction) {
    try {
      await onConfirmAction();
    } catch (err) {
      console.error('Error executing delete action:', err);
    }
  }
  
  btn.disabled = false;
  btn.textContent = 'Hapus';
  closeConfirmModal();
});
