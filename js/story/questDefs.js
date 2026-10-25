// ============================================================================
// QUEST DEFINITIONS — Street Game 2 : "The Ghost Ledger"
// 18 main quests (chapters 1-6) + 30 side quests.
// Every quest reuses one of the 11 engine quest types, so it stays compatible.
//
// Arabic dialogue pass: all spoken lines use a natural, speakable register.
// Literal translation artifacts, broken idioms and grammar errors were fixed;
// English lines were kept in sync with the Arabic.
// ============================================================================

/**
 * Quest object shape (authored form, converted by storyQuests.js):
 *   id, chapter, category, type, icon, reward, order,
 *   title{ar,en}, desc{ar,en}, start{x,y}, end{x,y},
 *   intro[]      - dialogue played on the accept screen when the quest is taken
 *   outro[]      - cutscene lines played when the quest completes
 *   meeting[]    - dialogue for type:"meeting"
 *   itemName{ar,en} - stolen item for type:"theft"
 *   image        - optional artwork for the accept screen, e.g.
 *                  "assets/quests/s1_first_job.jpg". Relative names are
 *                  resolved inside assets/quests/; without it a generated
 *                  placeholder plate is used (see js/assets/questImages.js).
 *   rel{}        - relationship deltas applied on completion
 *   morality     - morality delta on completion
 *   flag         - story flag set on completion
 */

export const MAIN_QUESTS = [
  // ─────────────────────────── CHAPTER 1 ───────────────────────────
  {
    id: "s1_lost_cash", chapter: 1, order: 0, type: "stealCar", icon: "🚗", reward: 400,
    title: { ar: "مال ضائع", en: "Lost Cash" },
    desc:  { ar: "استعد السيارة التي فيها الحقيبة، وسلّمها في داون تاون.", en: "Recover the car with the bag inside. Drop it off in Downtown." },
    start: { x: 99, y: 17 }, end: { x: 59, y: 33 },
    intro: [
      { roleAr: "سليم", roleEn: "Salim", ar: "الحقيبة ليست لك بعد.", en: "The bag is not yours yet." },
      { roleAr: "عماد", roleEn: "Imad", ar: "ماذا تقصد؟", en: "What do you mean?" },
      { roleAr: "سليم", roleEn: "Salim", ar: "أنت لم تسرقها بعد. لكن صاحبها في إيست لوس يبحث عنها الآن.", en: "You did not steal it yet. But its owner in East LS is looking for it right now." },
      { roleAr: "سليم", roleEn: "Salim", ar: "خذ سيارته. لا تترك أثراً. ثم قل لي أين أستلمها.", en: "Take his car. Leave no trace. Then tell me where to pick it up." }
    ],
    outro: [
      { roleAr: "سليم", roleEn: "Salim", ar: "ممتاز. الحقيبة صارت لي الآن. خذني إلى من دفع الثمن.", en: "Excellent. The bag is mine now. Take me to whoever paid for it." }
    ],
    rel: { salim: 10 }, morality: -1
  },
  {
    id: "s1_first_job", chapter: 1, order: 1, type: "deliverShipment", icon: "📦", reward: 500,
    title: { ar: "أول مهمة", en: "The First Job" },
    desc:  { ar: "سلّم الطرد إلى مقر الأعلى في فينيوود هيلز.", en: "Deliver the parcel to Al-Ras's headquarters in Vinewood Hills." },
    start: { x: 60, y: 4 }, end: { x: 10, y: 3 },
    intro: [
      { roleAr: "حكيم", roleEn: "Hakim", ar: "شقة في داون تاون. طرد رمادي. لا تفتحه.", en: "A flat in Downtown. A grey parcel. Do not open it." },
      { roleAr: "عماد", roleEn: "Imad", ar: "وإذا سألوني عنه؟", en: "And if I am asked about it?" },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "قل إنك لا تعرف. ثم اذهب إلى فينيوود. التلال. البوابة الذهبية.", en: "Say you do not know. Then go to Vinewood. The hills. The golden gate." },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "الرجل اسمه الأعلى. سيعطيك عملاً حقيقياً. لا ترفضه.", en: "The man's name is Al-Ras. He will give you real work. Do not refuse it." }
    ],
    outro: [
      { roleAr: "الأعلى", roleEn: "Al-Ras", ar: "حكيم يوصي برجل لا يعرفه. هذا لا يحدث كثيراً.", en: "Hakim recommends a man he does not know. That does not happen often." },
      { roleAr: "الأعلى", roleEn: "Al-Ras", ar: "أهلاً يا عماد. اسمي نجم. تفضّل بالدخول. الكلام لاحقاً.", en: "Welcome, Imad. My name is Najm. Come in. We will talk later." }
    ],
    rel: { hakim: 8, alras: 12 }, morality: 0, flag: "metAlRas"
  },
  {
    id: "s1_new_face", chapter: 1, order: 2, type: "meeting", icon: "💬", reward: 400,
    title: { ar: "الوجه الجديد", en: "The New Face" },
    desc:  { ar: "قابل حكيم في مقهاه وسط داون تاون.", en: "Meet Hakim at his café in Mid Downtown." },
    start: { x: 61, y: 12 }, end: { x: 61, y: 26 },
    intro: [
      { roleAr: "حكيم", roleEn: "Hakim", ar: "الطاولة في الزاوية. اجلس. لا تنظر إلى الباب.", en: "The corner table. Sit. Do not look at the door." }
    ],
    meeting: [
      { roleAr: "حكيم", roleEn: "Hakim", ar: "الطاولة في الزاوية. اجلس. لا تنظر إلى الباب.", en: "The corner table. Sit. Do not look at the door." },
      { roleAr: "عماد", roleEn: "Imad", ar: "أعرف. رأيتك في المرآة وأنا داخل.", en: "I know. I saw you in the mirror when I walked in." },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "ذكي. أول كلمة صادقة أسمعها في هذه المدينة منذ زمن.", en: "Smart. The first honest word I have heard in this city in a long time." },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "أنا حكيم. أنا من يدلّك على الشغل، وأنا من يقبض عمولته.", en: "I am Hakim. I find you work, and I take my cut." },
      { roleAr: "عماد", roleEn: "Imad", ar: "وكم تأخذ؟", en: "And how much do you take?" },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "عشرون بالمئة. ولن أخبرك إلى أين يذهب الباقي. لأنك غالباً لا تريد أن تعرف.", en: "Twenty percent. And I will not tell you where the rest goes. Because you probably do not want to know." },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "عد إلى نجم. نفّذ ما يقوله. ولا تسأل من أنا.", en: "Go back to Najm. Do what he says. And do not ask who I am." },
      { roleAr: "عماد", roleEn: "Imad", ar: "سأسأل على أي حال.", en: "I will ask anyway." },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "أعرف. لهذا أثق فيك.", en: "I know. That is why I trust you." }
    ],
    outro: [
      { roleAr: "حكيم", roleEn: "Hakim", ar: "اذهب. الآن.", en: "Go. Now." }
    ],
    rel: { hakim: 12 }, morality: 0, flag: "metHakim"
  },

  // ─────────────────────────── CHAPTER 2 ───────────────────────────
  {
    id: "s2_clean_hand", chapter: 2, order: 3, type: "theft", icon: "🦹", reward: 750,
    title: { ar: "اليد النظيفة", en: "The Clean Hand" },
    desc:  { ar: "اسرق ظرف المحامي من مكتب ميدتاون دون أن يراك أحد.", en: "Steal the lawyer's envelope from the Midtown office unseen." },
    start: { x: 71, y: 73 }, end: { x: 11, y: 98 },
    itemName: { ar: "ظرف المحامي", en: "The Lawyer's Envelope" },
    intro: [
      { roleAr: "حكيم", roleEn: "Hakim", ar: "محامٍ في ميدتاون. عنده ظرف ليس له.", en: "A lawyer in Midtown. He is keeping an envelope that is not his." },
      { roleAr: "عماد", roleEn: "Imad", ar: "ولماذا لا آخذه بنفسي؟", en: "And why do I not just take it myself?" },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "لأنك ستأخذه بهدوء. هذا هو المهم. أبقِ إصبعك على الورقة عشرين ثانية كاملة.", en: "Because you will take it quietly. That is the point. Keep your finger on the paper for twenty full seconds." },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "وإذا اقترب أحد، ارفع إصبعك فوراً. فوراً يا عماد.", en: "And if someone approaches, lift your finger at once. At once, Imad." }
    ],
    outro: [
      { roleAr: "حكيم", roleEn: "Hakim", ar: "نظيف. لا أثر. جيد. خذها إلى المنطقة الصناعية.", en: "Clean. No trace. Good. Take it to Industrial." }
    ],
    rel: { hakim: 10 }, morality: -1
  },
  {
    id: "s2_passing", chapter: 2, order: 4, type: "silentPursuit", icon: "🕵️", reward: 700,
    title: { ar: "عابر الطريق", en: "Passing Through" },
    desc:  { ar: "تابع سيارة مجهولة من السوق إلى المنطقة الصناعية دون أن تقترب كثيراً.", en: "Tail an unknown car from the Market to Industrial without getting too close." },
    start: { x: 8, y: 62 }, end: { x: 17, y: 82 },
    intro: [
      { roleAr: "حكيم", roleEn: "Hakim", ar: "السيارة الرمادية في السوق. اتبعها. ثلاث دقائق كاملة.", en: "The grey car in the Market. Follow it. Three full minutes." },
      { roleAr: "عماد", roleEn: "Imad", ar: "كم أقترب منها؟", en: "How close?" },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "إذا وقف، قف. وإذا أسرع، دعه يذهب. ولا تخترع من رأسك.", en: "If he stops, you stop. If he speeds up, let him go. Do not improvise." }
    ],
    outro: [
      { roleAr: "حكيم", roleEn: "Hakim", ar: "رأيت ما كانت تحمله. أوراق رسمية.", en: "I saw what it was carrying. Official papers." },
      { roleAr: "عماد", roleEn: "Imad", ar: "وما هي؟", en: "So what are they?" },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "وثائق وعليها تواقيع. تواقيع لم يعد أحد يوقّعها هذه الأيام.", en: "Documents with signatures. Signatures nobody signs anymore." }
    ],
    rel: { hakim: 6 }, morality: -1
  },
  {
    id: "s2_packer", chapter: 2, order: 5, type: "deliverShipment", icon: "📦", reward: 800,
    title: { ar: "المعبّئ", en: "The Packer" },
    desc:  { ar: "سلّم الشحنة من الميناء إلى نقطة في إيست لوس.", en: "Deliver the shipment from the Docks to a drop in East LS." },
    start: { x: 34, y: 102 }, end: { x: 82, y: 18 },
    intro: [
      { roleAr: "الأعلى", roleEn: "Al-Ras", ar: "شحنة في الميناء. ليست نظيفة يا عماد.", en: "A shipment at the Docks. It is not clean, Imad." },
      { roleAr: "عماد", roleEn: "Imad", ar: "لماذا تخبرني؟", en: "Why are you telling me?" },
      { roleAr: "الأعلى", roleEn: "Al-Ras", ar: "لأنك ستسأل. وأفضّل أن أقولها لك قبل أن تسأل.", en: "Because you will ask. And I would rather say it before you do." },
      { roleAr: "الأعلى", roleEn: "Al-Ras", ar: "وصّلها. لا تفتحها. وإذا لاحظت أن أحداً يتبعك، لا ترتبك. ولا تهرب.", en: "Deliver it. Do not open it. And if you notice someone following you, do not panic. Do not run." }
    ],
    outro: [
      { roleAr: "عماد", roleEn: "Imad", ar: "وصلت. ولم أفتحها.", en: "It arrived. And I did not open it." }
    ],
    rel: { alras: 8 }, morality: -2
  },
  {
    id: "s2_spy", chapter: 2, order: 6, type: "surveillance", icon: "👁️", reward: 650,
    title: { ar: "الجاسوس", en: "The Spy" },
    desc:  { ar: "راقب المستودع في المنطقة الصناعية. ثلاثون ثانية دون قتل أو شرطة.", en: "Watch the Industrial warehouse. Thirty seconds, no kills, no police." },
    start: { x: 1, y: 82 }, end: { x: 0, y: 97 },
    intro: [
      { roleAr: "حكيم", roleEn: "Hakim", ar: "ادخل الدائرة. ثلاثون ثانية. لا تقتل أحداً، ولا تدع أحداً يقترب.", en: "Step into the circle. Thirty seconds. Kill nobody, and let nobody come near you." },
      { roleAr: "عماد", roleEn: "Imad", ar: "وإذا رأيت وجوهاً جديدة؟", en: "And if I see new faces?" },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "احفظها. الأسماء التي تنساها هي التي تقتلك.", en: "Memorise them. The names you forget are the ones that kill you." }
    ],
    outro: [
      { roleAr: "حكيم", roleEn: "Hakim", ar: "حفظت الوجوه. وفي رأسك الآن شيء لا يمكنك محوه.", en: "You memorised the faces. And now there is something in your head you cannot erase." },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "كلهم يحملون الشيء نفسه.", en: "They all carry the same thing." },
      { roleAr: "عماد", roleEn: "Imad", ar: "ماذا؟", en: "What?" },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "شعار واحد. ولم أخبرك من أين جاء.", en: "One crest. And I did not tell you where it comes from." }
    ],
    rel: { hakim: 8 }, morality: 0, flag: "sawCrest"
  },

  // ─────────────────────────── CHAPTER 3 ───────────────────────────
  {
    id: "s3_debt", chapter: 3, order: 7, type: "killTarget", icon: "💀", reward: 900,
    title: { ar: "الدين", en: "The Debt" },
    desc:  { ar: "اقتل رجلاً مديناً للأفعى في ساوث سنترال. الضحية بريئة.", en: "Eliminate the man who owes The Serpent in South Central. He is innocent." },
    start: { x: 68, y: 97 }, end: { x: 11, y: 116 },
    intro: [
      { roleAr: "الأعلى", roleEn: "Al-Ras", ar: "رجل في ساوث سنترال. عليه مئة ألف للأفعى.", en: "A man in South Central. He owes The Serpent a hundred thousand." },
      { roleAr: "الأعلى", roleEn: "Al-Ras", ar: "العمل بسيط. وأنت تعرف كيف.", en: "The work is simple. And you know how." },
      { roleAr: "عماد", roleEn: "Imad", ar: "وما اسمه؟", en: "And what is his name?" },
      { roleAr: "الأعلى", roleEn: "Al-Ras", ar: "هذا بالضبط السؤال الذي كنت أخشى أن تسأله.", en: "That is exactly the question I was afraid you would ask." },
      { roleAr: "الأعلى", roleEn: "Al-Ras", ar: "سامح. إنه بقال. عليه قرض وإيجار متأخر. هذا كل شيء.", en: "Samuel. He is a grocer. He has a loan and late rent. That is all." },
      { roleAr: "عماد", roleEn: "Imad", ar: "وإذا لم أفعل؟", en: "And if I do not?" },
      { roleAr: "الأعلى", roleEn: "Al-Ras", ar: "لا أحد يسألك. أنا سألت نفسي، وهذا يكفيني.", en: "Nobody is asking you. I asked myself, and that is enough for me." }
    ],
    outro: [
      { roleAr: "", roleEn: "", ar: "سامح كان يخفي رسالة تحت سرير ابنته. عماد لم يقرأها.", en: "Samuel kept a letter hidden under his daughter's bed. Imad did not read it." },
      { roleAr: "سليم", roleEn: "Salim", ar: "فعلتها. جيد. والآن اذهب واخجل من نفسك قليلاً.", en: "You did it. Good. Now go and be ashamed of yourself for a while." }
    ],
    rel: { salim: -6, alras: 4 }, morality: -12
  },
  {
    id: "s3_hostage", chapter: 3, order: 8, type: "transportPerson", icon: "🚕", reward: 1000,
    title: { ar: "الرهينة", en: "The Hostage" },
    desc:  { ar: "انقل ابنة الأفعى من ساوث إل إس إلى الميناء حية.", en: "Transport the Serpent's daughter from South LS to the Docks, alive." },
    start: { x: 51, y: 102 }, end: { x: 5, y: 107 },
    intro: [
      { roleAr: "الأعلى", roleEn: "Al-Ras", ar: "ابنته. خذها حية. حياتي مقابل حياتها.", en: "His daughter. Take her alive. My life for hers." },
      { roleAr: "عماد", roleEn: "Imad", ar: "هي طفلة.", en: "She is a child." },
      { roleAr: "الأعلى", roleEn: "Al-Ras", ar: "وأنت تعرف ما فعلته قبل شهر. لا تعطني هذه المحاضرة.", en: "And you know what you did a month ago. Do not give me that speech." },
      { roleAr: "الأعلى", roleEn: "Al-Ras", ar: "ساوث إل إس. الشقة. خذها قبل أن تُغلق الطرق.", en: "South LS. The flat. Take her before the roads close." }
    ],
    outro: [
      { roleAr: "", roleEn: "", ar: "الطريق إلى الميناء. تسعون ثانية من الهدوء.", en: "The road to the Docks. Ninety seconds of quiet." },
      { roleAr: "", roleEn: "", ar: "ثم نقرة خفيفة تحت محور سيارة الأعلى.", en: "Then a quiet click under Al-Ras's axle." },
      { roleAr: "", roleEn: "", ar: "في المرآة، تختفي سيارته خلف اللهب.", en: "In the mirror, his SUV disappears behind the flames." },
      { roleAr: "قاسم", roleEn: "Qasim", ar: "أوقف السيارة! الطريق مسدود!", en: "Stop the car! The road is blocked!" },
      { roleAr: "عماد", roleEn: "Imad", ar: "قاسم... أنا آسف. أنا آسف جداً.", en: "Qasim... I am sorry. I am so sorry." }
    ],
    rel: { alras: 10 }, morality: -6, flag: "alrasDead"
  },
  {
    id: "s3_road", chapter: 3, order: 9, type: "plantBomb", icon: "💣", reward: 900,
    title: { ar: "الطريق", en: "The Road" },
    desc:  { ar: "ازرع قنبلة على طريق في إيست لوس، ثم اهرب.", en: "Plant a bomb on an East LS road, then get out." },
    start: { x: 91, y: 1 }, end: { x: 41, y: 19 },
    intro: [
      { roleAr: "حكيم", roleEn: "Hakim", ar: "على الطريق. ثلاث ثوانٍ فقط.", en: "On the road. Three seconds only." },
      { roleAr: "عماد", roleEn: "Imad", ar: "ما هو؟", en: "What is it?" },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "شيء يجعلهم ينظرون. راقب من يخرج بعد الانفجار.", en: "Something that makes them look. Watch who comes out after the blast." }
    ],
    outro: [
      { roleAr: "حكيم", roleEn: "Hakim", ar: "رأيت من خرج؟", en: "Did you see who came out?" },
      { roleAr: "عماد", roleEn: "Imad", ar: "شاحنة بلا شعار. وسائق بلا اسم.", en: "An unmarked van. And a driver with no name." },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "الآن عندك سؤال، وأنت تعرف أنه سؤال خطير.", en: "Now you have a question, and you know it is a dangerous one." }
    ],
    rel: { hakim: 5 }, morality: -8
  },
  {
    id: "s3_blood", chapter: 3, order: 10, type: "escapeCar", icon: "🚨", reward: 1200,
    title: { ar: "الدم", en: "Blood" },
    desc:  { ar: "اهرب من الشرطة إلى فينيوود هيلز.", en: "Escape the police to Vinewood Hills." },
    start: { x: 50, y: 19 }, end: { x: 8, y: 28 },
    intro: [
      { roleAr: "قاسم", roleEn: "Qasim", ar: "اسمع يا بني. أنا من أرسلهم.", en: "Listen, son. I am the one who sent them." },
      { roleAr: "عماد", roleEn: "Imad", ar: "ماذا؟", en: "What?" },
      { roleAr: "قاسم", roleEn: "Qasim", ar: "هناك دليل على الطريق. دليل يشير إليك.", en: "There is evidence on the road. Evidence that points at you." },
      { roleAr: "قاسم", roleEn: "Qasim", ar: "اذهب إلى فينيوود. انتظر أسبوعاً. ولا تنم في مكان أستطيع أن أجدك فيه.", en: "Go to Vinewood. Wait a week. And do not sleep anywhere I can find you." }
    ],
    outro: [
      { roleAr: "قاسم", roleEn: "Qasim", ar: "عدت. قلت لك ألا تنم في مكان أستطيع أن أجدك فيه.", en: "You came back. I told you not to sleep anywhere I can find you." },
      { roleAr: "قاسم", roleEn: "Qasim", ar: "أنا أحاول أن أحميك يا أحمق. أتفهم ذلك؟", en: "I am trying to protect you, idiot. Do you understand that?" }
    ],
    rel: { qasim: 12 }, morality: 0
  },

  // ─────────────────────────── CHAPTER 4 ───────────────────────────
  {
    id: "s4_message", chapter: 4, order: 11, type: "meeting", icon: "💬", reward: 600,
    title: { ar: "الرسالة", en: "The Message" },
    desc:  { ar: "استمع إلى ما تركته سلمى. لا تترك البيت قبل أن ينتهي.", en: "Listen to what Salma left. Do not leave the house until it ends." },
    start: { x: 92, y: 25 }, end: { x: 92, y: 15 },
    intro: [
      { roleAr: "", roleEn: "", ar: "الستارة الخضراء. الهاتف على الطاولة. الساعة ثمانية مساءً.", en: "The green curtain. The phone on the table. Eight in the evening." }
    ],
    meeting: [
      { roleAr: "سلمى", roleEn: "Salma", ar: "أعرف أنك ستأتي يا عماد. أعرف أنك تهتم.", en: "I know you will come, Imad. I know you care." },
      { roleAr: "سلمى", roleEn: "Salma", ar: "إذا كنت تسمع هذا، فأنا لست في البيت. وأنا بخير.", en: "If you are hearing this, I am not in the house. And I am all right." },
      { roleAr: "سلمى", roleEn: "Salma", ar: "تعال وحدك. إن جاء معك أحد، سيقتلونني.", en: "Come alone. If anyone comes with you, they will kill me." },
      { roleAr: "سلمى", roleEn: "Salma", ar: "وإذا مت قبل أن تسمع هذا، فاعلم أن الأمر ليس خطأك. الخطأ على من أخذني.", en: "And if I die before you hear this, know that it is not your fault. The fault is on whoever took me." },
      { roleAr: "", roleEn: "", ar: "ثم صوت الخط المغلق.", en: "Then the dial tone." }
    ],
    outro: [
      { roleAr: "عماد", roleEn: "Imad", ar: "سلمى.", en: "Salma." },
      { roleAr: "عماد", roleEn: "Imad", ar: "سلمى!", en: "Salma!" }
    ],
    rel: { salma: 15 }, morality: 0, flag: "salmaTaken"
  },
  {
    id: "s4_where", chapter: 4, order: 12, type: "surveillance", icon: "👁️", reward: 900,
    title: { ar: "أين هي", en: "Where Is She" },
    desc:  { ar: "راقب المخبأ. لا تترك الدائرة حتى تنتهي المراقبة.", en: "Watch the hideout. Do not leave the circle until it ends." },
    start: { x: 98, y: 51 }, end: { x: 119, y: 47 },
    intro: [
      { roleAr: "حكيم", roleEn: "Hakim", ar: "ثلاثة مخابئ. اثنان مزيفان، وواحد حقيقي.", en: "Three hideouts. Two are decoys, and one is real." },
      { roleAr: "عماد", roleEn: "Imad", ar: "وكيف أفرّق بينها؟", en: "And how do I tell them apart?" },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "لا أعرف. لذلك إن أخطأت، لن يموت أحد غيرك.", en: "I do not know. That is why if you are wrong, nobody dies but you." }
    ],
    outro: [
      { roleAr: "", roleEn: "", ar: "ثلاثة مخابئ. الحقيقي منها في الميناء.", en: "Three hideouts. The real one is at the Docks." },
      { roleAr: "قاسم", roleEn: "Qasim", ar: "أنا أعرف أين هو. وأنت من أين عرفت؟", en: "I know where it is. How did you find out?" },
      { roleAr: "عماد", roleEn: "Imad", ar: "من رجل يبيع كل ما يعرفه. وأنت تعرف من.", en: "From a man who sells everything he knows. And you know who." }
    ],
    rel: { hakim: -6, qasim: 8 }, morality: 0, flag: "foundHideout"
  },
  {
    id: "s4_phone", chapter: 4, order: 13, type: "theft", icon: "🦹", reward: 1100,
    title: { ar: "هاتف الأفعى", en: "The Serpent's Phone" },
    desc:  { ar: "اسرق هاتف الأفعى من سيارته في ميدتاون.", en: "Steal The Serpent's phone from his car in Midtown." },
    start: { x: 43, y: 50 }, end: { x: 27, y: 93 },
    itemName: { ar: "هاتف الأفعى", en: "The Serpent's Phone" },
    intro: [
      { roleAr: "حكيم", roleEn: "Hakim", ar: "السيارة السوداء. الهاتف في درج السيارة.", en: "The black car. The phone is in the glovebox." },
      { roleAr: "عماد", roleEn: "Imad", ar: "ولماذا لا يخبرني أحد بمكان المخبأ؟", en: "And why does nobody tell me where the hideout is?" },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "لأن أحدهم يخبرك. وأنا أحب أن أعرف من هو.", en: "Because someone is telling you. And I like to know who." }
    ],
    outro: [
      { roleAr: "حكيم", roleEn: "Hakim", ar: "دعني أراه.", en: "Let me see it." },
      { roleAr: "", roleEn: "", ar: "الاسم المحفوظ باسم سلمى. وتحته اسم ثانٍ.", en: "The name saved as Salma. And beneath it, a second name." },
      { roleAr: "عماد", roleEn: "Imad", ar: "حكيم.", en: "Hakim." },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "نعم يا عماد. أنا. طوال الوقت.", en: "Yes, Imad. Me. The whole time." }
    ],
    rel: { hakim: -25 }, morality: 0, flag: "hakimExposed"
  },

  // ─────────────────────────── CHAPTER 5 ───────────────────────────
  {
    id: "s5_last_card", chapter: 5, order: 14, type: "meeting", icon: "💬", reward: 800,
    title: { ar: "الورقة الأخيرة", en: "The Last Card" },
    desc:  { ar: "استمع إلى سليم. ثم قرر.", en: "Listen to Salim. Then decide." },
    start: { x: 99, y: 89 }, end: { x: 107, y: 96 },
    intro: [
      { roleAr: "", roleEn: "", ar: "فيبوسكي. أضواء على الماء. وسليم ينتظر منذ ساعة.", en: "Vespucci. Lights on the water. Salim has been waiting an hour." }
    ],
    meeting: [
      { roleAr: "سليم", roleEn: "Salim", ar: "لا تقتلني قبل أن أتكلم. اسمعني أولاً.", en: "Do not kill me before I speak. Listen first." },
      { roleAr: "سليم", roleEn: "Salim", ar: "أعرف ما في رأسك الآن. أعرف ماذا تظن.", en: "I know what is in your head right now. I know what you are thinking." },
      { roleAr: "عماد", roleEn: "Imad", ar: "كم مرة يا سليم؟", en: "How many times, Salim?" },
      { roleAr: "سليم", roleEn: "Salim", ar: "مرة واحدة. يقولون إن مرة تكفي. لا تصدّقهم.", en: "Once. They say once is enough. Do not believe them." },
      { roleAr: "عماد", roleEn: "Imad", ar: "ماذا قلت لها؟ وكيف عرفت مكانها؟", en: "What did you say to her? And how did you know where she was?" },
      { roleAr: "سليم", roleEn: "Salim", ar: "لم أخبرها. هي من أخبرتني.", en: "I did not tell her. She told me." },
      { roleAr: "عماد", roleEn: "Imad", ar: "...", en: "..." },
      { roleAr: "سليم", roleEn: "Salim", ar: "سأعطيك شيئاً واحداً بلا مقابل. ربما كان سيكفي.", en: "I will give you one thing for free. Maybe it would have been enough." },
      { roleAr: "سليم", roleEn: "Salim", ar: "مقر الأفعى ليس في الميناء. الميناء هو الفخ الذي يريدك أن تدخله.", en: "The Serpent's headquarters is not at the Docks. The Docks is the trap he wants you to walk into." }
    ],
    outro: [
      { roleAr: "عماد", roleEn: "Imad", ar: "اذهب من هنا. الآن.", en: "Get out of here. Now." }
    ],
    rel: { salim: -5 }, morality: 0, flag: "salimTold"
  },
  {
    id: "s5_bad_cops", chapter: 5, order: 15, type: "escapeCar", icon: "🚨", reward: 1300,
    title: { ar: "الشرطة الفاسدة", en: "The Bad Cops" },
    desc:  { ar: "اهرب مع قاسم. أول مرة يقف فيها أحد إلى جانبك.", en: "Escape with Qasim. The first time anyone stands by your side." },
    start: { x: 17, y: 89 }, end: { x: 70, y: 19 },
    intro: [
      { roleAr: "قاسم", roleEn: "Qasim", ar: "اركب. الآن. ولا تسأل.", en: "Get in. Now. Do not ask questions." },
      { roleAr: "عماد", roleEn: "Imad", ar: "إلى أين؟", en: "Where to?" },
      { roleAr: "قاسم", roleEn: "Qasim", ar: "المقر. قبل الفجر. قبل أن يعرفوا أنني دللتك عليه.", en: "Headquarters. Before dawn. Before they learn I am the one who pointed you there." }
    ],
    outro: [
      { roleAr: "قاسم", roleEn: "Qasim", ar: "دخلنا الطابق الأرضي. اثنان عند الباب، وواحد عند الدرج.", en: "We are on the ground floor. Two at the door, one by the stairs." },
      { roleAr: "قاسم", roleEn: "Qasim", ar: "أنت من يعرف ما في الأعلى.", en: "You are the one who knows what is up there." },
      { roleAr: "عماد", roleEn: "Imad", ar: "وأنا من سيذهب أولاً.", en: "And I am the one who goes first." },
      { roleAr: "قاسم", roleEn: "Qasim", ar: "وأنا من سيبقى خلفك. لا تنسَ ذلك.", en: "And I am the one who stays behind you. Do not forget that." }
    ],
    rel: { qasim: 15 }, morality: 0, flag: "assaultedHQ"
  },

  // ─────────────────────────── CHAPTER 6 ───────────────────────────
  {
    id: "s6_docks", chapter: 6, order: 16, type: "surveillance", icon: "👁️", reward: 1500,
    title: { ar: "الميناء", en: "The Docks" },
    desc:  { ar: "تحرّك بين الحاويات دون أن يراك أحد.", en: "Move through the containers unseen." },
    start: { x: 25, y: 116 }, end: { x: 36, y: 112 },
    intro: [
      { roleAr: "قاسم", roleEn: "Qasim", ar: "سلمى في الخلف. أنا في الوسط. وأنت في المقدمة.", en: "Salma stays at the back. I take the middle. You take the front." },
      { roleAr: "عماد", roleEn: "Imad", ar: "وقلت لي ألا أرفع عيني عنك.", en: "And you told me not to take my eyes off you." },
      { roleAr: "قاسم", roleEn: "Qasim", ar: "لأنك الآن تعرف أن الذي يقودك ليس زعيماً، بل عقلك.", en: "Because you know now that what leads you is not a boss, but your own head." }
    ],
    outro: [
      { roleAr: "", roleEn: "", ar: "الحاوية رقم سبعة. المفتوحة.", en: "Container seven. The one that is open." },
      { roleAr: "سلمى", roleEn: "Salma", ar: "لا تقتله يا عماد.", en: "Do not kill him, Imad." },
      { roleAr: "عماد", roleEn: "Imad", ar: "لأنك ما زلتِ فتاة الستارة الخضراء؟", en: "Because you are still the girl with the green curtain?" }
    ],
    rel: { qasim: 8, salma: 10 }, morality: 0, flag: "reachedDocks"
  },
  {
    id: "s6_reckoning", chapter: 6, order: 17, type: "killTarget", icon: "💀", reward: 2000,
    title: { ar: "الحسم", en: "The Reckoning" },
    desc:  { ar: "واجه الأفعى. مصير المدينة سيتوقف على اختيارك.", en: "Confront The Serpent. The fate of the city rests on your choice." },
    start: { x: 3, y: 115 }, end: { x: 15, y: 108 },
    intro: [
      { roleAr: "الأفعى", roleEn: "The Serpent", ar: "جئت. ظننت أنك سترسل أحداً غيرك.", en: "You came. I thought you would send someone else." },
      { roleAr: "عماد", roleEn: "Imad", ar: "قتلت رجلاً اسمه سامح. كان بقالاً. جئت لأعرف لماذا.", en: "I killed a man named Samuel. He was a grocer. I came to find out why." },
      { roleAr: "الأفعى", roleEn: "The Serpent", ar: "سامح؟ هذا ليس اسماً. هذا رقم في دفتر.", en: "Samuel? That is not a name. That is a number in a ledger." },
      { roleAr: "الأفعى", roleEn: "The Serpent", ar: "سلمى كانت الثمن. ابنة مقابل ابنة. الآن أعطني اسمك، وأنا أشطب اسمها من الدفتر.", en: "Salma was the price. A daughter for a daughter. Now give me your name, and I will cross hers out of the ledger." },
      { roleAr: "الأفعى", roleEn: "The Serpent", ar: "ثم انظر حولك. من بقي معك؟ قاسم؟ الناس تبقى معك ما دمت تنفعهم. هذا كل شيء.", en: "Then look around you. Who stayed with you? Qasim? People stay with you as long as you are useful. That is all." },
      { roleAr: "الأفعى", roleEn: "The Serpent", ar: "أنا لا أهرب. لم أهرب في حياتي. ضع المسدس يا فتى.", en: "I do not run. I never have. Put down the gun, boy." }
    ],
    outro: [
      { roleAr: "", roleEn: "", ar: "الحاوية رقم سبعة. الأضواء فوقها. والصمت الذي يسبق كل شيء.", en: "Container seven. The lights above it. And the silence that comes before everything." }
    ],
    rel: {}, morality: 0, flag: "finalConfrontation"
  }
];

/** Side quests — 30 optional contracts, repeatable flavour, no story gates. */
export const SIDE_QUESTS = [
  { id: "x1_taxi",      type: "transportPerson", icon: "🚕", reward: 350, start: { x: 74, y: 44 },  end: { x: 98, y: 70 },
    title: { ar: "أجرة التاكسي", en: "The Taxi Fare" }, desc: { ar: "أوصل راكباً واحداً إلى وجهته.", en: "Take one passenger to their destination." } },
  { id: "x2_laundry",   type: "deliverShipment", icon: "📦", reward: 400, start: { x: 58, y: 58 },  end: { x: 60, y: 106 },
    title: { ar: "الغسيل", en: "The Laundry" }, desc: { ar: "سلّم غسيل المحل إلى بيت العميل.", en: "Deliver the shop's laundry to the customer's home." } },
  { id: "x3_borrowed", type: "stealCar",        icon: "🚗", reward: 300, start: { x: 72, y: 59 },  end: { x: 60, y: 44 },
    title: { ar: "السيارة المستعارة", en: "The Borrowed Car" }, desc: { ar: "استرجع سيارة وأعدها إلى مالكها.", en: "Recover a car and return it to its owner." } },
  { id: "x4_eye",       type: "surveillance",    icon: "👁️", reward: 450, start: { x: 10, y: 107 },  end: { x: 76, y: 110 },
    title: { ar: "العين", en: "The Eye" }, desc: { ar: "راقب نقطة في الضواحي لثلاثين ثانية.", en: "Watch a point in the suburbs for thirty seconds." } },
  { id: "x5_artifact",  type: "deliverLoot",     icon: "🎒", reward: 350, start: { x: 43, y: 101 },  end: { x: 58, y: 19 },
    itemName: { ar: "القطعة", en: "The Artifact" },
    title: { ar: "القطعة", en: "The Artifact" }, desc: { ar: "سلّم قطعة أثرية مسروقة.", en: "Deliver a stolen artifact." } },
  { id: "x6_guard",     type: "transportPerson", icon: "🚕", reward: 400, start: { x: 3, y: 14 },  end: { x: 90, y: 102 },
    title: { ar: "الحارس الشخصي", en: "The Bodyguard" }, desc: { ar: "رافق شخصاً واحمِه في طريقه.", en: "Escort someone across town." } },
  { id: "x7_stranger",  type: "meeting",         icon: "💬", reward: 200, start: { x: 87, y: 49 }, end: { x: 84, y: 68 },
    title: { ar: "الغريب", en: "The Stranger" }, desc: { ar: "قابل شخصاً لا تعرفه.", en: "Meet someone you do not know." },
    meeting: [
      { roleAr: "الغريب", roleEn: "Stranger", ar: "أنت الرجل القادم من فينيوود؟", en: "Are you the man from Vinewood?" },
      { roleAr: "عماد", roleEn: "Imad", ar: "من يسأل؟", en: "Who is asking?" },
      { roleAr: "الغريب", roleEn: "Stranger", ar: "لا أحد. سأكون قد رحلت قبل أن يمر القطار.", en: "Nobody. I will be gone before the train passes." }
    ] },
  { id: "x8_probe",     type: "surveillance",    icon: "👁️", reward: 500, start: { x: 36, y: 72 },  end: { x: 25, y: 50 },
    title: { ar: "التحقيق", en: "The Investigation" }, desc: { ar: "اكتشف ماذا يفعلون في المستودع ليلاً.", en: "Discover what they do in the warehouse at night." } },
  { id: "x9_courier",   type: "deliverShipment", icon: "📦", reward: 450, start: { x: 9, y: 43 },  end: { x: 19, y: 68 },
    title: { ar: "المندوب", en: "The Courier" }, desc: { ar: "طرد إلى أطراف المدينة. والطريق طويل.", en: "A parcel to the edge of the city. A long road." } },
  { id: "x10_money",    type: "theft",           icon: "🦹", reward: 600, start: { x: 89, y: 20 },  end: { x: 96, y: 17 },
    itemName: { ar: "المبلغ الناقص", en: "The Missing Money" },
    title: { ar: "المبلغ الناقص", en: "The Missing Money" }, desc: { ar: "مبلغ ناقص من حساب عميل. استعده قبل أن يختفي.", en: "An amount missing from a client's account. Recover it before it disappears." } },
  { id: "x11_jewels",   type: "theft",           icon: "🦹", reward: 700, start: { x: 68, y: 46 },  end: { x: 67, y: 73 },
    itemName: { ar: "الجواهر", en: "The Jewels" },
    title: { ar: "الجواهر", en: "The Jewels" }, desc: { ar: "اسرق الجواهر. عشرون ثانية فقط.", en: "Steal the jewels. Twenty seconds only." } },
  { id: "x12_blackout", type: "plantBomb",       icon: "💣", reward: 700, start: { x: 17, y: 97 },  end: { x: 19, y: 86 },
    title: { ar: "قطع التيار", en: "Cut the Power" }, desc: { ar: "فجّر مخبأ الأعداء في المنطقة الصناعية.", en: "Blow up the enemy hideout in Industrial." } },
  { id: "x13_shadow",   type: "silentPursuit",   icon: "🕵️", reward: 650, start: { x: 50, y: 83 },  end: { x: 59, y: 83 },
    title: { ar: "الظل", en: "The Shadow" }, desc: { ar: "تابع شخصاً مجهولاً. هو يعرف أنك تتابعه.", en: "Follow an unknown person. He knows you are following him." } },
  { id: "x14_fox",      type: "killTarget",      icon: "💀", reward: 500, start: { x: 99, y: 97 }, end: { x: 102, y: 82 },
    title: { ar: "صيد الثعلب", en: "Fox Hunt" }, desc: { ar: "ثلاثة أعداء في التلال الغربية.", en: "Three enemies in the western hills." } },
  { id: "x15_note",     type: "deliverLoot",     icon: "🎒", reward: 400, start: { x: 58, y: 99 }, end: { x: 48, y: 101 },
    itemName: { ar: "الرسالة", en: "The Note" },
    title: { ar: "الرسالة", en: "The Note" }, desc: { ar: "سلّم رسالة مهمة. لا تقرأها.", en: "Deliver an important note. Do not read it." } },
  { id: "x16_lasttry",  type: "deliverLoot",     icon: "🎒", reward: 350, start: { x: 45, y: 59 },  end: { x: 60, y: 76 },
    itemName: { ar: "الحقيبة", en: "The Bag" },
    title: { ar: "المحاولة الأخيرة", en: "The Last Try" }, desc: { ar: "آخر محاولة قبل الإغلاق.", en: "One last try before closing." } },
  { id: "x17_fugitive", type: "escapeCar",       icon: "🚨", reward: 800, start: { x: 17, y: 93 },  end: { x: 25, y: 102 },
    title: { ar: "الهارب", en: "The Fugitive" }, desc: { ar: "شخص يطلب منك أن تنقذه من الشرطة.", en: "Someone asks you to get him away from the police." } },
  { id: "x18_silent",   type: "plantBomb",       icon: "💣", reward: 750, start: { x: 50, y: 91 },  end: { x: 59, y: 95 },
    title: { ar: "الانفجار الصامت", en: "The Silent Blast" }, desc: { ar: "فجّر قافلة. لكن هل أنت متأكد؟", en: "Blow up a convoy. But are you sure?" } },
  { id: "x19_return",   type: "escapeCar",       icon: "🚨", reward: 850, start: { x: 100, y: 93 }, end: { x: 101, y: 85 },
    title: { ar: "طريق الهروب", en: "The Getaway" }, desc: { ar: "اهرب بالسيارة بعد عملية سطو.", en: "Escape by car after a robbery." } },
  { id: "x20_lastship", type: "deliverShipment", icon: "📦", reward: 500, start: { x: 69, y: 101 }, end: { x: 20, y: 105 },
    title: { ar: "الشحنة الأخيرة", en: "The Last Shipment" }, desc: { ar: "شحنة إلى الميناء قبل الإغلاق.", en: "A shipment to the docks before closing." } },
  { id: "x21_back",     type: "killTarget",      icon: "💀", reward: 700, start: { x: 8, y: 90 },  end: { x: 9, y: 82 },
    title: { ar: "العائد", en: "The Returned" }, desc: { ar: "رجل عاد بعد سنوات. عاد وحده.", en: "A man who came back after years. He came back alone." } },
  { id: "x22_longroad", type: "transportPerson", icon: "🚕", reward: 400, start: { x: 103, y: 107 }, end: { x: 109, y: 102 },
    title: { ar: "الطريق الطويل", en: "The Long Road" }, desc: { ar: "أوصل شخصاً من أقصى المدينة إلى وجهته.", en: "Take someone from the far side of the city to their destination." } },
  { id: "x23_three",    type: "stealCar",        icon: "🚗", reward: 800, start: { x: 82, y: 100 }, end: { x: 101, y: 102 },
    title: { ar: "ثلاث سيارات", en: "Three Cars" }, desc: { ar: "اسرق ثلاث سيارات متتالية قبل أن ينتهي الوقت.", en: "Steal three cars in a row before time runs out." } },
  { id: "x24_neighbor", type: "meeting",         icon: "💬", reward: 250, start: { x: 87, y: 12 },  end: { x: 94, y: 20 },
    title: { ar: "الجار", en: "The Neighbour" }, desc: { ar: "جارك يريد أن يتحدث.", en: "Your neighbour wants to talk." },
    meeting: [
      { roleAr: "الجار", roleEn: "Neighbour", ar: "ضوء مطبخك يبقى شغّالاً حتى الفجر.", en: "Your kitchen light stays on until dawn." },
      { roleAr: "عماد", roleEn: "Imad", ar: "وأنا لا أنام.", en: "And I do not sleep." },
      { roleAr: "الجار", roleEn: "Neighbour", ar: "أعرف. كل الجيران يعرفون.", en: "I know. All the neighbours know." }
    ] },
  { id: "x25_oldbag",   type: "theft",           icon: "🦹", reward: 650, start: { x: 3, y: 27 },  end: { x: 0, y: 17 },
    itemName: { ar: "الحقيبة القديمة", en: "The Old Bag" },
    title: { ar: "الحقيبة القديمة", en: "The Old Bag" }, desc: { ar: "حقيبة في مستودع مهجور. ماذا فيها؟", en: "A bag in an abandoned warehouse. What is in it?" } },
  { id: "x26_watch",    type: "surveillance",    icon: "👁️", reward: 500, start: { x: 43, y: 2 },  end: { x: 42, y: 37 },
    title: { ar: "المراقبة", en: "The Watch" }, desc: { ar: "راقب. ولا تتنفس بصوت عالٍ.", en: "Watch. And do not breathe loudly." } },
  { id: "x27_broker",   type: "meeting",         icon: "💬", reward: 300, start: { x: 46, y: 94 },  end: { x: 42, y: 84 },
    title: { ar: "المفاوض", en: "The Broker" }, desc: { ar: "رجل وسيط. لا تثق به. استمع إليه.", en: "A middleman. Do not trust him. Listen to him." },
    meeting: [
      { roleAr: "الوسيط", roleEn: "Broker", ar: "هذا هو السعر النهائي. ولا دولار أقل.", en: "This is the final price. Not a dollar less." },
      { roleAr: "عماد", roleEn: "Imad", ar: "ولماذا أدفع أصلاً؟", en: "And why should I pay at all?" },
      { roleAr: "الوسيط", roleEn: "Broker", ar: "لأنني الوحيد الذي لا يكذب عليك بشأن أموالك.", en: "Because I am the only one who does not lie to you about your money." }
    ] },
  { id: "x28_secret",   type: "deliverShipment", icon: "📦", reward: 550, start: { x: 64, y: 101 },  end: { x: 48, y: 99 },
    title: { ar: "الطرد السري", en: "The Secret Parcel" }, desc: { ar: "طرد لا يُفتح. لا تسأل لماذا.", en: "A parcel that stays closed. Do not ask why." } },
  { id: "x29_others",   type: "killTarget",      icon: "💀", reward: 750, start: { x: 102, y: 96 },  end: { x: 102, y: 88 },
    title: { ar: "الآخرون", en: "The Others" }, desc: { ar: "آخر خصوم في الحي. من هم؟", en: "The last enemies in the block. Who are they?" } },
  { id: "x30_begin",    type: "meeting",         icon: "💬", reward: 900, start: { x: 61, y: 7 },  end: { x: 61, y: 29 },
    title: { ar: "العودة", en: "Return" }, desc: { ar: "ارجع إلى النقطة الأولى. هل تبدأ الحكاية من جديد؟", en: "Go back to the first point. Does the story begin again?" },
    meeting: [
      { roleAr: "حكيم", roleEn: "Hakim", ar: "عدت.", en: "You came back." },
      { roleAr: "عماد", roleEn: "Imad", ar: "عدت. لكنني لست نفس الشخص يا حكيم.", en: "I came back. But I am not the same person, Hakim." },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "لا أحد يعود كما كان. نتفق على هذا، ثم نبدأ من جديد.", en: "Nobody comes back the same. We agree on that, then we start again." }
    ] }
];
