# NillyView Pro — Ultra-Light 62-Format Image, Camera RAW, SVG & PSD Studio

> **Πανάλαφρος (~220 KB!), minimal Image & Camera RAW Viewer + Quick Editor για Windows 10/11 & Κινητό/Web PWA.**
> **Αντικαθιστά Microsoft Photos (`881 MB`) + Microsoft Paint (`417 MB`) = `1.30 GB` με μόλις `0.22 MB` (5.900× ελαφρύτερο!) και `0 MB` background RAM.**
>
> **created by [Nilly graphics (Sotiris Christos)](https://nillygraphics.com/)**

---

## Γιατί NillyView Pro;

| Λύση | Μέγεθος στον δίσκο | Background RAM | Camera RAW (38+) & HEIC | SVG / PSD / Affinity | Quick Edit (Crop/Blur/WebP) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Microsoft Photos + Paint | **1,298 MB** | 80–250 MB | Μέσω Extensions | Περιορισμένο | Δύο ξεχωριστά apps |
| **NillyView Pro** | **~0.22 MB** | **0 MB** | **Ναι (Native WIC)** | **Ναι (SVG/SVGZ/PSD/TGA/Shell)** | **Ναι (όλα σε 1!)** |

---

## 62+ Υποστηριζόμενα Formats (4-Tier Universal Engine — 0 εξωτερικά DLLs)

1. **Άμεσο Native Stream (< 3 ms):** `JPG`, `JPEG`, `JPE`, `JFIF`, `PNG`, `WebP`, `AVIF`, `GIF` (animated), `BMP`, `DIB`, `ICO`, `SVG` & `SVGZ` (GZip vector).
2. **38+ Camera RAW & Apple / Next-Gen (μέσω Windows 11 WIC + αυτόματο EXIF rotation):**
   - **Canon:** `CR2`, `CR3`, `CRW` · **Nikon:** `NEF`, `NRW` · **Sony:** `ARW`, `SR2`, `SRF` · **Adobe / Apple ProRAW:** `DNG`
   - **Fujifilm:** `RAF` · **Olympus/OM:** `ORF`, `ORI` · **Panasonic/Leica:** `RW2`, `RWL` · **Pentax:** `PEF`, `PTX` · **Samsung:** `SRW`
   - **Hasselblad / PhaseOne / Sigma / Kodak / Minolta / Mamiya / Epson:** `3FR`, `FFF`, `IIQ`, `X3F`, `KDC`, `DCR`, `MRW`, `MEF`, `MOS`, `ERF`, `RAW`, `ARI`, `BAY`, `CAP`, `DCS`, `DRF`, `EIP`, `K25`, `PXN`
   - **Apple / Modern / Pro:** `HEIC`, `HEIF`, `HIF`, `JXL` (JPEG XL), `TIFF` / `TIF` (και CMYK), `DDS`, `JXR` / `WDP` / `HDP`.
   - *(Σημείωση για άλλα Windows PC: τα JPG/PNG/WebP/SVG/TIFF/PSD/TGA παίζουν out-of-the-box παντού. Για Camera RAW & iPhone HEIC σε φρέσκο PC χωρίς codecs, αρκούν τα δωρεάν Microsoft Store extensions «Raw Image Extension» & «HEIF Image Extensions».)*
3. **Ενσωματωμένοι Binary Decoders (Pure C#):** **Adobe Photoshop `PSD`** (RGB/RGBA/CMYK/Grayscale composite & embedded preview), **`TGA`** (24/32-bit uncompressed & RLE).
4. **Windows Shell High-Res Preview Fallback:** **`AFDESIGN`**, **`AFPHOTO`**, **`AFPUB`** (Affinity), **`AI`**, **`EPS`**, **`PSB`**.

---

## Δυνατότητες (Prepress Darkroom Studio)

- **Αστραπιαία Προβολή & Πλοήγηση Φακέλου:**
  - Βελάκια `← / →` (φυσική ταξινόμηση Explorer + background pre-fetch επόμενης/προηγούμενης εικόνας για 0 ms καθυστέρηση ακόμα και σε RAW!).
  - **Λωρίδα Filmstrip (`F`)**, **Slideshow (`F5`)**, **Πλήρης Οθόνη (`F11`)**, **Ασφαλής Διαγραφή στον Κάδο (`Del`)**, **Εμφάνιση στον Explorer (`Ctrl+E`)**.
  - **4 Φόντα Προβολής (`B`):** Dark Studio (`#16171A`), **Διαφάνεια Checkerboard** (για PNG/SVG logos), Light Paper, Pure Black Darkroom.
  - **Zoom & Pan Γραφίστα:** Ροδέλα ποντικιού, `1` = `100%` (με crisp pixel-grid > 250%), `0` / `Space` = Fit, διπλό κλικ εναλλαγή Fit ↔ 100%.
- **Prepress & EXIF Inspector (`I`):**
  - Ζωντανό **RGB Ιστόγραμμα**, διαστάσεις σε **`px`**, **Megapixels**, **Αναλογία**, **Μέγεθος εκτύπωσης σε `mm` & `cm` @ 300 DPI**, χρωματικός χώρος, και πλήρη **EXIF κάμερας** (Κάμερα, Φακός, ISO, Διάφραγμα, Ταχύτητα κλείστρου, Εστιακή απόσταση, Ημερομηνία).
- **Quick Edit (`E` — αντικαθιστά το MS Paint, κρυμμένο όσο απλά βλέπεις εικόνες):**
  - **Rotate ±90° (`L`/`R`)**, **Flip H/V**, **Διαδραστικό Crop (`C`)** με 7 αναλογίες (`Ελεύθερο`, `1:1`, `16:9`, `4:3`, `4:5 IG`, `9:16`, `A4`) & live `W × H px`.
  - **Color Eyedropper (`K`):** 1 κλικ αντιγράφει **HEX**, **RGB** & **CMYK**.
  - **Σχεδίαση & Σημείωση:** Βέλος (`A`), Πλαίσιο (`R`), Στυλό (`P`), Ελληνικό Κείμενο (`T` + φόντο), **Privacy Mosaic Blur (`U`)**, Φωτεινότητα/Αντίθεση/Κορεσμός/B&W, **Undo / Redo (`Ctrl+Z`/`Ctrl+Y`)**, **Αντιγραφή Εικόνας (`Ctrl+C`)** για άμεσο `Ctrl+V` σε NillyDoc Pro / Affinity / Viber!
- **Έξυπνη Εξαγωγή, Μετατροπή & Resize (`Ctrl+S`):**
  - Μορφές: **WebP (SEO)**, **JPG**, **PNG**, **Windows ICO (256px)**
  - Επιλογή μεγέθους **Small (`1200 px`) / Medium (`1920 px`) / Large (`3000 px`) / Original (`100%`)** ή custom `W × H px` με **live εκτίμηση KB/MB**!

---

## Εγκατάσταση σε ΟΠΟΙΟΔΗΠΟΤΕ Windows 10/11 PC (100% Portable · Χωρίς Admin)

1. Κατέβασε το `NillyView-Pro-v1.1-Portable.zip` από τα [GitHub Releases](https://github.com/nillynp/nillyview-pro/releases) και αποσυμπίεσέ το όπου θες (π.χ. `C:\Tools\NillyViewPro`).
2. Τρέξε με διπλό κλικ το **`Install_NillyViewPro.bat`** (δεν απαιτεί δικαιώματα Administrator!).
   - Μεταγλωττίζει αυτόματα το native **`NillyViewPro.exe` (~45 KB)** με τον ενσωματωμένο .NET compiler των Windows (0 εξωτερικά downloads).
   - Εγγράφει όλα τα **62+ formats** στα Windows (`Άνοιγμα με...` & `Προεπιλεγμένες Εφαρμογές`) και φτιάχνει συντομεύσεις σε Desktop & Start Menu.
3. Στις **Ρυθμίσεις Windows → Προεπιλεγμένες εφαρμογές → NillyView Pro**, διάλεξε όποια formats θες να ανοίγουν αυτόματα με διπλό κλικ!

### Απεγκατάσταση
Τρέξε το **`Uninstall_NillyViewPro.bat`** (αφαιρεί καθαρά μόνο τις εγγραφές & συντομεύσεις χωρίς να αγγίξει καμία εικόνα σου).

---

## Web / Mobile PWA Έκδοση
Ο φάκελος **`web/`** λειτουργεί 100% αυτόνομα σε οποιοδήποτε static hosting (π.χ. `https://nillygraphics.com/nillyview/`) ή κινητό (iPhone/Android) — 100% client-side, 0 uploads!

## Πιστώσεις & Άδεια
- **Δημιουργός:** **created by [Nilly graphics (Sotiris Christos)](https://nillygraphics.com/)**
- **Άδεια:** MIT License
- **Συνοδευτικά Δωρεάν Εργαλεία:** [NillyDoc Pro (PDF Studio)](https://github.com/nillynp/nillydoc-pro) · [Nilly PC Manager & Tools](https://github.com/nillynp/nilly-pc-manager-tools)
