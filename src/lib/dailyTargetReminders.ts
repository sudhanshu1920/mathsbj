import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { getStreak, todayStr } from '@/lib/streak';

export const DAILY_REMINDER_POLICY_VERSION = 3;

/** Local device time, in minutes after midnight. One native AlarmManager alarm is queued at a time. */
export const DAILY_REMINDER_MINUTES = [
  9 * 60, 10 * 60, 11 * 60, 12 * 60, 13 * 60, 14 * 60, 15 * 60, 16 * 60,
  17 * 60, 18 * 60, 19 * 60, 19 * 60 + 45, 20 * 60 + 30, 21 * 60,
  21 * 60 + 30, 21 * 60 + 50, 22 * 60,
] as const;

/**
 * Each inner array belongs to the matching DAILY_REMINDER_MINUTES stage.
 * %1$d is the remaining study-target time (minutes); %2$d is the actual
 * minutes left until the local 10 PM cutoff. The target source of truth is
 * streak.ts and is measured in study minutes, not question counts.
 */
export const MARATHI_REMINDER_MESSAGES = [
  [
    "उठ चॅम्पियन! आजचं टार्गेट तुझी वाट पाहतंय! अजून %1$d मिनिटं 💪",
    "आज बहाणे नाहीत—फक्त प्रगती! उरलेले %1$d मिनिटं सुरू कर 🔥",
    "सकाळ तुझी, टार्गेट तुझं, विजयही तुझाच! अजून %1$d मिनिटं 🚀 — प्रगती %3$d/%4$d मिनिटं (%5$d%%)",
  ],
  [
    "फोन जागा आहे, इंटरनेट जागं आहे... आता अभ्यासालाही उठव 😂 अजून %1$d मिनिटं",
    "चॅम्पियन, टार्गेटला सुप्रभात म्हणालास? आता कामालाही सुरुवात कर 😏 %1$d मिनिटं बाकी",
    "मेंदूला थोडं काम दे; बिचारा फक्त चित्रं पाहणं सहन करतोय 😂 %1$d मिनिटं बाकी — प्रगती %3$d/%4$d मिनिटं (%5$d%%)",
  ],
  [
    "अकरा वाजले! टार्गेटकडे फक्त बघून ते पूर्ण होत नाही जनाब 😏 %1$d मिनिटं बाकी",
    "चित्रं पाहण्याचा पहिला टप्पा झाला असेल; आता अभ्यासाचा टप्पा सुरू कर 😂 %1$d मिनिटं बाकी",
    "बहाण्यांची बैठक संपली असेल तर एक प्रश्न सोडवूया 🔥 अजून %1$d मिनिटं — प्रगती %3$d/%4$d मिनिटं (%5$d%%)",
  ],
  [
    "जेवणाची वेळ झाली; पण टार्गेटने अजून नाश्ताही केलेला नाही 😂 %1$d मिनिटं बाकी",
    "जेवणाचा विराम ठीक आहे बॉस, अभ्यासालाही आज हजेरी लावू दे 😎 %1$d मिनिटं बाकी",
    "अर्धा दिवस गेला; आता बहाणे कमी आणि प्रगती जास्त 💪 %1$d मिनिटं बाकी — प्रगती %3$d/%4$d मिनिटं (%5$d%%)",
  ],
  [
    "आजचा अभ्यास उद्यावर पाठवायचं कुरिअर रद्द कर 😂 अजून %1$d मिनिटं",
    "टार्गेट आणि तुझ्यात एवढं अंतर कशाला? छोटा फेरा सुरू कर 🚀 %1$d मिनिटं",
    "प्रगतीच्या पट्टीलाही हिरवं व्हायचंय; त्याची इच्छा पूर्ण कर 😏 %1$d मिनिटं — प्रगती %3$d/%4$d मिनिटं (%5$d%%)",
  ],
  [
    "दहा मिनिटं लक्ष दे; बहाण्यांनाही थोडा आराम दे 😂 अजून %1$d मिनिटं",
    "छोटी सुरुवात कर—मोठं टार्गेटही पावलांनीच पूर्ण होतं 💪 %1$d मिनिटं",
    "आजचा छोटासा अभ्यास उद्याचं मोठं टेन्शन कमी करतो 😎 %1$d मिनिटं बाकी — प्रगती %3$d/%4$d मिनिटं (%5$d%%)",
  ],
  [
    "तीन वाजले! आता फक्त वेळ बघू नको, एक प्रश्नही सोडव ⏳ %1$d मिनिटं बाकी",
    "मोबाइल खाली, लक्ष वर! पुढची दहा मिनिटं अभ्यासाला दे 🔥 %1$d मिनिटं",
    "लक्षाचा छोटा वेग वाढव; बहाण्यांचा वेग कमी कर 😂 %1$d मिनिटं बाकी — प्रगती %3$d/%4$d मिनिटं (%5$d%%)",
  ],
  [
    "चॅम्पियन, दिवस अजून हातात आहे! उरलेलं टार्गेट गाठूया 🔥 %1$d मिनिटं",
    "प्रेरणेची वाट नको; काम सुरू कर, जोश मागून येईल 💪 %1$d मिनिटं",
    "आज स्वतःसाठी एक गोष्ट पूर्ण कर—छोटी सुरुवातही जिंक असते ✨ %1$d मिनिटं — प्रगती %3$d/%4$d मिनिटं (%5$d%%)",
  ],
  [
    "बहाण्यांचा अभ्यास झाला असेल तर आता पुस्तकाचा धडा उघड 😂 %1$d मिनिटं",
    "पाच वाजले बॉस! बहाण्यांची पाळी संपली, अभ्यासाची सुरू 😏 %1$d मिनिटं",
    "टार्गेटला रोज भेटतोस; आज ते पूर्ण करून दाखव 🚀 %1$d मिनिटं बाकी — प्रगती %3$d/%4$d मिनिटं (%5$d%%)",
  ],
  [
    "संध्याकाळ झाली बॉस! आजच्या टार्गेटची तपासणी करूया ⏳ %1$d मिनिटं",
    "आजची मेहनत उद्याच्या आत्मविश्वासाला बोनस देईल 😎 %1$d मिनिटं बाकी",
    "घड्याळ पुढे जातंय; तुझी प्रगतीही पुढे जाऊ दे 🔥 %1$d मिनिटं — प्रगती %3$d/%4$d मिनिटं (%5$d%%)",
  ],
  [
    "सात वाजले! आजचं काम आजच पूर्ण करण्याची वेळ आली 🔥 %1$d मिनिटं",
    "टार्गेट अजून बाकी? चल, आता कृती सुरू करूया 💪 %1$d मिनिटं",
    "संध्याकाळ निघून चालली; पुढचा अभ्यासाचा फेरा आत्ताच सुरू कर ⏳ %1$d मिनिटं — प्रगती %3$d/%4$d मिनिटं (%5$d%%)",
  ],
  [
    "साडेसात! आजच्या टार्गेटला उद्याचा पाहुणा बनवू नकोस 😏 %1$d मिनिटं",
    "थोडं लक्ष, थोडी मेहनत—आजचा शेवट दमदार करूया 🔥 %1$d मिनिटं",
    "आता छोटा अभ्यासाचा वेग वाढव; टार्गेट जवळ आण 💪 %1$d मिनिटं बाकी — प्रगती %3$d/%4$d मिनिटं (%5$d%%)",
  ],
  [
    "रात्र येतेय महाराज! टार्गेटला अजून घरी पाठवायचं आहे 😂 %1$d मिनिटं",
    "आठ वाजून तीस! बहाणे बाजूला ठेव आणि अभ्यास सुरू कर 😎 %1$d मिनिटं",
    "चित्रं पाहणं थांबव, अभ्यास सुरू कर! आजचा फेरा अजून बाकी 🔥 %1$d मिनिटं — प्रगती %3$d/%4$d मिनिटं (%5$d%%)",
  ],
  [
    "नऊ वाजले! आता लक्ष विचलित नको—उरलेलं टार्गेट तपास ⏳ %1$d मिनिटं",
    "वेळ कमी होतोय; शक्य तितका अभ्यास आत्ताच पूर्ण कर 🔥 %1$d मिनिटं",
    "लक्ष देण्याची वेळ आली चॅम्पियन! छोटा फेरा सुद्धा फरक घडवतो 💪 %1$d मिनिटं — प्रगती %3$d/%4$d मिनिटं (%5$d%%)",
  ],
  [
    "शेवटचा फेरा सुरू! आजची छोटी जिंक स्वतःला दे 🔥 %1$d मिनिटं",
    "साडेनऊ वाजले—आजचा शेवट दमदार कर, परिपूर्ण असणं गरजेचं नाही 💪 %1$d मिनिटं",
    "दिवस संपण्याआधी अजून एक प्रयत्न! उरलेलं टार्गेट गाठूया 🚀 %1$d मिनिटं — प्रगती %3$d/%4$d मिनिटं (%5$d%%)",
  ],
  [
    "शेवटची 10 मिनिटं! अजून %1$d मिनिटांचा अभ्यास; दहा वाजेपर्यंत %2$d मिनिटं ⏳",
    "अंतिम काउंटडाउन! घड्याळात %2$d मिनिटं—शक्य तितकं टार्गेट पूर्ण कर 🔥 अजून %1$d मिनिटं",
    "दहा वाजण्याआधीचा शेवटचा प्रयत्न! %2$d मिनिटं बाकी, अभ्यासाचे %1$d मिनिटं ⏳ — प्रगती %3$d/%4$d मिनिटं (%5$d%%)",
  ],
  [
    "आजचा शेवटचा रिमाइंडर! जमलं ते कौतुकास्पद—उद्याची सुरुवात नव्या जोमाने 🌙 अजून %1$d मिनिटं",
    "दहा वाजले—आजचे रिमाइंडर इथे थांबतात. उद्या पुन्हा नवी सुरुवात 💪 %1$d मिनिटं बाकी",
    "आजची मेहनत मान्य कर; उद्या पुन्हा पुढे जाऊया. आता दिवसाचा शेवट 🌙 %1$d मिनिटं बाकी — प्रगती %3$d/%4$d मिनिटं (%5$d%%)",
  ],
] as const;

export const HINDI_REMINDER_MESSAGES = [
  [
    "उठो चैंपियन! आज का टारगेट तुम्हारा इंतज़ार कर रहा है 🔥 अभी %1$d मिनट बाकी",
    "आज बहाने नहीं—सिर्फ़ प्रगति! बचे हुए %1$d मिनट शुरू कीजिए 💪",
    "सुबह आपकी, लक्ष्य आपका, जीत भी आपकी 🚀 पढ़ाई के %1$d मिनट बाकी — प्रगति %3$d/%4$d मिनट (%5$d%%)",
  ],
  [
    "मोबाइल जाग रहा है, इंटरनेट भी चालू है... अब पढ़ाई को जगाइए 😂 %1$d मिनट बाकी",
    "चैंपियन, टारगेट को सुप्रभात कहा? अब काम भी शुरू करिए 😏 %1$d मिनट बाकी",
    "दिमाग को भी थोड़ा काम दीजिए; बेचारा बस चित्र देखता रहता है 😂 %1$d मिनट बाकी — प्रगति %3$d/%4$d मिनट (%5$d%%)",
  ],
  [
    "ग्यारह बज गए! टारगेट को देखते रहने से वो पूरा नहीं होगा जनाब 😏 %1$d मिनट बाकी",
    "चित्र देखने का पहला दौर खत्म? अब पढ़ाई का दौर शुरू करिए 😂 %1$d मिनट बाकी",
    "बहानों की बैठक खत्म हो गई हो तो एक सवाल हल कर लें 🔥 %1$d मिनट बाकी — प्रगति %3$d/%4$d मिनट (%5$d%%)",
  ],
  [
    "खाने का वक्त हो गया, लेकिन टारगेट ने अभी नाश्ता भी नहीं किया 😂 %1$d मिनट बाकी",
    "खाने का विराम ठीक है जनाब, पढ़ाई को भी आज हाज़िरी लगाने दीजिए 😎 %1$d मिनट बाकी",
    "आधा दिन बीत गया; अब बहाने कम और प्रगति ज़्यादा 💪 %1$d मिनट बाकी — प्रगति %3$d/%4$d मिनट (%5$d%%)",
  ],
  [
    "आज की पढ़ाई कल भेजने वाला कुरिअर रद्द कर दीजिए 😂 %1$d मिनट बाकी",
    "टारगेट और आपके बीच इतना फासला क्यों? छोटा दौर शुरू करें 🚀 %1$d मिनट बाकी",
    "प्रगति की पट्टी को भी हरा होना है; उसकी इच्छा पूरी कर दीजिए 😏 %1$d मिनट बाकी — प्रगति %3$d/%4$d मिनट (%5$d%%)",
  ],
  [
    "दस मिनट ध्यान लगाइए; बहानों को भी थोड़ा आराम दीजिए 😂 %1$d मिनट बाकी",
    "छोटी शुरुआत करिए—बड़ा टारगेट भी कदमों से पूरा होता है 💪 %1$d मिनट बाकी",
    "आज की छोटी पढ़ाई कल का बड़ा तनाव कम करती है 😎 %1$d मिनट बाकी — प्रगति %3$d/%4$d मिनट (%5$d%%)",
  ],
  [
    "तीन बज गए! सिर्फ़ घड़ी मत देखिए, एक सवाल भी हल करिए ⏳ %1$d मिनट बाकी",
    "मोबाइल नीचे, ध्यान ऊपर! अगले दस मिनट पढ़ाई को दीजिए 🔥 %1$d मिनट बाकी",
    "ध्यान का छोटा वेग बढ़ाइए; बहानों की रफ़्तार कम करें 😂 %1$d मिनट बाकी — प्रगति %3$d/%4$d मिनट (%5$d%%)",
  ],
  [
    "चैंपियन, दिन अभी हाथ में है! बाकी टारगेट पूरा करें 🔥 %1$d मिनट बाकी",
    "प्रेरणा का इंतज़ार मत कीजिए; काम शुरू करें, जोश बाद में आएगा 💪 %1$d मिनट बाकी",
    "आज अपने लिए एक काम पूरा करें—छोटी शुरुआत भी जीत है ✨ %1$d मिनट बाकी — प्रगति %3$d/%4$d मिनट (%5$d%%)",
  ],
  [
    "बहानों का पाठ पूरा हो गया हो तो पढ़ाई का अध्याय खोलिए 😂 %1$d मिनट बाकी",
    "पाँच बज गए जनाब! बहानों की पारी खत्म, पढ़ाई की शुरू 😏 %1$d मिनट बाकी",
    "टारगेट से रोज़ मुलाक़ात होती है; आज उसे पूरा भी करके दिखाइए 🚀 %1$d मिनट बाकी — प्रगति %3$d/%4$d मिनट (%5$d%%)",
  ],
  [
    "शाम हो गई जनाब! आज के टारगेट का हिसाब देख लें ⏳ %1$d मिनट बाकी",
    "आज की मेहनत कल के आत्मविश्वास को बोनस देगी 😎 %1$d मिनट बाकी",
    "घड़ी आगे बढ़ रही है; आपकी प्रगति भी आगे बढ़े 🔥 %1$d मिनट बाकी — प्रगति %3$d/%4$d मिनट (%5$d%%)",
  ],
  [
    "सात बज गए! आज का काम आज ही पूरा करने का वक्त है 🔥 %1$d मिनट बाकी",
    "टारगेट बाकी है? चलिए, अब काम शुरू करते हैं 💪 %1$d मिनट बाकी",
    "शाम निकल रही है; अगला पढ़ाई का दौर अभी शुरू करिए ⏳ %1$d मिनट बाकी — प्रगति %3$d/%4$d मिनट (%5$d%%)",
  ],
  [
    "साढ़े सात! आज के टारगेट को कल का मेहमान मत बनाइए 😏 %1$d मिनट बाकी",
    "थोड़ा ध्यान, थोड़ी मेहनत—आज का अंत दमदार करें 🔥 %1$d मिनट बाकी",
    "अब पढ़ाई का छोटा दौर तेज़ करें; लक्ष्य को करीब लाइए 💪 %1$d मिनट बाकी — प्रगति %3$d/%4$d मिनट (%5$d%%)",
  ],
  [
    "रात होने लगी जनाब! टारगेट को आज ही विदा करना है 😂 %1$d मिनट बाकी",
    "आठ बजकर तीस मिनट! बहाने किनारे रखिए, पढ़ाई शुरू 😎 %1$d मिनट बाकी",
    "चित्र देखना रोकिए, पढ़ाई शुरू कीजिए! आज का दौर बाकी है 🔥 %1$d मिनट बाकी — प्रगति %3$d/%4$d मिनट (%5$d%%)",
  ],
  [
    "नौ बज गए! ध्यान भटकने न दें—बाकी लक्ष्य देख लें ⏳ %1$d मिनट बाकी",
    "वक्त कम हो रहा है; जितनी पढ़ाई हो सके अभी पूरी करें 🔥 %1$d मिनट बाकी",
    "ध्यान लगाने का वक्त है चैंपियन! छोटा दौर भी फर्क लाता है 💪 %1$d मिनट बाकी — प्रगति %3$d/%4$d मिनट (%5$d%%)",
  ],
  [
    "आखिरी दौर शुरू! आज खुद को एक छोटी जीत दीजिए 🔥 %1$d मिनट बाकी",
    "साढ़े नौ बज गए—आज का अंत दमदार करें, परिपूर्ण होना ज़रूरी नहीं 💪 %1$d मिनट बाकी",
    "दिन खत्म होने से पहले एक और कोशिश! बाकी लक्ष्य पूरा करें 🚀 %1$d मिनट बाकी — प्रगति %3$d/%4$d मिनट (%5$d%%)",
  ],
  [
    "आखिरी 10 मिनट! पढ़ाई के %1$d मिनट बाकी; दस बजे तक %2$d मिनट ⏳",
    "अंतिम काउंटडाउन! घड़ी में %2$d मिनट—जितना हो सके पूरा करें 🔥 %1$d मिनट बाकी",
    "दस बजे से पहले आखिरी कोशिश! %2$d मिनट बाकी, पढ़ाई के %1$d मिनट ⏳ — प्रगति %3$d/%4$d मिनट (%5$d%%)",
  ],
  [
    "आज का आखिरी रिमाइंडर! जो हुआ उसकी तारीफ़ करें; कल फिर नई शुरुआत 🌙 %1$d मिनट बाकी",
    "दस बजे हो गए—आज के रिमाइंडर यहीं रुकेंगे। कल नई शुरुआत 💪 %1$d मिनट बाकी",
    "आज की मेहनत सराहिए; कल फिर आगे बढ़ेंगे। अब दिन का अंत 🌙 %1$d मिनट बाकी — प्रगति %3$d/%4$d मिनट (%5$d%%)",
  ],
] as const;

export const getNextDailyReminderMinute = (
  currentMinute: number,
  schedule: readonly number[] = DAILY_REMINDER_MINUTES,
): number | null => schedule.find((minute) => minute > currentMinute) ?? null;

/** Returns the latest stage that is valid at this local minute; cutoff is inclusive at 10:00 PM only. */
export const getDailyReminderStageIndex = (
  currentMinute: number,
  schedule: readonly number[] = DAILY_REMINDER_MINUTES,
): number | null => {
  if (!Number.isFinite(currentMinute) || schedule.length === 0) return null;
  if (currentMinute < schedule[0] || currentMinute > schedule[schedule.length - 1]) return null;
  let stageIndex: number | null = null;
  for (let index = 0; index < schedule.length; index += 1) {
    if (schedule[index] > currentMinute) break;
    stageIndex = index;
  }
  return stageIndex;
};

export const getRemainingTargetMinutes = (targetMinutes: number, elapsedSeconds: number): number =>
  Math.max(0, Math.ceil((Math.max(1, targetMinutes) * 60 - Math.max(0, elapsedSeconds)) / 60));

/** Recompute goal completion from current target settings; persisted flags can become stale after a target increase. */
export const isDailyTargetComplete = (targetMinutes: number, elapsedSeconds: number): boolean =>
  Math.max(0, elapsedSeconds) >= Math.max(1, targetMinutes) * 60;

interface MathMasterNotificationsPlugin {
  requestPermission(): Promise<{ granted: boolean }>;
  syncDailyTarget(options: {
    enabled: boolean;
    targetMinutes: number;
    elapsedSeconds: number;
    completed: boolean;
    dayKey: string;
    scheduleMinutesJson: string;
    marathiMessagesJson: string;
    hindiMessagesJson: string;
  }): Promise<{ synced: boolean; scheduled: boolean }>;
  setUpdateAlerts(options: { enabled: boolean }): Promise<{ configured: boolean; success?: boolean; subscribed?: boolean }>;
  consumeNotificationAction(): Promise<{
    action?: string;
    versionName?: string | null;
    versionCode?: string | null;
    updateManifestUrl?: string | null;
  }>;
}

const NativeNotifications = registerPlugin<MathMasterNotificationsPlugin>('MathMasterNotifications');
const ENABLED_KEY = 'math-app-background-notifications-enabled-v1';
let listenersStarted = false;
let lastPayloadSignature = '';
let lastUpdateAlertsSetting: boolean | null = null;
let syncQueue: Promise<void> = Promise.resolve();
let updateAlertsSyncPromise: Promise<void> | null = null;
let requestedUpdateAlertsSetting: boolean | null = null;
let lastPersistedSyncAt = 0;
const queueUpdateAlertsSync = (): void => {
  requestedUpdateAlertsSetting = getBackgroundNotificationsEnabled();
  if (updateAlertsSyncPromise) return;

  updateAlertsSyncPromise = (async () => {
    while (requestedUpdateAlertsSetting !== null) {
      const desired = requestedUpdateAlertsSetting;
      requestedUpdateAlertsSetting = null;
      if (lastUpdateAlertsSetting === desired) continue;

      try {
        const result = await NativeNotifications.setUpdateAlerts({ enabled: desired });
        if (!result.configured) {
          // A Firebase-free build still supports local reminders. Do not keep
          // retrying an integration that is not present in this installed APK.
          console.info('Background notifications: FCM update alerts are not configured on this build.');
          lastUpdateAlertsSetting = desired;
        } else if (result.success !== true || result.subscribed !== desired) {
          console.warn('Background notifications: FCM topic subscription was not confirmed; it will be retried on the next sync.');
          lastUpdateAlertsSetting = null;
        } else {
          lastUpdateAlertsSetting = desired;
        }
      } catch {
        console.warn('Background notifications: unable to synchronize FCM update-topic preference.');
        lastUpdateAlertsSetting = null;
      }

      // If the user toggled the preference while Firebase was working, apply
      // the newest choice after the in-flight operation completes.
      if (getBackgroundNotificationsEnabled() !== desired) {
        requestedUpdateAlertsSetting = getBackgroundNotificationsEnabled();
      }
    }
  })().finally(() => {
    updateAlertsSyncPromise = null;
    if (requestedUpdateAlertsSetting !== null) queueUpdateAlertsSync();
  });
};

export const getBackgroundNotificationsEnabled = (): boolean => {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1';
  } catch {
    return false;
  }
};

const getNativeState = (enabled = getBackgroundNotificationsEnabled()) => {
  const streak = getStreak();
  const date = todayStr();
  const record = streak.days[date];
  const elapsedSeconds = Math.max(0, Math.floor(record?.seconds ?? 0));
  const completed = isDailyTargetComplete(streak.targetMinutes, elapsedSeconds);

  return {
    // Preserve the user's opt-in separately from today's completion state so
    // Android can cancel today's alarms and still retain tomorrow's noon alarm.
    enabled: enabled && streak.enabled,
    targetMinutes: streak.targetMinutes,
    elapsedSeconds,
    completed,
    dayKey: date,
    scheduleMinutesJson: JSON.stringify(DAILY_REMINDER_MINUTES),
    marathiMessagesJson: JSON.stringify(MARATHI_REMINDER_MESSAGES),
    hindiMessagesJson: JSON.stringify(HINDI_REMINDER_MESSAGES),
  };
};

const queueNativeSync = (force = false): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(false);

  const backgroundEnabled = getBackgroundNotificationsEnabled();
  const state = getNativeState(backgroundEnabled);
  const signature = JSON.stringify(state);
  if (!force && signature === lastPayloadSignature) return syncQueue.then(() => true);
  lastPayloadSignature = signature;

  let succeeded = false;
  syncQueue = syncQueue
    .catch(() => undefined)
    .then(async () => {
      const syncResult = await NativeNotifications.syncDailyTarget(state);
      if (syncResult.synced !== true) {
        throw new Error('Native daily reminder scheduler did not confirm the requested state.');
      }
      // Keep local alarm scheduling independent of FCM/network latency.
      // Push topic changes are serialized separately and can retry on a later
      // progress sync or app resume without blocking the study reminder toggle.
      queueUpdateAlertsSync();
      succeeded = true;
    })
    .catch(() => {
      // A native bridge failure must not crash the web app. A later startup,
      // resume, target change, or progress update retries synchronization.
      lastPayloadSignature = '';
    });
  return syncQueue.then(() => succeeded);
};

export const setBackgroundNotificationsEnabled = async (enabled: boolean): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;

  if (enabled) {
    try {
      const result = await NativeNotifications.requestPermission();
      if (!result.granted) return false;
    } catch {
      return false;
    }
  }

  try {
    localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    return false;
  }

  lastPayloadSignature = '';
  lastUpdateAlertsSetting = null;

  const synchronized = await queueNativeSync(true);
  if (synchronized) {
    window.dispatchEvent(new CustomEvent('background-notifications-updated', { detail: { enabled } }));
    return true;
  }

  // Revert the opt-in preference if the native permission/scheduling bridge
  // failed; the UI must not claim reminders were enabled when no alarm exists.
  try { localStorage.setItem(ENABLED_KEY, enabled ? '0' : '1'); } catch { /* Storage may be unavailable. */ }
  lastPayloadSignature = '';
  lastUpdateAlertsSetting = null;
  window.dispatchEvent(new CustomEvent('background-notifications-updated', {
    detail: { enabled: !enabled },
  }));
  return false;
};

/** Start one app-wide sync loop; the Android native alarm survives app closure/reboot. */
export const initializeBackgroundNotifications = (): (() => void) => {
  if (listenersStarted || typeof window === 'undefined') return () => undefined;
  listenersStarted = true;

  let lastPersistedDayKey = todayStr();
  let lastMinuteBucket = -1;

  const onProgressPersisted = () => {
    if (!getBackgroundNotificationsEnabled()) return;
    const now = Date.now();
    const currentDayKey = todayStr();
    if (currentDayKey !== lastPersistedDayKey) {
      lastPersistedDayKey = currentDayKey;
      lastMinuteBucket = -1;
    }
    // streak.ts persists every second. Sync the native preference only when the
    // completed-minute value changes; target completion also dispatches streak-updated.
    if (now - lastPersistedSyncAt < 900 && getBackgroundNotificationsEnabled()) return;
    const streak = getStreak();
    const date = todayStr();
    const seconds = Math.max(0, Math.floor(streak.days[date]?.seconds ?? 0));
    const minuteBucket = Math.floor(seconds / 60);
    if (minuteBucket === lastMinuteBucket) return;
    lastMinuteBucket = minuteBucket;
    lastPersistedSyncAt = now;
    void queueNativeSync();
  };
  const onStreakUpdated = () => {
    void queueNativeSync(true);
  };
  const dispatchNotificationAction = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const notification = await NativeNotifications.consumeNotificationAction();
      if (notification.action === 'study-reminder') {
        window.dispatchEvent(new CustomEvent('study-reminder-tapped', { detail: notification }));
      } else if (notification.action === 'app-update') {
        window.dispatchEvent(new CustomEvent('app-update-notification-tapped', { detail: notification }));
      }
    } catch {
      // Older installed APKs may not yet include the native notification bridge.
    }
  };
  const onResume = () => {
    void queueNativeSync(true);
    void dispatchNotificationAction();
  };
  const onVisibility = () => { if (document.visibilityState === 'visible') onResume(); };
  const onStorage = (event: StorageEvent) => {
    if (event.key === 'math-app-streak-v1' || event.key === ENABLED_KEY || event.key === 'math-app-settings-v1') onResume();
  };
  let appResumeListener: { remove: () => Promise<void> } | null = null;
  let disposed = false;
  void dispatchNotificationAction();
  if (Capacitor.isNativePlatform()) {
    void App.addListener('resume', onResume).then((listener) => {
      if (disposed) void listener.remove();
      else appResumeListener = listener;
    }).catch(() => {
      // Focus/visibility listeners are used as a fallback.
    });
  }

  window.addEventListener('streak-persisted', onProgressPersisted);
  window.addEventListener('streak-updated', onStreakUpdated);
  window.addEventListener('focus', onResume);
  window.addEventListener('online', onResume);
  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', onVisibility);
  void queueNativeSync(true);

  return () => {
    disposed = true;
    listenersStarted = false;
    if (appResumeListener) void appResumeListener.remove();
    window.removeEventListener('streak-persisted', onProgressPersisted);
    window.removeEventListener('streak-updated', onStreakUpdated);
    window.removeEventListener('focus', onResume);
    window.removeEventListener('online', onResume);
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVisibility);
  };
};
