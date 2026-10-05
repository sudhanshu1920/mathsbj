# Desktop Shortcuts On/Off Setting

## Changes
- Settings मध्ये `Keyboard shortcuts` नावाचा On/Off switch Sound आणि Vibration जवळ जोडू.
- हा switch default `On` ठेवू, त्यामुळे सध्याचे shortcut वर्तन बदलणार नाही.
- वापरकर्त्याची निवड device वर save राहील आणि app पुन्हा उघडल्यावरही लागू होईल.
- switch `Off` असताना `1`, `2`, `3`, `?`, `Esc`, आणि `Ctrl/Cmd + K` हे app-level desktop shortcuts बंद राहतील.
- text fields, dialogs आणि quiz मधील सामान्य keyboard वापरावर परिणाम होणार नाही.
- switch पुन्हा `On` केल्यावर shortcuts लगेच सुरू होतील.

## Verification
- Settings switch ची स्थिती reload नंतर टिकते हे तपासू.
- Off स्थितीत सर्व app-level shortcuts निष्क्रिय आणि On स्थितीत पुन्हा कार्यरत आहेत हे desktop mode मध्ये तपासू.
- mobile layout आणि विद्यमान navigation बदललेले नाहीत हे पडताळू.

## Technical notes
- Existing settings storage मध्ये `keyboardShortcuts` boolean आणि setter जोडू.
- `Index` मधील centralized keyboard listener saved setting तपासूनच shortcut actions चालवेल.
