# Healthcare — Modern Luxury Digital Healthcare Platform

A complete architectural and visual redesign into a sophisticated, luxury digital healthcare platform combining the refined human-centered care of luxury wellness brands, contemporary medical technology, and minimalist editorial design.

---

## 🏛️ Brand & Creative Direction

### 1. Palette & Design Tokens
- **Primary Forest Green**: `#244C3B` (`bg-forest` / `text-forest`) — Used for primary actions, selected states, and active navigation.
- **Deep Green**: `#18372B` (`bg-deep` / `text-deep`) — Used for the AI Health Assistant section, video consultation preview, and editorial headers.
- **Secondary Sage Green**: `#9CAF96` (`bg-sage` / `text-sage`) — Subtle highlights, indicators, and organic accents.
- **Warm Ivory**: `#F8F7F2` (`bg-ivory`) — Primary global canvas background.
- **Soft Cream**: `#F1EFE7` (`bg-cream`) — Contrasting container backgrounds for step cards and payment summaries.
- **Pure White**: `#FFFFFF` — Editorial card and input surfaces.
- **Muted Champagne**: `#D6C3A1` (`text-champagne` / `border-champagne`) — Used sparingly for luxury accents, star ratings, and subtle borders.
- **Primary Text**: `#202B25` — Deep charcoal-forest typography.
- **Secondary Text**: `#69746D` — Balanced slate-sage metadata.
- **Delicate Borders**: `#E8E8DF` — Refined separation lines.

### 2. Editorial Typography
- **Headings & Display**: Editorial serif stack (`Playfair Display`, `DM Serif Display`, `Georgia`, serif) with relaxed letter-spacing and human-centered editorial tone.
- **Body & Controls**: Modern sans-serif stack (`Plus Jakarta Sans`, `Inter`, -apple-system, sans-serif) for high legibility across metadata, form fields, and dashboard statistics.

---

## 🌟 Transformed Experiences Across the Platform

### 1. Asymmetric Editorial Homepage (`/`)
- **Hero Section**:
  - Left column: Editorial headline *"Care that feels personal. Healthcare that moves forward."*, warm narrative, and dual-button CTA hierarchy (*"Find a Doctor"* and *"Explore Healthcare"*).
  - Integrated Search Experience: Unified search bar with doctor/specialty keyword, metropolitan city selector, and consultation format toggle (All / Video / In-Clinic).
  - Right column: Authentic medical photograph of a senior consultant in a welcoming modern clinic, layered with floating status indicators (Next available slot today at 4:30 PM, Ultra-HD video active, and verified credentials).
- **Specialty Discovery**:
  - Differentiated composition: 2 featured showcases (General Physician & Dermatology) with symptom pills, followed by an editorial grid of 8 specialties with custom iconography.
- **Featured Practitioners**:
  - Asymmetric physician cards showing degrees, state council licensing numbers, clinical experience, patient ratings, and consultation fees in INR (`₹`).
- **Care Continuum (How It Works)**:
  - 4 numbered editorial steps highlighting unhurried care from initial query to follow-up.
- **AI Health Assistant Showcase**:
  - Distinctive Deep Green (`#18372B`) section titled *"Intelligent healthcare begins with understanding."* with structured symptom discussion, lab report interpretation, and a live chat preview with clear medical disclaimers.
- **Ultra-HD Telehealth Showcase**:
  - Visual composition of a live encrypted video call with an interactive *"Launch Live Demo Room"* button that opens a distraction-free telemedicine modal with mute, video, and in-call messaging controls.
- **Integrity & Governance**:
  - Minimal clean cards highlighting council-audited doctors, encrypted medical vaults, data dignity, and transparent fees.
- **Testimonials & Full-Width CTA**:
  - Editorial patient narratives in serif italic, finishing with a full-width forest-green membership banner.

### 2. Doctor Discovery Directory (`/doctors`)
- Multi-criteria real-time filtering: search query, 10 specialties, Indian cities, consultation mode, experience slider, fee range slider in INR, and minimum star ratings.
- Sorting by relevance, highest rating, experience, and fee (low-to-high / high-to-low).

### 3. Doctor Profile View (`/doctor/[id]`)
- Editorial split layout with large portrait, medical council license number (e.g. `KMC-48291-KA`), clinical biography, hospital affiliations, language proficiencies, and verified patient reviews.
- Seamless booking modal with time slot selector and an **integrated payment interface** (UPI, Cards, Net Banking) with instant confirmation.

### 4. Patient Sanctuary Dashboard (`/patient/dashboard`)
- Calm, decluttered layout with personalized welcome banner (blood group, age, emergency contact).
- Scheduled consultations with one-click entry to encrypted telehealth rooms.
- Authenticated digital prescription viewer displaying structured medication tables.
- Diagnostic medical records library and direct access to the AI Health Navigator.

### 5. Physician Workspace (`/doctor/dashboard`)
- Live consultation schedule, active session indicator, and clinical charting drawer allowing doctors to review intake notes and digitally sign/issue e-prescriptions.
- Practice revenue summary in INR (`₹`) and weekly slot calendar controls.

### 6. Administrative Governance Console (`/admin/dashboard`)
- Executive dashboard with patient/doctor metrics, monthly platform GMV, volume distribution across medical specialties, and an interactive **Doctor Credential Verification Queue** with document audit and one-click approval/rejection.

### 7. AI Health Navigator (`/ai-assistant`)
- Deep Green (`#18372B`) and Warm Ivory (`#F8F7F2`) conversational interface with suggested starter topics, symptom guidance, lab report interpretation (e.g. HbA1c prediabetes), and embedded specialist cards.

---

## 🚀 Running the Project Locally

### Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build & Run
```bash
npm run build
npm start
```

### Code Quality
```bash
npm run lint
```
