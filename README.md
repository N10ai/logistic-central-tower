# Logistics Central Tower

A lightweight logistics operations command center focused on one principle: **type less, approve faster**.

## V1

The first version is intentionally dependency-free and can run as a static site / GitHub Pages app.

### Current workflow

1. Paste a customer email or type an operational command.
2. The app identifies the likely intent: quote, pickup / delivery order, consolidation, AES, or shipment.
3. It extracts common shipment data into one reusable shipment record.
4. Missing operational fields are highlighted for review.
5. Generate a printable Quote Draft or Delivery Order.
6. Save shipment records and generated documents locally in the browser.

### Included

- Universal command / paste box
- Basic extraction for routes, pieces, dimensions, weight, references, dates, addresses, mode, and commodity
- Shipment review screen
- Missing-field validation based on intent
- Cargo lines
- Quote draft generation
- Delivery Order generation
- Print / Save PDF via the browser
- Local shipment and document history
- Responsive desktop/mobile UI

## Architecture direction

V1 uses local rule-based extraction so it works with no backend or API key. The UI and shipment model are designed to later connect to:

- AI extraction for unstructured emails, PDFs, screenshots, and documents
- Gmail / Microsoft 365 intake
- Supabase for users, customers, shipment records, templates, and audit history
- Rate tables and automatic quote calculation
- Magaya / WMS / TMS data
- Saved trucking companies, airlines, terminals, warehouses, and customer profiles
- Booking, AES preparation, shipping instructions, HBL / MBL workflows

## Run locally

Open `index.html` in a browser, or serve the folder with any static web server.

## Files

- `index.html` — application shell and views
- `styles.css` — responsive operations UI
- `app.js` — extraction, shipment state, local storage, and document generation
