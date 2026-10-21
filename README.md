# Campus Bike Rental (browser demo)

React + TypeScript + Vite + Tailwind + Lucide. Runs fully in the browser.

## Run
    npm install
    npm run dev        # open the printed URL (http://localhost:5173)
    npm run build      # production build in dist/

## Demo walkthrough
1. Explore: click a station (map or card), press **Select & book**, choose bike and hours, confirm the *simulated* payment.
2. Ticket: copy the 6-digit pickup code shown on the ticket, enter it, press **Activate**.
3. Manage: pick any drop-off station (can differ from pickup), enter its return code, confirm.
   Demo return codes: A Wing `RET-AW`, B Wing `RET-BW`, C Wing `RET-CW`, Library Entrance `RET-LIB`, Hostel `RET-HOS`.
4. History shows all rentals. Manage > Demo dashboard (PIN `1234`) adjusts inventory and lists rentals.

## Important limitations
- All data lives in this browser's localStorage. It is NOT shared between users or devices.
- Payments are simulated; no money moves. Station coordinates are approximate demo values (see `src/store.ts`).
- The QR code is generated for display only; there is no QR scanner. Use the pickup code.
- The admin PIN and return codes are client-side and provide NO real security.

## Adding FastAPI + PostgreSQL later
`src/store.ts` is the only data layer. Replace `book`, `pickup`, `giveBack`, `adjust` with `fetch` calls to
`POST /rentals`, `POST /rentals/{id}/pickup`, `POST /rentals/{id}/return`, and admin endpoints, and load stations from
`GET /stations`. Move price calculation, code validation, inventory updates (in DB transactions) and admin auth to the backend.
