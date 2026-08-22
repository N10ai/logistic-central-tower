// Professional document templates layered over the V1 command engine.
const companyProfile={
  name:'MIP Cargo Express',
  tagline:'Freight Forwarding • Warehousing • Logistics',
  logo:'https://i.imgur.com/xeQk1Rm.png',
  address:'Miami, Florida',
  phone:'',
  email:'',
  website:''
};

function docValue(v,fallback='—'){return v&&String(v).trim()?esc(v):fallback}
function cargoTotals(s){return(s.cargo||[]).reduce((a,c)=>{a.qty+=Number(c.qty)||0;a.weight+=Number(c.weight)||0;return a},{qty:0,weight:0})}
function fullCargoTable(s){return `<table class="ops-cargo"><thead><tr><th>PCS / PLTS</th><th>DIMENSIONS (IN)</th><th>WEIGHT (LB)</th><th>COMMODITY</th></tr></thead><tbody>${(s.cargo||[]).map(c=>`<tr><td>${docValue(c.qty)}</td><td>${docValue(c.length,'')} × ${docValue(c.width,'')} × ${docValue(c.height,'')}</td><td>${docValue(c.weight)}</td><td>${docValue(s.commodity)}</td></tr>`).join('')}</tbody></table>`}
function partyBox(title,name,address,extra=''){return `<div class="party-box"><div class="party-label">${title}</div><div class="party-name">${docValue(name)}</div><div>${docValue(address)}</div>${extra?`<div class="party-extra">${extra}</div>`:''}</div>`}
function documentHeader(type,no){return `<div class="ops-doc"><div class="ops-header"><div class="ops-brand"><img src="${companyProfile.logo}" alt="${companyProfile.name}" onerror="this.style.display='none'"><div><div class="ops-company">${companyProfile.name}</div><div class="ops-tagline">${companyProfile.tagline}</div><div class="ops-contact">${companyProfile.address}${companyProfile.phone?' · '+companyProfile.phone:''}${companyProfile.email?' · '+companyProfile.email:''}</div></div></div><div class="ops-title"><h1>${type}</h1><strong>${no}</strong><span>${new Date().toLocaleDateString()}</span></div></div>`}
function documentFooter(){return `<div class="ops-footer"><div><strong>Prepared by ${companyProfile.name}</strong><br><span>This document contains operational transportation instructions. Verify cargo, references and locations before execution.</span></div><div class="signature"><span>Driver / Carrier Signature</span><div></div><span>Date / Time</span></div></div></div>`}

// Replace the lightweight V1 DO with an operational template.
createDO=function(){
  sync();
  const s=state.shipment;
  const no=`DO-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${Date.now().toString().slice(-4)}`;
  const t=cargoTotals(s);
  const shipperExtra=s.reference?`Reference: <strong>${docValue(s.reference)}</strong>`:'';
  const consigneeName=s.consignee||s.customer||s.deliveryAddress;
  const html=`${documentHeader('DELIVERY ORDER',no)}
    <div class="ops-refbar"><div><span>Customer</span><strong>${docValue(s.customer)}</strong></div><div><span>Customer / WR / PO Ref.</span><strong>${docValue(s.reference)}</strong></div><div><span>Mode</span><strong>${docValue(s.mode)}</strong></div><div><span>Carrier / Trucker</span><strong>${docValue(s.carrier)}</strong></div></div>
    <div class="party-grid">
      ${partyBox('SHIPPER / PICKUP FROM',s.shipper,s.pickupAddress,shipperExtra)}
      ${partyBox('CONSIGNEE / DELIVER TO',consigneeName,s.deliveryAddress,s.destination?`Destination: <strong>${docValue(s.destination)}</strong>`:'')}
    </div>
    <div class="ops-schedule"><div><span>Pickup / Ready Date</span><strong>${docValue(s.readyDate)}</strong></div><div><span>Pickup Window</span><strong>${docValue(s.pickupWindow)}</strong></div><div><span>Origin</span><strong>${docValue(s.origin||s.pickupAddress)}</strong></div><div><span>Destination</span><strong>${docValue(s.destination||s.deliveryAddress)}</strong></div></div>
    <div class="ops-section"><div class="ops-section-title">CARGO DETAILS</div>${fullCargoTable(s)}<div class="cargo-total"><strong>TOTAL</strong><span>${t.qty||'—'} pcs/plts</span><span>${t.weight||'—'} lb</span></div></div>
    <div class="ops-section"><div class="ops-section-title">SPECIAL INSTRUCTIONS</div><div class="instruction-box">${docValue(s.notes,'Verify piece count and cargo condition at pickup. Confirm all references before loading. Obtain signed POD at delivery and report any discrepancy immediately.')}</div></div>
    <div class="ops-section compact"><div class="ops-section-title">DRIVER / WAREHOUSE USE</div><div class="check-grid"><span>☐ Cargo inspected</span><span>☐ Piece count verified</span><span>☐ Documents received</span><span>☐ POD obtained</span></div></div>
    ${documentFooter()}`;
  saveDoc('Delivery Order',no,html);
  openDoc('Delivery Order',html);
};
