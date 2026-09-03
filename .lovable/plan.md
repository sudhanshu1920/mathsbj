# App Frame: 9:16 on Mobile, 16:9 on Desktop, Always Inside the Screen

## Goal
App चा content area screen नुसार आपोआप fit व्हावा — mobile layout मध्ये 9:16 portrait frame, desktop mode मध्ये 16:9 landscape frame. काहीही screen च्या बाहेर जाऊ नये (उजवीकडे scroll / cut-off नको).

## How it will work

1. **App frame wrapper**
   - `Index.tsx` मधल्या main container ला एक `app-frame` wrapper दिला जाईल.
   - Mobile (default): frame ची width = available width, height = width × 16/9, पण जास्तीत जास्त viewport height (`100dvh`) पर्यंत मर्यादित. Height कमी पडली तर width आपोआप कमी होऊन ratio टिकेल.
   - Desktop mode (`html.desktop-mode`): तोच frame 16:9 होईल — width = height × 16/9, viewport width पेक्षा कधीच जास्त नाही.
   - Frame नेहमी horizontally center; उरलेली जागा app च्या background ने भरली जाईल (letterbox).

2. **Content scroll frame च्या आत**
   - Frame ची height fix असल्याने आतला content `overflow-y: auto` ने scroll होईल, page नाही. Bottom nav आणि fixed submit bar frame च्या bottom शी align राहतील.

3. **Overflow guard (screen बाहेर जाणे बंद)**
   - `html, body { overflow-x: hidden; max-width: 100%; }`
   - Frame आणि त्यातील flex/grid children ना `min-width: 0`, `max-width: 100%` जेणेकरून लांब numbers, fractions, keypad rows कधीही बाहेर ढकलणार नाहीत.
   - Grid gaps/padding frame width नुसार clamp केले जातील.

4. **Small screens safety**
   - खूप कमी height असलेल्या phones वर ratio टिकवण्यासाठी width shrink होईल, पण minimum readable font size (existing `--font-scale`) कायम राहील.
   - Safe-area insets (notch / gesture bar) frame मध्ये respect केले जातील.

## Technical notes
- नवीन CSS block `src/index.css` मध्ये (`.app-frame`, aspect-ratio + `dvh` based sizing, desktop-mode override).
- `src/pages/Index.tsx` मध्ये फक्त wrapper markup/class बदल; existing `max-w-lg` container frame च्या आत राहील.
- Fixed elements (bottom nav, submit bar) frame-relative करण्यासाठी frame ला `position: relative` आणि त्या bars ना `position: absolute` (mobile safe-area कायम).
- कोणतीही business logic, practice/analytics/sync code बदलणार नाही.
