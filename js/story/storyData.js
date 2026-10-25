// ============================================================================
// STORY DATA — Street Game 2 : "The Ghost Ledger"  (دفتر الأشباح)
// Full narrative content for the redesigned six-chapter story.
// Bilingual Arabic / English. Pure data, no engine imports.
//
// Arabic dialogue pass: the lines below are written in a natural, speakable
// register (simple MSA with light everyday phrasing), not literary prose.
// ============================================================================

/** Story meta ---------------------------------------------------------- */
export const STORY = {
  gameTitle:    { ar: "ستريت جيم 2", en: "Street Game 2" },
  subtitle:     { ar: "دفتر الأشباح", en: "The Ghost Ledger" },
  protagonist:  { ar: "عماد الحلبي", en: "Imad al-Halabi" },
  totalChapters: 6,
};

/** Characters ---------------------------------------------------------- */
export const CHARACTERS = {
  imad:    { id: "imad",    name: { ar: "عماد",        en: "Imad" },        color: "#ffd700", role: { ar: "البطل",              en: "Protagonist" } },
  hakim:   { id: "hakim",   name: { ar: "حكيم",        en: "Hakim" },       color: "#9ca3af", role: { ar: "المخبر",             en: "Informant" } },
  salim:   { id: "salim",   name: { ar: "سليم",        en: "Salim" },       color: "#4ade80", role: { ar: "صديق العمر",        en: "Best friend" } },
  qasim:   { id: "qasim",   name: { ar: "قاسم",        en: "Qasim" },       color: "#60a5fa", role: { ar: "شرطي فاسد",          en: "Corrupt cop" } },
  alras:   { id: "alras",   name: { ar: "الأعلى",      en: "Al-Ras" },      color: "#e8a33d", role: { ar: "زعيم فينيوود",        en: "Vinewood boss" } },
  salma:   { id: "salma",   name: { ar: "سلمى",        en: "Salma" },       color: "#f472b6", role: { ar: "ابنة الزعيم",        en: "Boss's daughter" } },
  serpent: { id: "serpent", name: { ar: "الأفعى",      en: "The Serpent" }, color: "#ef4444", role: { ar: "زعيم العصابة",       en: "Gang leader" } },
  warden:  { id: "warden",  name: { ar: "الحارس",      en: "the Warden" },  color: "#a78bfa", role: { ar: "المنظمة",            en: "The order" } },
};

/** Relationship keys shown in the journal ------------------------------ */
export const RELATION_KEYS = ["salim", "qasim", "hakim", "alras", "salma", "serpent"];

/** Chapters ------------------------------------------------------------- */
export const CHAPTERS = [
  {
    n: 1, id: "ch1", color: "#4ade80",
    title:    { ar: "الفصل الأول: البداية",            en: "Chapter One: The Beginning" },
    subtitle: { ar: "حين تكتشف أنك تستطيع أن تأخذ",     en: "When you find out you can take it" },
    theme:    { ar: "عماد يكتشف أنه يستطيع أن يأخذ ما ليس له.", en: "Imad discovers he can take what is not his." },
    intro: [
      { roleAr: "", roleEn: "", ar: "فينيوود هيلز. الثالثة بعد الظهر.", en: "Vinewood Hills. Three in the afternoon." },
      { roleAr: "", roleEn: "", ar: "أب ميت. أخت أكبر غادرت البيت قبل سبع سنوات. وحساب دائماً تحت الصفر.", en: "A dead father. An older sister who left seven years ago. An account always in the red." },
      { roleAr: "عماد", roleEn: "Imad", ar: "لست غبياً. أعرف البرمجة، وأعرف أكثر مما يعرفه نصف خريجي تلك الجامعة.", en: "I am not stupid. I can code, and I know more than half the graduates of that university." },
      { roleAr: "عماد", roleEn: "Imad", ar: "لكن البرمجة لا تدفع رسوم الجامعة.", en: "But coding does not pay tuition." },
      { roleAr: "سليم", roleEn: "Salim", ar: "اسمع يا عبقري. هذه مدينة لا تحترم أحداً بلا شهادة.", en: "Listen, genius. This city does not respect anyone without a diploma." },
      { roleAr: "سليم", roleEn: "Salim", ar: "الموهبة موجودة. لكنها لا تدفع الإيجار.", en: "Talent is here. But it does not pay rent." },
      { roleAr: "عماد", roleEn: "Imad", ar: "إذاً ما رأيك؟", en: "So what do you suggest?" },
      { roleAr: "سليم", roleEn: "Salim", ar: "أنا لا أقترح شيئاً. لكن تلك الحقيبة التي وجدتها اليوم...", en: "I am not suggesting anything. But that bag you found today..." },
      { roleAr: "سليم", roleEn: "Salim", ar: "ما زلت لا تعرف صاحبها. وأنا أعرف رجلاً يعرفه.", en: "You still do not know who owns it. And I know a man who does." }
    ]
  },
  {
    n: 2, id: "ch2", color: "#f59e0b",
    title:    { ar: "الفصل الثاني: التصعيد",           en: "Chapter Two: Escalation" },
    subtitle: { ar: "حين تنجح، يطلبون منك أكثر",         en: "When you succeed, they ask for more" },
    theme:    { ar: "المهمات تتدرج حتى لا يبقى شيء طبيعي.", en: "The missions escalate until nothing normal remains." },
    intro: [
      { roleAr: "", roleEn: "", ar: "ثلاثة أشهر. ست وعشرون مهمة. وثلاث مئة ألف في الحساب.", en: "Three months. Twenty-six jobs. Three hundred thousand in the account." },
      { roleAr: "سليم", roleEn: "Salim", ar: "أنت لا تنام يا عماد. انظر إلى وجهك.", en: "You are not sleeping, Imad. Look at your face." },
      { roleAr: "عماد", roleEn: "Imad", ar: "أنام في النهار. لا... لم أنم منذ أيام.", en: "I sleep in the daytime. No... I have not slept in days." },
      { roleAr: "سليم", roleEn: "Salim", ar: "لماذا تفعل هذا؟ قلت لك إن الموهبة لا تكفي.", en: "Why are you doing this? I told you talent is not enough." },
      { roleAr: "عماد", roleEn: "Imad", ar: "لأن أحداً لم يدفع فاتورة بكلمة «لا تكفي».", en: "Because nobody has ever paid a bill with the words 'not enough'." },
      { roleAr: "", roleEn: "", ar: "في ذلك اليوم، لم يأتِ حكيم ليحكم. جاء ليبلّغ أمراً.", en: "That day, Hakim did not come to judge. He came to deliver an order." },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "هناك من يراقبك يا فتى. وليسوا الأشباح.", en: "Someone is watching you, boy. And it is not the Ghosts." },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "شيء أكبر. له اسم. ولست جاهزاً له بعد.", en: "Something bigger. It has a name. And you are not ready for it yet." },
      { roleAr: "عماد", roleEn: "Imad", ar: "إذاً قل لي الاسم.", en: "Then tell me the name." },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "لاحقاً. نفّذ ما يُطلب منك أولاً، ثم اسأل.", en: "Later. Do what is asked of you first, then ask." }
    ]
  },
  {
    n: 3, id: "ch3", color: "#ef4444",
    title:    { ar: "الفصل الثالث: الخسارة الأولى",   en: "Chapter Three: The First Loss" },
    subtitle: { ar: "حين تنسى لماذا بدأت",              en: "When you forget why you started" },
    theme:    { ar: "موت الأعلى يهدم كل ما كان يبدو بديهياً.", en: "Al-Ras's death breaks everything that seemed certain." },
    intro: [
      { roleAr: "", roleEn: "", ar: "المستودع الثالث. رائحة الخرسانة والديزل.", en: "The third warehouse. The smell of concrete and diesel." },
      { roleAr: "الأعلى", roleEn: "Al-Ras", ar: "جئت، وسألت. الآن اسمعني جيداً يا بني.", en: "You came, and you asked. Now listen to me carefully, boy." },
      { roleAr: "الأعلى", roleEn: "Al-Ras", ar: "الأفعى يريدني ميتاً. وهو محق.", en: "The Serpent wants me dead. And he is right." },
      { roleAr: "الأعلى", roleEn: "Al-Ras", ar: "خذ ابنته. سلّمها إلى المخبأ حية. حياتي مقابل حياتها.", en: "Take his daughter. Deliver her to the hideout alive. My life for hers." },
      { roleAr: "عماد", roleEn: "Imad", ar: "وإذا رفض؟", en: "And if he refuses?" },
      { roleAr: "الأعلى", roleEn: "Al-Ras", ar: "لن يرفض. ابنته هي الثمن، وليس أمامه خيار آخر.", en: "He will not refuse. His daughter is the price, and he has no other choice." },
      { roleAr: "", roleEn: "", ar: "في طريق العودة. نقرة خفيفة تحت محور سيارة الأعلى.", en: "On the road back. A quiet click under Al-Ras's axle." },
      { roleAr: "", roleEn: "", ar: "دقيقة واحدة. ستون ثانية. بين الحياة والموت.", en: "One minute. Sixty seconds. Between life and death." }
    ]
  },
  {
    n: 4, id: "ch4", color: "#ec4899",
    title:    { ar: "الفصل الرابع: الاختطاف",         en: "Chapter Four: The Kidnapping" },
    subtitle: { ar: "حين تأخذ المدينة منك ما لم تستطع حمايته",        en: "When the city takes what you could not protect" },
    theme:    { ar: "سلمى تُخطف، والجاسوس يكشف وجهه.",   en: "Salma is taken, and the spy shows his face." },
    intro: [
      { roleAr: "", roleEn: "", ar: "إيست لوس. بيت صغير، حديقة صغيرة، وستارة خضراء.", en: "East LS. A small house, a small garden, a green curtain." },
      { roleAr: "", roleEn: "", ar: "صوت مسجّل. ثم صمت.", en: "One recorded voice. Then silence." },
      { roleAr: "الأفعى", roleEn: "The Serpent", ar: "أعرف أنك ستأتي. أعرف أنك تهتم. تعال وحدك.", en: "I know you will come. I know you care. Come alone." },
      { roleAr: "", roleEn: "", ar: "الهاتف ما زال دافئاً. وبوابة الحديقة ما زالت مفتوحة.", en: "The phone is still warm. And the garden gate is still open." },
      { roleAr: "قاسم", roleEn: "Qasim", ar: "يا بني، لم تقل لي إنك تعرف ابنة الأعلى.", en: "Son, you never told me you knew Al-Ras's daughter." },
      { roleAr: "عماد", roleEn: "Imad", ar: "ظننت أنني لن أحتاج إلى شرطي في هذا.", en: "I thought I would never need a cop for this." },
      { roleAr: "قاسم", roleEn: "Qasim", ar: "أنا لست شرطياً جيداً يا بني. لكنني لست واحداً منهم.", en: "I am not a good cop, son. But I am not one of them." }
    ]
  },
  {
    n: 5, id: "ch5", color: "#6366f1",
    title:    { ar: "الفصل الخامس: الخيانة والانقسام", en: "Chapter Five: Betrayal and Division" },
    subtitle: { ar: "أسوأ طعنة تأتي من أقرب الناس",     en: "The worst stab comes from the closest person" },
    theme:    { ar: "سليم يخون، وقاسم يختار.",           en: "Salim betrays. Qasim chooses a side." },
    intro: [
      { roleAr: "", roleEn: "", ar: "فيبوسكي. أضواء المدينة على الماء. هدنة لم تحدث قط.", en: "Vespucci. City lights on the water. A truce that never happened." },
      { roleAr: "سليم", roleEn: "Salim", ar: "أعرف ما يدور في رأسك الآن.", en: "I know what is going through your head right now." },
      { roleAr: "عماد", roleEn: "Imad", ar: "سليم... كم مرة؟", en: "Salim... how many times?" },
      { roleAr: "سليم", roleEn: "Salim", ar: "مرة واحدة. يقولون إن مرة تكفي. لا تصدّقهم.", en: "Once. They say once is enough. Do not believe them." },
      { roleAr: "", roleEn: "", ar: "لم يقل إنها كفت. ولم يعتذر.", en: "He did not say it was enough. And he did not apologise." },
      { roleAr: "قاسم", roleEn: "Qasim", ar: "أعرف مكان مقرهم. والآن أنت مدين لي يا بني.", en: "I know where their headquarters is. And now you owe me, boy." },
      { roleAr: "عماد", roleEn: "Imad", ar: "لماذا تساعدني؟", en: "Why would you help me?" },
      { roleAr: "قاسم", roleEn: "Qasim", ar: "لأن الأفعى يقول إن كل شيء في هذه المدينة يُشترى. وأنا لا أريد أن يكون محقاً.", en: "Because The Serpent says everything in this city can be bought. I do not want him to be right." }
    ]
  },
  {
    n: 6, id: "ch6", color: "#22d3ee",
    title:    { ar: "الفصل السادس: الحسم",             en: "Chapter Six: The Reckoning" },
    subtitle: { ar: "لا أحد يستدعيك. أنت من يقرر متى ينتهي", en: "No one is calling you. You decide when it ends" },
    theme:    { ar: "المواجهة الأخيرة في الميناء، وثلاث طرق للخروج.", en: "The final confrontation at the docks. Three ways out." },
    intro: [
      { roleAr: "", roleEn: "", ar: "الميناء. حاويات بكل الألوان، إلا لوناً واحداً.", en: "Port and Docks. Containers in every colour except one." },
      { roleAr: "", roleEn: "", ar: "واحدة مفتوحة. وواحدة تنتظر.", en: "One is open. One is waiting." },
      { roleAr: "سلمى", roleEn: "Salma", ar: "لا تقتله يا عماد.", en: "Do not kill him, Imad." },
      { roleAr: "عماد", roleEn: "Imad", ar: "لأنك ما زلتِ فتاة الستارة الخضراء؟", en: "Because you are still the girl with the green curtain?" },
      { roleAr: "سلمى", roleEn: "Salma", ar: "لأنك عرفتني قبل أن أعرف الخوف.", en: "Because you knew me before I learned to be afraid." },
      { roleAr: "", roleEn: "", ar: "الأفعى جالس على الحاوية. لا يهرب. لم يهرب يوماً.", en: "The Serpent is sitting on the container. He does not run. He never has." }
    ]
  }
];

/** Endings -------------------------------------------------------------- */
export const ENDINGS = {
  revenge: {
    id: "revenge", color: "#ef4444",
    name: { ar: "الثأر", en: "Revenge" },
    lines: [
      { roleAr: "", roleEn: "", ar: "الطلقة ليست صاخبة. هذا ما لا يخبرك به أحد.", en: "The gun is not loud. That is the part nobody tells you." },
      { roleAr: "", roleEn: "", ar: "الجسد يبرد. عماد لا يتحرك طويلاً.", en: "The body cools. Imad does not move for a long time." },
      { roleAr: "", roleEn: "", ar: "سلمى تقف بعيدة. قاسم لا يرفع عينيه.", en: "Salma stands far away. Qasim does not look up." },
      { roleAr: "", roleEn: "", ar: "انتصر عماد. لكنه انتصر كما يفوز رجل لم يبقَ له شيء.", en: "Imad won. But he won the way a man wins when he has nothing left." },
      { roleAr: "", roleEn: "", ar: "النهاية: الثأر", en: "ENDING: REVENGE" }
    ]
  },
  mercy: {
    id: "mercy", color: "#4ade80",
    name: { ar: "الرحمة", en: "Mercy" },
    lines: [
      { roleAr: "", roleEn: "", ar: "المسدس لا يرتفع. عماد لا يرفعه.", en: "The gun does not rise. Imad does not raise it." },
      { roleAr: "عماد", roleEn: "Imad", ar: "اذهب. ولن أقولها مرتين.", en: "Go. I will not say it twice." },
      { roleAr: "", roleEn: "", ar: "عند الفجر، يغادر الأفعى وحده، ولا يحمل إلا ما يكفيه.", en: "At dawn, the Serpent leaves alone, carrying only what he needs." },
      { roleAr: "", roleEn: "", ar: "لا احتفال. فقط مدينة صارت أهدأ قليلاً.", en: "There is no celebration. Only a city that became slightly quieter." },
      { roleAr: "", roleEn: "", ar: "النهاية: الرحمة", en: "ENDING: MERCY" }
    ]
  },
  deal: {
    id: "deal", color: "#a855f7",
    name: { ar: "الصفقة", en: "The Deal" },
    lines: [
      { roleAr: "حكيم", roleEn: "Hakim", ar: "كنت أعرف أنك ستنتهي هنا. كلهم ينتهون هنا.", en: "I knew you would end up here. They all do." },
      { roleAr: "عماد", roleEn: "Imad", ar: "وكنت تعرف طوال الوقت من كان يدفع لك.", en: "And you knew the whole time who was paying you." },
      { roleAr: "حكيم", roleEn: "Hakim", ar: "كل من في هذه المدينة يبيع شيئاً. أنت فقط لم تبع الشيء الصحيح.", en: "Everyone in this city sells something. You were simply not selling the right thing." },
      { roleAr: "", roleEn: "", ar: "انتهت المكالمة. الشارة على صدرك تقول أكثر مما تقوله أي كلمة.", en: "The call ends. The badge on your chest says more than any word could." },
      { roleAr: "", roleEn: "", ar: "لا أحد يعرف أنه هو. الشهر القادم، سيعرف أحدهم.", en: "Nobody knows it is him. Next month, somebody will." },
      { roleAr: "", roleEn: "", ar: "النهاية: الصفقة", en: "ENDING: THE DEAL" }
    ]
  }
};
