# Glow परत आणा — काढू नका

## समस्या
- मागील फिक्समध्ये keypad कीड्सचा glow पूर्ण काढला होता — आता टॅप केल्यावर काहीच glow दिसत नाही.
- बऱ्याच ठिकाणी glow फक्त `hover:` वर आहे — मोबाइल/टचवर hover नसतो, म्हणून neon glow दिसतच नाही.

## उपाय

### 1. Keypad कीड्सवर टॅप glow
`src/components/MathKeypad.tsx` + `src/index.css`:
- की दाबल्यावर (`:active`) primary glow दिसेल — `box-shadow: var(--glow-primary)` + primary border.
- बोट काढताच glow लगेच नाहीसा — कधीही टिकून राहणार नाही.
- आधीचा फिक्स तसाच ठेवू: tap नंतर `blur()`, focus ring फक्त `focus-visible` (कीबोर्डवर), hover फक्त `@media(hover:hover)`.
- `:active` हे CSS-पुरवठा केलेले असल्याने release होताच स्वयंदुरुस्त होते — stuck glow ची शक्यताच नाही.

### 2. अ‍ॅपभर neon glow परत (टच-फ्रेंडली)
Glow फक्त hover न ठेवता resting/press glow:
- **Home + Learning कार्ड्स** (`Index.tsx`, `LearningPage.tsx`): हलका resting glow + दाबल्यावर जास्त glow (`active:` state).
- **BottomNav** (`BottomNav.tsx`): सक्रिय टॅबला primary glow + icon text-glow.
- **gradient-primary बटणे** (Start Quiz, Submit, Retry, इ.): जिथे आधीच नाही तिथे resting glow (`shadow-[0_0_24px_hsl(var(--primary)/0.5)]`).
- **Progress कार्ड्स / DesktopStatsPanel**: हलका resting glow.
- सर्व ठिकाणी आधीची theme-aware `--glow-primary`/`--glow-accent` व्हॅल्यूज वापरू — 4 थीम आणि light mode स्वयंदुरुस्त राहतील.

### 3. कामगिरी न बिघडवता
- फक्त box-shadow glow — कोणताही जड backdrop-blur नाही.
- `html.low-power` मध्ये glow आधीच बंद आहे — तसेच राहील.
- प्रत्येक स्क्रीनवर glow फक्त महत्त्वाच्या element वरच — कार्ड्स, बटणे, सक्रिय टॅब.

## बदल नाही
- Keypad चे number/logic, quiz लॉजिक, नेव्हिगेशन, थीम सिस्टम — काहीही बदलणार नाही.
- Stuck-glow फिक्स (टॅप नंतर glow टिकत नाही) कायम राहील.

## तपासणी
- Build OK.
- Playwright: mobile viewport — keypad की दाबून glow दिसतो/सुटतो याचे स्क्रिनशॉट; Home व BottomNav वर glow दिसतो याची पडताळणी.
