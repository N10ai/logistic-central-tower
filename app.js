const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const state = {
  shipment: null,
  shipments: JSON.parse(localStorage.getItem('lct_shipments') || '[]'),
  documents: JSON.parse(localStorage.getItem('lct_documents') || '[]')
};

const fields = [
  ['mode','Mode','select',['Air','Ocean','Ground']],
  ['customer','Customer','text'],
  ['shipper','Shipper / Pickup company','text'],
  ['pickupAddress','Pickup address','text'],
  ['consignee','Consignee','text'],
  ['deliveryAddress','Delivery / destination','text'],
  ['origin','Origin','text'],
  ['destination','Destination','text'],
  ['readyDate','Ready / pickup date','text'],
  ['pickupWindow','Pickup window','text'],
  ['reference','Reference / PO / WR','text'],
  ['commodity','Commodity','text'],
  ['notes','Notes','text','full']
];

const samples = {
  quote: `Hi team, please quote air freight MIA to UIO.\n3 pallets, 48x40x50 each, 2,180 lbs total.\nGeneral cargo. Pickup 33166. Cargo ready Monday.\nReference PO44582.`,
  pickup: `Please arrange pickup tomorrow morning from ABC Imports, 8350 NW 52nd Ter, Doral FL 33166 and deliver to Amerijet. 2 pallets 48x40x55, 1,240 lb total. Ref WR2458. General cargo.`,
  consolidation: `For Wednesday consolidation: WR1045 and WR1048, shipper Global Parts, 4 pallets total, 3,260 lbs. Deliver to LATAM Cargo. Cargo ready Tuesday afternoon.`
};

function esc(v='') {
  return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function inferIntent(text) {
  const t = text.toLowerCase();
  if (/quote|rate|pricing|cost|how much/.test(t)) return 'QUOTE';
  if (/pickup|pick up|delivery order|\bdo\b|deliver|trucking/.test(t)) return 'PICKUP / DO';
  if (/consolidat|wr\d+.*wr\d+/i.test(text)) return 'CONSOLIDATION';
  if (/aes|eei/.test(t)) return 'AES';
  if (/shipping instruction|booking/.test(t)) return 'SHIPPING INSTRUCTIONS';
  return 'SHIPMENT';
}

function find(text, patterns) {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return (m[1] || m[0]).trim().replace(/[.,;]+$/,'');
  }
  return '';
}

function parseCargo(text) {
  const rows = [];
  const qty = find(text,[/(\d+)\s*(?:pallets?|plts?|plt)\b/i, /(\d+)\s*(?:pieces?|pcs?)\b/i]);
  const dims = text.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*(?:in|inch|inches|”|"))?/i);
  const weight = find(text,[/(\d[\d,]*(?:\.\d+)?)\s*(?:lbs?|pounds?)\s*(?:total)?/i,/(\d[\d,]*(?:\.\d+)?)\s*(?:kg|kgs|kilograms?)/i]);
  if (qty || dims || weight) {
    rows.push({
      qty: qty || '1',
      length: dims?.[1] || '',
      width: dims?.[2] || '',
      height: dims?.[3] || '',
      weight: weight ? weight.replace(/,/g,'') : ''
    });
  }
  return rows.length ? rows : [{qty:'1',length:'',width:'',height:'',weight:''}];
}

function parseText(text) {
  const intent = inferIntent(text);
  const upperRoute = text.match(/\b([A-Z]{3})\s*(?:-|–|—|to|\/|→)\s*([A-Z]{3})\b/);
  const zip = find(text,[/pickup(?:\s+(?:from|at))?\s+(\d{5}(?:-\d{4})?)/i]);
  const referenceMatches = [...text.matchAll(/\b(?:WR|PO|REF|BOOKING|BK)[\s#:-]*([A-Z0-9-]{3,})\b/gi)]
    .map(m => `${m[0].match(/WR|PO|REF|BOOKING|BK/i)?.[0]?.toUpperCase() || 'REF'}${m[1] ? ' ' + m[1] : ''}`);
  const address = find(text,[/(?:pickup|pick up)(?:\s+(?:from|at))?\s+([^\n]+?)(?=\s+(?:and deliver|deliver|\d+\s*(?:pallet|plt)|ref\b)|$)/i]);
  const delivery = find(text,[/(?:deliver(?:y)?\s+(?:to|at)|destination[:\s]+)\s*([^\n.,]+(?:\s+Cargo)?)/i]);
  const company = address && !/^\d/.test(address) ? address.split(/,\s*(?=\d|[A-Z]{2}\s+\d)/)[0] : '';
  const ready = find(text,[/(?:cargo\s+)?ready(?:\s+on|\s*:)?\s+([^\n.,]+)/i,/(?:pickup|pick up)\s+(tomorrow(?:\s+(?:morning|afternoon|evening))?|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i]);
  const window = find(text,[/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*(?:-|to)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i,/(morning|afternoon|evening)/i]);
  const commodity = find(text,[/(general cargo|machinery|electronics|parts|furniture|textiles|food|pharmaceuticals?)/i]);

  let mode = 'Ground';
  if (/\bair\b|air freight|air cargo|airline/i.test(text)) mode = 'Air';
  else if (/\bocean\b|sea freight|container|fcl|lcl|steamship/i.test(text)) mode = 'Ocean';

  return {
    id: `SHP-${Date.now().toString().slice(-7)}`,
    createdAt: new Date().toISOString(),
    intent,
    mode,
    customer:'',
    shipper: company,
    pickupAddress: address || (zip ? zip : ''),
    consignee:'',
    deliveryAddress: delivery,
    origin: upperRoute?.[1] || (mode === 'Air' && /\bMIA\b/i.test(text) ? 'MIA' : ''),
    destination: upperRoute?.[2] || '',
    readyDate: ready,
    pickupWindow: window,
    reference: [...new Set(referenceMatches)].join(', '),
    commodity,
    notes:'',
    cargo: parseCargo(text),
    sourceText:text
  };
}

function requiredFor(shipment) {
  const common = ['shipper','reference'];
  if (shipment.intent === 'QUOTE') return ['origin','destination','commodity', ...common];
  if (shipment.intent === 'PICKUP / DO') return ['pickupAddress','deliveryAddress','readyDate', ...common];
  return common;
}

function missingFields() {
  if (!state.shipment) return [];
  return requiredFor(state.shipment).filter(k => !String(state.shipment[k] || '').trim());
}

function labelFor(key) {
  return fields.find(f => f[0] === key)?.[1] || key;
}

function syncStateFromForm() {
  if (!state.shipment) return;
  fields.forEach(([key]) => {
    const el = document.querySelector(`[data-field="${key}"]`);
    if (el) state.shipment[key] = el.value.trim();
  });
  state.shipment.cargo = $$('.cargo-row').map(row => ({
    qty: row.querySelector('[data-cargo="qty"]').value,
    length: row.querySelector('[data-cargo="length"]').value,
    width: row.querySelector('[data-cargo="width"]').value,
    height: row.querySelector('[data-cargo="height"]').value,
    weight: row.querySelector('[data-cargo="weight"]').value
  }));
  updateStatus();
}

function renderShipment() {
  const s = state.shipment;
  $('#shipmentForm').innerHTML = fields.map(([key,label,type,extra]) => {
    const miss = requiredFor(s).includes(key) && !s[key];
    if (type === 'select') {
      const options = extra.map(o => `<option ${s[key]===o?'selected':''}>${o}</option>`).join('');
      return `<div class="field ${miss?'missing':''}"><label>${label}</label><select data-field="${key}">${options}</select></div>`;
    }
    return `<div class="field ${extra==='full'?'full':''} ${miss?'missing':''}"><label>${label}</label><input data-field="${key}" value="${esc(s[key])}" placeholder="${miss?'Needed for this action':''}"></div>`;
  }).join('');
  renderCargo();
  $('#intentBadge').textContent = s.intent;
  $('#readyForText').textContent = s.intent === 'PICKUP / DO' ? 'Delivery Order' : s.intent === 'QUOTE' ? 'Quote' : 'Operations';
  $('#workspace').classList.remove('hidden');
  $$('[data-field]').forEach(el => el.addEventListener('input', syncStateFromForm));
  updateStatus();
}

function renderCargo() {
  $('#cargoLines').innerHTML = state.shipment.cargo.map((c,i) => `<div class="cargo-row" data-index="${i}">
    <label><small>Qty</small><input data-cargo="qty" value="${esc(c.qty)}"></label>
    <label><small>Length in</small><input data-cargo="length" value="${esc(c.length)}"></label>
    <label><small>Width in</small><input data-cargo="width" value="${esc(c.width)}"></label>
    <label><small>Height in</small><input data-cargo="height" value="${esc(c.height)}"></label>
    <label><small>Weight lb</small><input data-cargo="weight" value="${esc(c.weight)}"></label>
    <button class="remove-line" data-remove="${i}">×</button>
  </div>`).join('');
  $$('#cargoLines input').forEach(el => el.addEventListener('input', syncStateFromForm));
  $$('[data-remove]').forEach(btn => btn.addEventListener('click', () => {
    if (state.shipment.cargo.length === 1) return;
    state.shipment.cargo.splice(Number(btn.dataset.remove),1);
    renderCargo(); syncStateFromForm();
  }));
}

function updateStatus() {
  const missing = missingFields();
  $('#missingCount').textContent = `${missing.length} field${missing.length===1?'':'s'}`;
  $('#confidenceText').textContent = missing.length === 0 ? 'High' : missing.length <= 2 ? 'Good' : 'Needs review';
  $('#nextActionHint').textContent = missing.length ? `Complete ${missing.length} highlighted field${missing.length===1?'':'s'}.` : 'Ready to generate.';
  const box = $('#missingFields');
  if (missing.length) {
    box.innerHTML = `<strong>Missing:</strong> ${missing.map(labelFor).join(', ')}`;
    box.classList.remove('hidden');
  } else box.classList.add('hidden');
}

function cargoSummary(s) {
  const totalPieces = s.cargo.reduce((n,c)=>n+(Number(c.qty)||0),0);
  const totalWeight = s.cargo.reduce((n,c)=>n+(Number(c.weight)||0),0);
  return { totalPieces, totalWeight };
}

function cargoTable(s) {
  return `<table><thead><tr><th>Qty</th><th>Dimensions (in)</th><th>Weight (lb)</th></tr></thead><tbody>${s.cargo.map(c=>`<tr><td>${esc(c.qty)}</td><td>${esc(c.length)} × ${esc(c.width)} × ${esc(c.height)}</td><td>${esc(c.weight)}</td></tr>`).join('')}</tbody></table>`;
}

function documentShell(title, number, body) {
  return `<h2>${esc(title)}</h2><div style="color:#64748b;font-size:12px">Central Tower • ${esc(number)} • ${new Date().toLocaleString()}</div>${body}`;
}

function createQuote() {
  syncStateFromForm();
  const s = state.shipment; const totals = cargoSummary(s);
  const no = `Q-${new Date().toISOString().slice(5,10).replace('-','')}-${Date.now().toString().slice(-3)}`;
  const html = documentShell('Freight Quote Draft', no, `
    <div class="doc-meta"><div><strong>Route</strong><br>${esc(s.origin || '—')} → ${esc(s.destination || '—')}</div><div><strong>Mode</strong><br>${esc(s.mode)}</div><div><strong>Customer</strong><br>${esc(s.customer || '—')}</div><div><strong>Reference</strong><br>${esc(s.reference || '—')}</div></div>
    <div class="doc-block"><strong>Cargo</strong>${cargoTable(s)}<p style="margin-top:8px">Total: ${totals.totalPieces || '—'} pieces • ${totals.totalWeight || '—'} lb</p></div>
    <div class="doc-block"><strong>Commodity</strong><p>${esc(s.commodity || '—')}</p></div>
    <div class="doc-block"><strong>Pickup / Ready</strong><p>${esc(s.pickupAddress || '—')} • ${esc(s.readyDate || '—')}</p></div>
    <div class="doc-block"><strong>Charges</strong><p style="color:#64748b">V1 creates the operational draft. Rate tables and automatic charge calculation are the next connection.</p></div>`);
  saveDocument('Quote', no, html); openDocument('Quote Draft', html);
}

function createDO() {
  syncStateFromForm();
  const s = state.shipment; const totals = cargoSummary(s);
  const no = `DO-${new Date().toISOString().slice(5,10).replace('-','')}-${Date.now().toString().slice(-3)}`;
  const html = documentShell('Delivery Order', no, `
    <div class="doc-meta"><div><strong>Pickup From</strong><br>${esc(s.shipper || '—')}<br>${esc(s.pickupAddress || '—')}</div><div><strong>Deliver To</strong><br>${esc(s.deliveryAddress || '—')}</div><div><strong>Pickup Date</strong><br>${esc(s.readyDate || '—')} ${esc(s.pickupWindow || '')}</div><div><strong>Reference</strong><br>${esc(s.reference || '—')}</div></div>
    <div class="doc-block"><strong>Cargo</strong>${cargoTable(s)}<p style="margin-top:8px">Total: ${totals.totalPieces || '—'} pieces • ${totals.totalWeight || '—'} lb</p></div>
    <div class="doc-block"><strong>Commodity</strong><p>${esc(s.commodity || '—')}</p></div>
    <div class="doc-block"><strong>Instructions / Notes</strong><p>${esc(s.notes || 'Please verify cargo count and condition at pickup and obtain signed proof of delivery.')}</p></div>`);
  saveDocument('Delivery Order', no, html); openDocument('Delivery Order', html);
}

function saveShipment() {
  syncStateFromForm();
  const saved = {...state.shipment, cargo: state.shipment.cargo.map(c=>({...c})), updatedAt:new Date().toISOString()};
  const ix = state.shipments.findIndex(x=>x.id===saved.id);
  if (ix >= 0) state.shipments[ix] = saved; else state.shipments.unshift(saved);
  localStorage.setItem('lct_shipments',JSON.stringify(state.shipments));
  renderLists(); toast('Shipment saved');
}

function saveDocument(type, number, html) {
  state.documents.unshift({id:number,type,shipmentId:state.shipment.id,createdAt:new Date().toISOString(),html});
  state.documents = state.documents.slice(0,50);
  localStorage.setItem('lct_documents',JSON.stringify(state.documents));
  renderLists();
}

function openDocument(title, html) {
  $('#docTitle').textContent = title;
  $('#documentPreview').innerHTML = html;
  $('#documentDialog').showModal();
}

function renderLists() {
  $('#shipmentsList').innerHTML = state.shipments.length ? state.shipments.map(s=>`<div class="list-row"><div><strong>${esc(s.reference || s.id)}</strong><span>${esc(s.shipper || 'Unnamed shipper')}</span></div><div><strong>${esc(s.origin || '—')} → ${esc(s.destination || s.deliveryAddress || '—')}</strong><span>${esc(s.mode)} • ${esc(s.intent)}</span></div><div><strong>${new Date(s.updatedAt || s.createdAt).toLocaleDateString()}</strong><span>${s.cargo?.length || 0} cargo line(s)</span></div><button class="ghost-btn" data-open-shipment="${s.id}">Open</button></div>`).join('') : '<div class="empty">No saved shipments yet.</div>';
  $('#documentsList').innerHTML = state.documents.length ? state.documents.map(d=>`<div class="list-row"><div><strong>${esc(d.type)}</strong><span>${esc(d.id)}</span></div><div><strong>${esc(d.shipmentId)}</strong><span>Shipment</span></div><div><strong>${new Date(d.createdAt).toLocaleDateString()}</strong><span>${new Date(d.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></div><button class="ghost-btn" data-open-doc="${d.id}">Open</button></div>`).join('') : '<div class="empty">No generated documents yet.</div>';
  $$('[data-open-shipment]').forEach(btn=>btn.addEventListener('click',()=>{
    state.shipment = JSON.parse(JSON.stringify(state.shipments.find(s=>s.id===btn.dataset.openShipment)));
    switchView('command'); renderShipment(); window.scrollTo({top:0,behavior:'smooth'});
  }));
  $$('[data-open-doc]').forEach(btn=>btn.addEventListener('click',()=>{
    const d=state.documents.find(x=>x.id===btn.dataset.openDoc); if(d) openDocument(d.type,d.html);
  }));
}

function switchView(view) {
  $$('.view').forEach(v=>v.classList.add('hidden'));
  $$('.nav-item').forEach(n=>n.classList.remove('active'));
  $(`#${view}View`).classList.remove('hidden');
  $(`[data-view="${view}"]`)?.classList.add('active');
  $('#pageTitle').textContent = view==='command' ? 'What needs to happen?' : view==='shipments' ? 'Shipment records' : 'Generated documents';
}

function toast(msg) {
  const t=$('#toast'); t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800);
}

$('#processBtn').addEventListener('click',()=>{
  const text=$('#commandInput').value.trim();
  if(!text){toast('Paste an email or type a command first');return;}
  state.shipment=parseText(text);renderShipment();
  setTimeout(()=>$('#workspace').scrollIntoView({behavior:'smooth',block:'start'}),30);
});

$$('[data-sample]').forEach(btn=>btn.addEventListener('click',()=>{$('#commandInput').value=samples[btn.dataset.sample];}));
$$('.nav-item').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));
$('#newCommandBtn').addEventListener('click',()=>{switchView('command');$('#commandInput').value='';$('#workspace').classList.add('hidden');state.shipment=null;$('#commandInput').focus();});
$('#addCargoBtn').addEventListener('click',()=>{syncStateFromForm();state.shipment.cargo.push({qty:'1',length:'',width:'',height:'',weight:''});renderCargo();});
$$('[data-action]').forEach(btn=>btn.addEventListener('click',()=>{
  if(btn.dataset.action==='quote') createQuote();
  if(btn.dataset.action==='do') createDO();
  if(btn.dataset.action==='save') saveShipment();
}));
$('#closeDialog').addEventListener('click',()=>$('#documentDialog').close());
$('#printDocBtn').addEventListener('click',()=>window.print());
$('#copyDocBtn').addEventListener('click',async()=>{await navigator.clipboard.writeText($('#documentPreview').innerText);toast('Document copied');});

renderLists();
