# Reference distillation contract

## Reference

- Retained reference: `C:\Users\johnley\Downloads\CargoExpressFlowchart.docx`
- SHA-256: `f8e1fc694236849bac32769cbee199f422efc7d9de703f5aec319cc344f44c4e`
- Size: 1,760,053 bytes
- Package parts: 19
- Distillation evidence: `C:\batuan-voting\flowchart_build\reference_inspection\inspection.json`
- Extracted figure images: `C:\batuan-voting\flowchart_build\reference_inspection\image1.png` through `image7.png`

## Page / section system

- The reference contains 3 Word sections and 7 embedded drawings.
- Each drawing is a rasterized flowchart figure; the visible figure labels are Figure 2 through Figure 8.
- The visual pattern is a dark/black canvas with white flowchart nodes, light text, and small Y/N branch labels.
- Flowcharts are wide, menu-driven, and decomposed into off-page connector figures.

## Content structure to retain

- Figure 2: public landing/authentication.
- Figure 3: authenticated student/customer-style dashboard.
- Figure 4: administrator dashboard.
- Figure 5: operational submodules.
- Figure 6: inbox/secondary operational flow.
- Figure 7: feedback/company-information style submodule.
- Figure 8: final module continuation.

## User-required deviation

The reference embeds figures as images, but the user explicitly requires human customization. The Batuan deliverable therefore retains the Figure 2–8 decomposition and dark/light visual cue while implementing every node as an editable Word table cell. No reference image is copied into the final document.

## Batuan source-of-truth files reviewed

- `src/App.jsx`
- `src/api/client.js`
- `src/contexts/AuthContext.jsx`
- `src/pages/AuthPage.jsx`
- `src/pages/ChangePassword.jsx`
- `src/pages/Index.jsx`
- `src/pages/Candidates.jsx`
- `src/pages/VotePage.jsx`
- `src/pages/Results.jsx`
- `src/pages/Admin.jsx`
- `src/components/Layout.jsx`
- `server/schema.sql`
- `server/migration-election-history.sql`
