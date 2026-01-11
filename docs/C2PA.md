# C2PA Implementation Guidelines for thecontrarian.in

This document translates the [C2PA Implementation Guidance 2.2](https://spec.c2pa.org/specifications/specifications/2.2/guidance/Guidance.html) into concrete requirements for thecontrarian.in. It is non-normative but should be treated as the baseline for implementation choices.[1]

***

## 1. Overall goals

- Attach C2PA Content Credentials (manifests) to all supported media assets (images, video; optionally audio, documents).[1]
- Preserve and update provenance as assets move through internal pipelines and are republished on the web.[1]
- Expose provenance to users via C2PA-aware clients and/or a small JavaScript verification widget.[1]

***

## 2. High‑level architecture

### 2.1 Components

- **Claim generator(s)**  
  - Signing service or tool that creates C2PA Manifests and signs claims.[1]
  - May live in:  
    - Ingestion pipeline (upon upload or generation).  
    - Editing/export tools (for internal workflows).[1]

- **Manifest store (per asset)**  
  - Embedded C2PA Manifest Store inside the asset (preferred when format supports it: JPEG, PNG, TIFF, GIF, MP4, etc.).[1]
  - Optional **external manifest repository** (for formats that do not embed manifests, legacy media, or when external storage/search is needed).[1]

- **Manifest repository service (optional, recommended)**  
  - HTTP service holding C2PA Manifest Stores keyed by:  
    - Asset URL.  
    - Soft binding identifiers (watermarks / fingerprints).[1]
  - Exposed via HTTP `Link` headers and/or Soft Binding Resolution API.[1]

- **Manifest consumer(s)**  
  - Web client component (JS) that:  
    - Fetches asset.  
    - Locates embedded or external C2PA Manifest Store.  
    - Validates signatures, bindings, and selected assertions.[1]

***

## 3. Manifests: when and how to create

### 3.1 When to create a new manifest

Create a **standard C2PA Manifest** on significant lifecycle events only, to reduce cost and simplify validation:[1]

- Initial asset creation (upload, capture, or de novo generation, including generative AI).[1]
- Export/publish from editing tools.[1]

Use an **update C2PA Manifest** when only the manifest changes (e.g., add or redact assertions, add soft bindings, add publisher info) and the underlying media bytes remain unchanged.[1]

### 3.2 Embedded vs external manifests

- **Preferred:** Embed the C2PA Manifest Store in the asset when the format supports it (e.g., JPEG, PNG, TIFF, GIF, ISO BMFF/MP4).[1]
- **External manifests:**  
  - Use when:  
    - Format does not support embedding (e.g., plain text, some XML/HTML).  
    - Existing legacy media cannot be modified.  
    - Storage/search workflows benefit from separation.[1]
  - Expose location via:  
    - HTTP `Link` headers as described in the C2PA spec (`rel="c2pa"` or equivalent).[1]

### 3.3 Don’t remove or replace manifests lightly

- Avoid fully removing an embedded C2PA Manifest Store unless you are **externalizing** it (replacing it with a URI to an external repository).[1]
- Avoid replacing an entire C2PA Manifest Store because it breaks provenance; if done, document policy and ensure reason (e.g., stripping detailed capture metadata, keeping only publisher attribution).[1]

***

## 4. Content bindings (hard and soft)

### 4.1 Hard bindings (mandatory)

Every C2PA Manifest **must** include a hard binding to the asset’s digital content to make tampering evident.[1]

#### 4.1.1 Hash algorithm choice

- Use **SHA‑256** (`SHA2-256`) as the default hashing algorithm for:  
  - Content bindings.  
  - Hashing assertions.  
  - `hashed-uri` structures.[1]

#### 4.1.2 Binding strategies by format

- **General box bindings (preferred where supported)**  
  - For box‑structured formats (JPEG, PNG, TIFF, GIF, etc.), use general box hash assertions instead of pure byte‑range bindings.[1]
  - Hash logical boxes/chunks; follow C2PA general box hash spec.[1]

- **ISO BMFF / MP4**  
  - Use ISO BMFF bindings integrated with the box structure and **exclusion lists**.[1]
  - Only add boxes to exclusion lists if changing them does **not** alter AV presentation and does not declare external content that must remain tamper‑evident.[1]

- **Byte‑range bindings (fallback only)**  
  - Use plain byte‑range hashing only if no other binding type is possible.[1]

#### 4.1.3 Hash algorithm consistency

- Use the same hashing algorithm for content binding and for hashing assertions in the manifest.[1]

### 4.2 Soft bindings (optional but recommended)

Soft bindings (perceptual hashes, invisible watermarks) help recover provenance when metadata has been stripped or manifests are external.[1]

#### 4.2.1 Design rules

- **Never** substitute soft bindings for hard bindings. Hard bindings remain the canonical tamper‑evidence mechanism.[1]
- Treat soft‑binding matches as candidates that must be:  
  - Visually or otherwise verified (e.g., show thumbnail to user).[1]
- Implement lookups via the **C2PA Soft Binding Resolution API**, which supports both watermark IDs and fingerprints.[1]

#### 4.2.2 Invisible watermarking

If you choose watermarking:

- For each watermarked asset:  
  - Apply a watermark algorithm from the **C2PA Soft Binding Algorithm List** (`alg` identifier).[1]
  - Add a `c2pa.watermarked` action to the manifest.[1]
  - Add a soft bindings assertion with:  
    - Algorithm identifier (`alg`).  
    - Soft binding identifier used to query the manifest repository.[1]

- Optionally store a fingerprint as a soft binding assertion as extra check against watermark spoofing (compare fingerprint at lookup time).[1]

#### 4.2.3 Soft binding lookup workflow

- When an asset arrives **without** an embedded manifest:  
  - Compute configured soft binding(s) client‑side.[1]
  - Call your Soft Binding Resolution API endpoint (or federated services).[1]
  - Present returned candidate manifests and associated thumbnails to the user for confirmation.[1]

#### 4.2.4 Privacy and opt‑in

- Compute soft bindings on the **client** where possible to avoid sending full asset data to lookup services.[1]
- Make querying manifest repositories **user‑initiated** (explicit action) and/or clearly communicated (opt‑in).[1]

***

## 5. Assertions to support

### 5.1 Mandatory / core assertions

- **Actions assertion (`c2pa.actions`)**  
  - Every standard manifest must contain at least one **actions assertion** describing either:  
    - `c2pa.created` (new asset, including generative AI); or  
    - `c2pa.opened` (editing an existing asset, with ingredient reference).[1]
  - If content is created (not just opened), include an appropriate `digitalSourceType`.[1]

- **Ingredients assertion(s)**  
  - Represent source assets as ingredients with relationship:  
    - `parentOf` – original asset opened then exported/edited.[1]
    - `componentOf` – compositing from multiple assets.[1]
    - `inputTo` – prompts, seed images, or other AI inputs.[1]

### 5.2 AI/ML provenance

- For AI/ML usage in **actions**:  
  - Use `digitalSourceType` values such as:  
    - `http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia` for assets created by AI/ML systems.[1]
    - `http://cv.iptc.org/newscodes/digitalsourcetype/compositedWithTrainedAlgorithmicMedia` for edits like inpainting using AI.[1]

- For AI/ML usage in **ingredients**:  
  - Record model and prompt information in ingredient assertions as per spec (model metadata, prompts, seeds, etc.).[1]

### 5.3 Actions assertion: ordering and custom actions

- Emit actions in chronological order **within** each `c2pa.actions` block and use increasing suffixes (`c2pa.actions__1`, etc.) for later lists.[1]
- Do **not** rely on order in validation; use timestamps (`when` fields) where present.[1]
- For custom actions:  
  - Use standard custom label syntax (e.g., `com.yoursite.customAction`).[1]
  - Add human‑readable `description` fields where semantics are not obvious.[1]

### 5.4 Thumbnails

- Thumbnails for ingredients are optional but useful. When adding:[1]
  - Use widely supported formats (e.g., raster image for video).[1]
  - Ensure thumbnails are safe: avoid formats or features that can embed active code; sanitize SVG if used.[1]
  - Strip unnecessary metadata and PII from thumbnails.[1]

### 5.5 Identity assertions

- Use identity assertions when you need explicit attribution metadata that cannot be inferred solely from the claim signer and trust list.[1]
- Identity assertion should:  
  - Cryptographically sign at least the hard binding assertion and related statements.[1]
  - Include an RFC 3161‑compliant timestamp.[1]

***

## 6. Cryptography and keys

### 6.1 Hash and signature algorithms

- **Hashing**:  
  - Default: **SHA2‑256**.[1]

- **Key types and sizes for signing credentials**:  
  - Preferred: ECC key pair on P‑256 or X25519.[1]
  - Alternative: RSA 2048‑bit.[1]

- **Signature algorithms for manifests**:  
  - `ES256` (ECDSA with SHA‑256) for P‑256/P‑384/P‑521.[1]
  - `EdDSA` (Ed25519) for X25519‑based keys.[1]
  - `PS256` (RSASSA‑PSS with SHA‑256) for RSA.[1]

### 6.2 Timestamps and revocation

- At signing time, attach:  
  - Time‑stamp token.  
  - Credential freshness / revocation information in the COSE signature.[1]
- If online time‑stamping is not possible (offline device):  
  - Issue a **Time‑Stamp Manifest** as soon as possible to provide proof‑of‑existence at a given time.[1]

### 6.3 Key protection

- Store claim signing keys in secure hardware or managed key services when possible (HSMs, cloud KMS, platform secure enclaves).[1]
- Minimize key reuse and rotate keys when compromise is suspected.[1]

***

## 7. Validation on the website

### 7.1 Validation responsibilities

The frontend validator (or backend verification service) should:

- Parse the C2PA Manifest Store (embedded or fetched externally).[1]
- Verify:  
  - Hard bindings (hashes vs asset bytes).[1]
  - Digital signatures and certificate chain according to your trust policy.[1]
  - Manifest structure against C2PA schemas where practical.[1]

- For ingredients with their own manifests, decide whether and how deeply to validate ingredient manifests.[1]

### 7.2 Security practices for validation

- Treat manifest content as untrusted input:  
  - Filter or escape user‑generated text fields before display (avoid code injection in HTML/JS contexts).[1]
  - Avoid blindly embedding URLs from assertions into iframes or scriptable contexts.[1]

- Validate data fields against schemas and expected types before use.[1]

***

## 8. Manifest repositories and DLT (optional/advanced)

### 8.1 Manifest repository behavior

If \<your-site\> runs a manifest repository:

- Serve manifests from the **same origin** as the content when possible to simplify CORS.[1]
- Provide creators with controls to:  
  - Redact or remove manifests.  
  - Choose which manifests are publicly discoverable.[1]

### 8.2 Distributed ledger / immutability (optional)

- For stronger guarantees of repository integrity, consider storing manifest digests or transaction logs on a distributed ledger/blockchain.[1]

***

## 9. Privacy, UX, and policy hooks

### 9.1 Privacy

- Provide clear policy on:  
  - What metadata is included in manifests (especially PII).[1]
  - What is stored in external manifest repositories and who can query it.[1]

- Allow creators to:  
  - Publish “rich internal” manifests and separate redacted public manifests.[1]

### 9.2 UX separation

- UX details (icons, tooltips, etc.) are governed by separate C2PA User Experience Guidance and are **not** covered here, but the implementation must expose enough validated data for UX to be meaningful (source, actions, AI usage, signing party, timestamps).[1]

***

## 10. Implementation checklist

Use this as a quick checklist during development:

- [ ] Assets use supported formats with embedded manifests where possible.[1]
- [ ] Standard manifests created only on significant events; update manifests used for manifest‑only changes.[1]
- [ ] Hard bindings implemented using SHA‑256 and appropriate binding type (general box / ISO BMFF / byte range fallback).[1]
- [ ] Actions assertions always include `c2pa.created` or `c2pa.opened` with `digitalSourceType` when applicable.[1]
- [ ] Ingredients and AI/ML usage recorded with correct relationships and `digitalSourceType` values.[1]
- [ ] Optional soft bindings (watermarks/fingerprints) implemented via C2PA‑listed algorithms and Soft Binding Resolution API.[1]
- [ ] Signing keys use recommended key types and algorithms; timestamps and revocation/freshness info attached.[1]
- [ ] Validation code checks signatures, bindings, schemas, and sanitizes any user‑generated text before rendering.[1]
- [ ] Manifest repository (if used) supports creator control and respects privacy considerations.[1]

***

[1] [https://spec.c2pa.org/specifications/specifications/2.2/guidance/Guidance.html](https://spec.c2pa.org/specifications/specifications/2.2/guidance/Guidance.html)