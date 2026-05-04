export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function calculateLevel(xp) {
  return Math.max(1, Math.floor(Number(xp || 0) / 160) + 1);
}

export function normalizeSentence(sentence) {
  if (!sentence) return "ラーメンをください。";
  if (sentence.includes("ください")) return sentence;
  return `${sentence.replace(/[。！？]$/, "")}。`;
}

export function chooseJapaneseVoice(voices = []) {
  const list = Array.isArray(voices) ? voices.filter(Boolean) : [];
  if (!list.length) return null;
  const lowered = (value) => String(value ?? "").toLowerCase();
  return (
    list.find((voice) => lowered(voice.lang).startsWith("ja")) ||
    list.find((voice) => lowered(voice.lang).includes("ja")) ||
    list.find((voice) => lowered(voice.name).includes("japanese")) ||
    list.find((voice) => /(kyoko|yuki|sakura|mika|haruka|nami)/i.test(String(voice.name ?? ""))) ||
    list[0]
  );
}

function normalizeLessonTopic(theme) {
  const raw = String(theme ?? "custom").trim().toLowerCase() || "custom";
  if (raw.includes("anime")) return "anime";
  if (raw.includes("manga")) return "manga";
  if (raw.includes("food")) return "food";
  if (raw.includes("travel")) return "travel";
  if (raw.includes("daily")) return "daily";
  if (raw.includes("school")) return "school";
  if (raw.includes("work")) return "workplace";
  if (raw.includes("etiquette") || raw.includes("polite")) return "etiquette";
  if (raw.includes("history") || raw.includes("samurai")) return "history";
  return raw;
}

function makeScene(title, setting, summary, lines, references = []) {
  return {
    title,
    setting,
    summary,
    lines: Array.isArray(lines) ? lines : [],
    references: Array.isArray(references) ? references : [],
  };
}

export function buildSceneBlueprint(theme, title, japanese, translation, grammar) {
  const safeTitle = String(title ?? "Lesson").trim() || "Lesson";
  const safeJapanese = String(japanese ?? "").trim();
  const safeTranslation = String(translation ?? "").trim();
  const safeGrammar = String(grammar ?? "").trim();
  const topic = normalizeLessonTopic(theme);

  const fallbackScenes = [
    makeScene(
      `${safeTitle}: Opening`,
      "Opening beat",
      "A short scene that introduces the core line in a memorable situation.",
      [
        { speaker: "Narration", text: `${safeTitle} opens in a ${topic} context.` },
        { speaker: "Speaker A", text: safeJapanese || safeTranslation || `${safeTitle} begins.` },
        { speaker: "Speaker B", text: safeTranslation || safeGrammar || `Use this line to practice the ${topic} scene.` },
      ],
      [safeGrammar, safeTranslation].filter(Boolean)
    ),
    makeScene(
      `${safeTitle}: Reaction`,
      "Reaction beat",
      "A second beat adds a response, contrast, or clarification.",
      [
        { speaker: "Narration", text: "The scene shifts to the other speaker's response." },
        { speaker: "Speaker A", text: safeTranslation || `${safeTitle} response.` },
        { speaker: "Speaker B", text: safeJapanese || `${safeTitle} reply.` },
      ],
      [safeJapanese, safeGrammar].filter(Boolean)
    ),
    makeScene(
      `${safeTitle}: Recall`,
      "Recall beat",
      "A final beat turns the line into a reusable memory hook.",
      [
        { speaker: "Narration", text: `Recall the ${topic} context and say the sentence yourself.` },
        { speaker: "Speaker A", text: safeJapanese || safeTitle },
        { speaker: "Speaker B", text: safeTranslation || safeGrammar || "Repeat the line with the same tone." },
      ],
      [safeTranslation, safeGrammar].filter(Boolean)
    ),
  ];

  const themedScenes = {
    anime: [
      makeScene(
        `${safeTitle}: First Episode Hook`,
        "Anime opening",
        "A first-episode introduction with a warm, expressive line.",
        [
          { speaker: "Narration", text: "The camera settles on the club room and the new arrival." },
          { speaker: "Hero", text: safeJapanese || "はじめまして。よろしくお願いします。" },
          { speaker: "Friend", text: safeTranslation || "Nice to meet you. Let's get along." },
        ],
        ["Common first-meeting lines", "Polite anime introductions"].filter(Boolean)
      ),
      makeScene(
        `${safeTitle}: Energy Shift`,
        "Anime reaction",
        "A quick reaction beat with the usual expressive tone shift.",
        [
          { speaker: "Narration", text: "A surprise reveals the next challenge." },
          { speaker: "Hero", text: safeGrammar || "That feeling of surprise is common in anime dialogue." },
          { speaker: "Friend", text: safeTranslation || "The line lands like a cliffhanger." },
        ],
        ["Surprise reactions", "Cliffhanger pacing"].filter(Boolean)
      ),
      makeScene(
        `${safeTitle}: End Card`,
        "Episode closer",
        "A closing beat that turns the expression into a study cue.",
        [
          { speaker: "Narration", text: "Use the line again as a study card or roleplay reply." },
          { speaker: "Hero", text: safeJapanese || safeTitle },
          { speaker: "Tutor", text: safeGrammar || "Keep the phrase short and expressive." },
        ],
        ["Rehearsed line reuse", "Roleplay cue"].filter(Boolean)
      ),
    ],
    manga: [
      makeScene(
        `${safeTitle}: Panel 1`,
        "Manga first panel",
        "A setup panel that frames the speech bubble and the reaction.",
        [
          { speaker: "Narration", text: "A panel holds the expression still for a beat." },
          { speaker: "Friend", text: safeJapanese || "えっ、本当に？" },
          { speaker: "Narration", text: safeTranslation || "A shocked line lands before the next frame." },
        ],
        ["Speech bubble timing", "Reaction shot pacing"].filter(Boolean)
      ),
      makeScene(
        `${safeTitle}: Turn Page`,
        "Turn-page reveal",
        "A reveal beat that mirrors the dramatic page turn in manga.",
        [
          { speaker: "Narration", text: "The next panel reveals the hidden detail." },
          { speaker: "Friend", text: safeGrammar || "Such a reveal often uses compact, punchy wording." },
          { speaker: "Narration", text: safeTranslation || "The surprise is kept short and sharp." },
        ],
        ["Reveal timing", "Compact dialogue"].filter(Boolean)
      ),
      makeScene(
        `${safeTitle}: Closing Gasp`,
        "Reaction close-up",
        "A closing reaction card that keeps the line memorable.",
        [
          { speaker: "Narration", text: "Hold on the expression and repeat the line aloud." },
          { speaker: "Friend", text: safeJapanese || safeTitle },
          { speaker: "Tutor", text: safeTranslation || safeGrammar || "Short dialogue makes the punchline stick." },
        ],
        ["Reaction close-up", "Scene memory"].filter(Boolean)
      ),
    ],
    food: [
      makeScene(
        `${safeTitle}: Counter Order`,
        "Restaurant counter",
        "A practical ordering scene with polite request language.",
        [
          { speaker: "Customer", text: safeJapanese || "おすすめのラーメンをください。" },
          { speaker: "Staff", text: safeTranslation || "Sure, one recommended ramen coming up." },
          { speaker: "Narration", text: "The exchange stays compact and polite." },
        ],
        ["Counter speech", "Polite requests"].filter(Boolean)
      ),
      makeScene(
        `${safeTitle}: Customization`,
        "Ordering choices",
        "A follow-up beat that introduces choice words and counters.",
        [
          { speaker: "Staff", text: "あっさりとこってり、どちらにしますか。" },
          { speaker: "Customer", text: safeGrammar || "Use a short preference sentence." },
          { speaker: "Narration", text: safeTranslation || "Light broth, please." },
        ],
        ["Menu choices", "Request framing"].filter(Boolean)
      ),
      makeScene(
        `${safeTitle}: Table Note`,
        "Meal recap",
        "A review beat that turns the order into a reusable memory card.",
        [
          { speaker: "Narration", text: "Repeat the order as a study sentence." },
          { speaker: "Customer", text: safeJapanese || safeTitle },
          { speaker: "Tutor", text: safeGrammar || "Polite food requests are short and direct." },
        ],
        ["Food vocabulary", "Service tone"].filter(Boolean)
      ),
    ],
    travel: [
      makeScene(
        `${safeTitle}: Station Entry`,
        "Train station",
        "A wayfinding scene anchored around polite location questions.",
        [
          { speaker: "Traveler", text: safeJapanese || "切符売り場はどこですか。" },
          { speaker: "Staff", text: safeTranslation || "The ticket counter is over there." },
          { speaker: "Narration", text: "Simple directions keep the scene grounded." },
        ],
        ["Station wayfinding", "Polite questions"].filter(Boolean)
      ),
      makeScene(
        `${safeTitle}: Platform Check`,
        "Platform announcement",
        "A second beat that uses train vocabulary in context.",
        [
          { speaker: "Announcer", text: "この電車は何番線ですか。" },
          { speaker: "Traveler", text: safeGrammar || "Check the platform and the departure time." },
          { speaker: "Staff", text: safeTranslation || "Go straight and turn left." },
        ],
        ["Railway timing", "Location vocabulary"].filter(Boolean)
      ),
      makeScene(
        `${safeTitle}: Exit Route`,
        "Exit route",
        "A closing beat that recasts the line as a reusable travel prompt.",
        [
          { speaker: "Narration", text: "Use the sentence again when asking for directions." },
          { speaker: "Traveler", text: safeJapanese || safeTitle },
          { speaker: "Tutor", text: safeGrammar || "Keep location questions short." },
        ],
        ["Directional language", "Station flow"].filter(Boolean)
      ),
    ],
    daily: [
      makeScene(
        `${safeTitle}: Morning Routine`,
        "Morning commute",
        "A routine scene with time words and habitual action.",
        [
          { speaker: "Narration", text: "The day starts with a short commute." },
          { speaker: "Commuter", text: safeJapanese || "朝ごはんのあとで駅まで歩きます。" },
          { speaker: "Friend", text: safeTranslation || "After breakfast, I walk to the station." },
        ],
        ["Routine language", "Time markers"].filter(Boolean)
      ),
      makeScene(
        `${safeTitle}: Evening Errand`,
        "After-work errand",
        "A practical daily-life beat that uses simple sequencing.",
        [
          { speaker: "Narration", text: "The scene shifts to an everyday errand." },
          { speaker: "Commuter", text: "スーパーで買い物をします。" },
          { speaker: "Tutor", text: safeGrammar || "Use に for time and で for place." },
        ],
        ["Daily routine", "Location markers"].filter(Boolean)
      ),
      makeScene(
        `${safeTitle}: Recap`,
        "Daily recap",
        "A recall scene that reuses the routine sentence naturally.",
        [
          { speaker: "Narration", text: "Repeat the sentence as a habit reminder." },
          { speaker: "Commuter", text: safeJapanese || safeTitle },
          { speaker: "Tutor", text: safeTranslation || "A routine sentence you can reuse every day." },
        ],
        ["Habit phrases", "Routine recall"].filter(Boolean)
      ),
    ],
    school: [
      makeScene(
        `${safeTitle}: Before Class`,
        "Classroom doorway",
        "A lesson-opening scene with homework and class timing.",
        [
          { speaker: "Student", text: safeJapanese || "授業の前に宿題を確認します。" },
          { speaker: "Teacher", text: safeTranslation || "Before class, I check the homework." },
          { speaker: "Narration", text: "The classroom scene starts with a practical routine." },
        ],
        ["Classroom timing", "Homework language"].filter(Boolean)
      ),
      makeScene(
        `${safeTitle}: Club Check-in`,
        "After-school club",
        "A second beat for school life with people and places.",
        [
          { speaker: "Student", text: "放課後に図書室で勉強します。" },
          { speaker: "Friend", text: safeGrammar || "Use に and で to place actions in time and space." },
          { speaker: "Tutor", text: safeTranslation || "After school, I study in the library." },
        ],
        ["School club language", "Study spaces"].filter(Boolean)
      ),
      makeScene(
        `${safeTitle}: Teacher Question`,
        "Teacher help",
        "A closing beat that turns a polite question into a reusable model.",
        [
          { speaker: "Student", text: "先生にもう一度聞いてもいいですか。" },
          { speaker: "Teacher", text: safeTranslation || "May I ask one more time?" },
          { speaker: "Narration", text: safeGrammar || "Permission phrases are useful in school contexts." },
        ],
        ["Permission phrases", "Classroom politeness"].filter(Boolean)
      ),
    ],
    workplace: [
      makeScene(
        `${safeTitle}: Mail Draft`,
        "Inbox draft",
        "A workplace message that is brief, respectful, and clear.",
        [
          { speaker: "Sender", text: safeJapanese || "ご確認ありがとうございます。" },
          { speaker: "Receiver", text: safeTranslation || "Thank you for checking." },
          { speaker: "Narration", text: "The business tone stays measured and polite." },
        ],
        ["Email tone", "Business gratitude"].filter(Boolean)
      ),
      makeScene(
        `${safeTitle}: Attachment Follow-up`,
        "Attachment note",
        "A follow-up beat that practices reason clauses and polite asks.",
        [
          { speaker: "Sender", text: "資料を添付しましたので、ご覧ください。" },
          { speaker: "Receiver", text: safeGrammar || "Use ので for a polite reason." },
          { speaker: "Narration", text: safeTranslation || "Please take a look at the attached materials." },
        ],
        ["Attachments", "Reason clauses"].filter(Boolean)
      ),
      makeScene(
        `${safeTitle}: Reply`,
        "Return reply",
        "A closing beat that gives the learner a short reply model.",
        [
          { speaker: "Receiver", text: "承知しました。確認します。" },
          { speaker: "Tutor", text: safeGrammar || "The reply is short and efficient, like a real inbox response." },
          { speaker: "Narration", text: safeTranslation || "Understood. I will check it." },
        ],
        ["Short replies", "Office etiquette"].filter(Boolean)
      ),
    ],
    etiquette: [
      makeScene(
        `${safeTitle}: Polite Request`,
        "Courtesy opening",
        "A softened request with built-in politeness markers.",
        [
          { speaker: "Speaker A", text: safeJapanese || "お手数ですが、もう一度お願いします。" },
          { speaker: "Speaker B", text: safeTranslation || "Sorry for the trouble, but please once more." },
          { speaker: "Narration", text: "The polite opening prepares the listener for a request." },
        ],
        ["Polite framing", "Softened requests"].filter(Boolean)
      ),
      makeScene(
        `${safeTitle}: Apology`,
        "Apology beat",
        "A second beat for careful, low-pressure language.",
        [
          { speaker: "Speaker A", text: "申し訳ありませんが、少し待ってください。" },
          { speaker: "Speaker B", text: safeGrammar || "Use a polite apology before a request or delay." },
          { speaker: "Narration", text: safeTranslation || "I’m sorry, but please wait a moment." },
        ],
        ["Apology forms", "Request softeners"].filter(Boolean)
      ),
      makeScene(
        `${safeTitle}: Appreciation`,
        "Gratitude beat",
        "A closing beat that reinforces a warm, polite tone.",
        [
          { speaker: "Speaker A", text: "いつもありがとうございます。" },
          { speaker: "Speaker B", text: safeTranslation || "Thank you as always." },
          { speaker: "Tutor", text: safeGrammar || "Use this to keep the tone warm and consistent." },
        ],
        ["Gratitude phrases", "Relationship tone"].filter(Boolean)
      ),
    ],
    history: [
      makeScene(
        `${safeTitle}: Resolve`,
        "Training hall",
        "A historical scene that compares words and actions.",
        [
          { speaker: "Teacher", text: safeJapanese || "武士は言葉より行動で示します。" },
          { speaker: "Student", text: safeTranslation || "Samurai show through actions rather than words." },
          { speaker: "Narration", text: "The line feels like a code of conduct." },
        ],
        ["Samurai etiquette", "Comparative phrasing"].filter(Boolean)
      ),
      makeScene(
        `${safeTitle}: Festival Memory`,
        "Town festival",
        "A broader cultural beat that keeps the history lesson grounded.",
        [
          { speaker: "Narration", text: "Old towns often used festivals to bring people together." },
          { speaker: "Teacher", text: "昔の町では祭りが人々をつなぎました。" },
          { speaker: "Tutor", text: safeGrammar || "Historic narration often uses short descriptive clauses." },
        ],
        ["Cultural memory", "Historic narration"].filter(Boolean)
      ),
      makeScene(
        `${safeTitle}: Castle View`,
        "Castle overlook",
        "A closing beat that shows perspective and distance.",
        [
          { speaker: "Narration", text: "The view from the castle is wide and calm." },
          { speaker: "Teacher", text: "城から町全体が見えます。" },
          { speaker: "Student", text: safeTranslation || "The whole town can be seen from the castle." },
        ],
        ["Perspective phrases", "Historic scenery"].filter(Boolean)
      ),
    ],
  };

  return themedScenes[topic] ?? fallbackScenes;
}

const KANJI_BREAKDOWN_LIBRARY = {
  今: { meaning: "now", onYomi: "コン", kunYomi: "いま", components: "亼 + ハ", mnemonic: "The present moment gathers into now.", examples: ["今日", "今朝"], lessonContext: "Useful in greetings and time expressions." },
  名: { meaning: "name", onYomi: "メイ", kunYomi: "な", components: "夕 + 口", mnemonic: "A name is spoken in the mouth at dusk or a quiet moment.", examples: ["名前", "名刺"], lessonContext: "Appears in first introductions." },
  願: { meaning: "request / wish", onYomi: "ガン", kunYomi: "ねが", components: "原 + 頁", mnemonic: "A wish or request is something you lean toward deeply.", examples: ["お願いします", "願い"], lessonContext: "Common in polite requests." },
  一: { meaning: "one", onYomi: "イチ", kunYomi: "ひと", components: "single stroke", mnemonic: "One stroke makes the count easy to remember.", examples: ["一つ", "一番"], lessonContext: "Used for counters and rankings." },
  店: { meaning: "shop", onYomi: "テン", kunYomi: "みせ", components: "广 + 占", mnemonic: "A shop is a covered place where goods are placed.", examples: ["店員", "店舗"], lessonContext: "Fits restaurant and store scenes." },
  汁: { meaning: "soup / juice", onYomi: "ジュウ", kunYomi: "しる", components: "氵 + 十", mnemonic: "Liquid collects into soup or broth.", examples: ["汁物", "味噌汁"], lessonContext: "Useful in food context." },
  武: { meaning: "warrior", onYomi: "ブ", kunYomi: "", components: "止 + 戈", mnemonic: "A warrior stands still with discipline and a weapon.", examples: ["武士", "武道"], lessonContext: "Historical and martial contexts." },
  行: { meaning: "go / act", onYomi: "コウ / ギョウ", kunYomi: "い", components: "彳 + 亍", mnemonic: "Steps move forward, so the idea is to go or act.", examples: ["行動", "銀行"], lessonContext: "Strong in action and movement phrases." },
  示: { meaning: "show", onYomi: "シ", kunYomi: "しめ", components: "礻", mnemonic: "A marker or offering shows what matters.", examples: ["示す", "表示"], lessonContext: "Common in lessons about showing or indicating." },
  本: { meaning: "book / origin", onYomi: "ホン", kunYomi: "もと", components: "木 + stroke", mnemonic: "The base of a tree becomes the origin or book root.", examples: ["本当", "日本"], lessonContext: "Shows up constantly in manga and daily language." },
  真: { meaning: "true", onYomi: "シン", kunYomi: "ま", components: "十 + 具", mnemonic: "The truth is set squarely in place.", examples: ["本当", "真面目"], lessonContext: "Useful for reaction lines." },
  無: { meaning: "nothing / without", onYomi: "ム", kunYomi: "な", components: "火 + 灬 stylization", mnemonic: "Something burned away leaves no trace; nothing remains.", examples: ["無理", "無料"], lessonContext: "Often appears in strong denials." },
  電: { meaning: "electric", onYomi: "デン", kunYomi: "", components: "雨 + 田 + 申", mnemonic: "Electricity flashes under the clouds.", examples: ["電車", "電話"], lessonContext: "Useful for trains and technology." },
  車: { meaning: "car / vehicle", onYomi: "シャ", kunYomi: "くるま", components: "vehicle frame", mnemonic: "A simple frame rolls like a vehicle.", examples: ["電車", "車両"], lessonContext: "Common in transit scenes." },
  毎: { meaning: "every", onYomi: "マイ", kunYomi: "ごと", components: "母 stylization", mnemonic: "Repeat the same habit every day.", examples: ["毎日", "毎回"], lessonContext: "Useful for routines." },
  確: { meaning: "confirm", onYomi: "カク", kunYomi: "たし", components: "石 + 隹", mnemonic: "Stone-like certainty helps you confirm details.", examples: ["確認", "確か"], lessonContext: "Common in business email language." },
  資: { meaning: "resources / data", onYomi: "シ", kunYomi: "", components: "次 + 貝", mnemonic: "Useful resources are what you use next.", examples: ["資料", "資源"], lessonContext: "Used for documents and information." },
  料: { meaning: "materials", onYomi: "リョウ", kunYomi: "", components: "斗 + 米", mnemonic: "Materials are measured out for use.", examples: ["資料", "料理"], lessonContext: "Seen in workplace and study materials." },
  授: { meaning: "teach / give", onYomi: "ジュ", kunYomi: "さず", components: "扌 + 受", mnemonic: "Teaching is giving something through the hand.", examples: ["授業", "授ける"], lessonContext: "Common in school lessons." },
  業: { meaning: "work / class", onYomi: "ギョウ", kunYomi: "わざ", components: "木 + 工 + 丨", mnemonic: "Work is the structure you build and practice.", examples: ["授業", "業務"], lessonContext: "Strong in school and workplace contexts." },
  宿: { meaning: "lodging / homework", onYomi: "シュク", kunYomi: "やど", components: "宀 + 人 + 百", mnemonic: "What stays under the roof becomes the place to rest or complete homework.", examples: ["宿題", "宿泊"], lessonContext: "Useful in school homework phrases." },
  朝: { meaning: "morning", onYomi: "チョウ", kunYomi: "あさ", components: "十 + 日 + 月", mnemonic: "The sun and moon together mark morning.", examples: ["朝ごはん", "今朝"], lessonContext: "Used in routines and commute scenes." },
  駅: { meaning: "station", onYomi: "エキ", kunYomi: "", components: "馬 + 尺", mnemonic: "A station is where movement and scale meet.", examples: ["駅前", "電車"], lessonContext: "Essential for travel scenes." },
  歩: { meaning: "walk", onYomi: "ホ", kunYomi: "ある", components: "止 + 少", mnemonic: "A small step repeated is walking.", examples: ["歩く", "散歩"], lessonContext: "Useful in daily-life and commute lessons." },
  会: { meaning: "meet", onYomi: "カイ", kunYomi: "あ", components: "人 + 云", mnemonic: "People gather and meet.", examples: ["会議", "会う"], lessonContext: "Strong in workplace scenes." },
  手: { meaning: "hand", onYomi: "シュ / ズ", kunYomi: "て", components: "one hand", mnemonic: "A hand is the tool for polite action.", examples: ["手数", "手紙"], lessonContext: "Useful in etiquette phrases." },
  度: { meaning: "degree / time", onYomi: "ド", kunYomi: "たび", components: "广 + 又", mnemonic: "A degree or turn measures how often something happens.", examples: ["一度", "程度"], lessonContext: "Useful in repetition and request phrases." },
};

function buildKanjiBreakdown(character, title, theme, vocab = []) {
  const safeCharacter = String(character ?? "").trim();
  if (!safeCharacter) return null;
  const entry = KANJI_BREAKDOWN_LIBRARY[safeCharacter] ?? null;
  const matchingVocab = (Array.isArray(vocab) ? vocab : []).filter((item) => String(item.word ?? item.term ?? "").includes(safeCharacter)).slice(0, 3);
  return {
    character: safeCharacter,
    meaning: entry?.meaning ?? `${safeCharacter} from ${title || "this lesson"}`,
    onYomi: entry?.onYomi ?? "",
    kunYomi: entry?.kunYomi ?? "",
    components: entry?.components ?? "Simple lesson component breakdown.",
    mnemonic: entry?.mnemonic ?? `Link ${safeCharacter} to the ${theme} scene.`,
    examples: entry?.examples ?? [],
    lessonContext: entry?.lessonContext ?? `Used in the ${theme} lesson.`,
    lessonExamples: matchingVocab.map((item) => `${item.word}${item.kana ? ` (${item.kana})` : ""}`),
  };
}

export function buildKanjiBreakdowns(kanji = [], title, theme, vocab = []) {
  const unique = [];
  const seen = new Set();
  for (const item of Array.isArray(kanji) ? kanji : []) {
    const character = String(item ?? "").trim();
    if (!character || seen.has(character)) continue;
    seen.add(character);
    unique.push(buildKanjiBreakdown(character, title, theme, vocab));
  }
  return unique.filter(Boolean);
}

export function buildPopCultureNotes(title, theme) {
  const topic = normalizeLessonTopic(theme);
  const templates = {
    anime: [
      { title: "Episode framing", context: "Anime often starts with a friendly introduction before the action kicks in.", reference: "Intro scenes frequently keep the first line polite and easy to repeat." },
      { title: "Polite contrast", context: "Phrases like こちらこそ are common when characters want to sound warm and cooperative.", reference: "The scene uses that social warmth as a memory hook." },
    ],
    manga: [
      { title: "Panel rhythm", context: "Manga dialogue is short because each bubble has to fit the image rhythm.", reference: "That is why the lesson uses a compact surprise line." },
      { title: "Reaction face", context: "The shocked expression is a classic manga beat for a reveal.", reference: "The grammar stays short so the visual can carry the drama." },
    ],
    food: [
      { title: "Ordering cadence", context: "Food scenes often use polite but clipped requests so the line sounds natural at a counter.", reference: "The lesson keeps the order sentence direct and easy to reuse." },
      { title: "Customization language", context: "Menus usually invite choices, so counters like 〜でお願いします feel very natural.", reference: "This is the kind of phrasing you will hear in ramen shops." },
    ],
    travel: [
      { title: "Station shorthand", context: "Travel speech usually compresses the question into the shortest polite form possible.", reference: "The station scene emphasizes short location questions." },
      { title: "Route memory", context: "Directions in transit spaces stay highly formulaic because travelers need them fast.", reference: "The lesson reflects that quick, usable phrasing." },
    ],
    daily: [
      { title: "Routine talk", context: "Daily-life dialogue makes repetition feel natural, which is perfect for spaced review.", reference: "The commute line becomes a habit sentence." },
      { title: "Time markers", context: "Everyday Japanese often uses clear time words like 毎日 and に to anchor routines.", reference: "This keeps the sentence easy to slot into your own schedule." },
    ],
    school: [
      { title: "Classroom routine", context: "School scenes usually move from homework to class to after-school club without much filler.", reference: "The lesson mirrors that structure." },
      { title: "Polite permission", context: "Asking a teacher for another chance is a very common anime and school-drama beat.", reference: "That is why the lesson keeps the request compact." },
    ],
    workplace: [
      { title: "Email etiquette", context: "Japanese office language often sounds more formal than spoken conversation.", reference: "The lesson uses ので and ご覧ください to match that tone." },
      { title: "Reply speed", context: "Brief confirmations are a practical staple of workplace messaging.", reference: "The scene is meant to feel like a real inbox exchange." },
    ],
    etiquette: [
      { title: "Softening requests", context: "Japanese politeness often starts by reducing pressure before the actual request.", reference: "That is why the lesson uses お手数ですが." },
      { title: "Gratitude habit", context: "Simple gratitude lines are culturally important because they keep relationships smooth.", reference: "The closing line reinforces that steady tone." },
    ],
    history: [
      { title: "Code of conduct", context: "Historical or samurai scenes often frame language as discipline rather than chatter.", reference: "The line is short and formal on purpose." },
      { title: "Setting tone", context: "Older or historical scenes tend to use measured phrasing and a strong moral tone.", reference: "That is why the lesson feels close to a code of honor." },
    ],
  };
  const notes = templates[topic] ?? [
    { title: `${title || "Lesson"} context`, context: "This scene is tuned to the lesson theme and meant to be reusable in speaking or review.", reference: "Use it as a personal memory hook." },
  ];
  return notes.slice(0, 3);
}

export function answerTutor(question) {
  const normalized = String(question ?? "").toLowerCase();
  if (normalized.includes("よろしく")) {
    return "It is a compact phrase for polite cooperation. In practical use it means 'please treat me well' or 'I look forward to working with you.'";
  }
  if (normalized.includes("は and が") || normalized.includes("particle")) {
    return "Use は for topic framing and が for focus or emphasis. In short: は sets the scene, が spotlights the subject.";
  }
  if (normalized.includes("nuance")) {
    return "Nuance is usually about politeness, softness, or social distance. Keep the sentence short and compare it to the context.";
  }
  return "Keep the question short. A local LLM fallback would answer this with a focused explanation and one example sentence.";
}

export function answerAiFeature(feature, prompt, context = {}) {
  const text = String(prompt ?? "").trim();
  const lower = text.toLowerCase();

  if (feature === "grammar" || feature === "explain-grammar") {
    const lesson = String(context.lessonTitle ?? "");
    return lesson
      ? `Grammar focus for ${lesson}: keep the sentence short, identify the topic, and match the polite level to the scene.`
      : "Grammar focus: identify the topic, keep the sentence short, and match the polite level to the scene.";
  }

  if (feature === "tutor") {
    return answerTutor(text);
  }

  if (feature === "roleplay") {
    const scenario = String(context.scenario ?? "restaurant");
    const learnerLine = String(context.prompt ?? "").trim();
    const lines = learnerLine
      ? buildRoleplayFollowUp(scenario, learnerLine)
      : buildRoleplayTranscript(scenario);
    return lines.map((line) => `${line.speaker}: ${line.text}`).join("\n");
  }

  if (feature === "correction" || feature === "writing") {
    return `Natural correction: ${normalizeSentence(text || "ラーメンをください")}`;
  }

  if (feature === "challenge-name") {
    return `MVP Challenge: ${text || "Japanese Sprint"}`;
  }

  if (feature === "badge-description") {
    return `${text || "This badge"} marks steady study habits and consistent review.`;
  }

  if (feature === "lesson-draft") {
    const draft = buildLessonDraft((context.title ?? text) || "New Lesson", context.theme ?? "custom");
    return JSON.stringify(draft);
  }

  if (lower.includes("nuance")) {
    return "Nuance is about politeness, tone, and social distance. Keep the answer short and contextual.";
  }

  return "Local AI fallback: short, contextual, and deterministic.";
}

export function buildLessonStudyMaterials(japanese, translation, grammar, title, theme) {
  const safeJapanese = String(japanese ?? "").trim();
  const safeTranslation = String(translation ?? "").trim();
  const safeGrammar = String(grammar ?? "").trim();
  const safeTitle = String(title ?? "New Lesson").trim() || "New Lesson";
  const safeTheme = String(theme ?? "custom").trim() || "custom";

  return {
    grammarPoints: [
      {
        title: "Core grammar",
        explanation: safeGrammar || `Use the ${safeTheme} scene to anchor the sentence in context.`,
        example: safeJapanese || safeTranslation || safeTitle,
      },
      {
        title: "Scene usage",
        explanation:
          safeTheme === "custom"
            ? "Reuse the key phrase in your own study sentence."
            : `Apply the ${safeTheme} setting to make the meaning memorable.`,
        example: safeTranslation || safeJapanese || safeTitle,
      },
    ],
    exercises: [
      {
        type: "multiple-choice",
        prompt: `Which meaning best fits: ${safeJapanese || safeTitle}?`,
        choices: [safeTranslation || safeTitle, safeGrammar || safeTheme, safeTitle].filter(Boolean),
        answer: safeTranslation || safeTitle,
        explanation: safeGrammar || `This line belongs to the ${safeTheme} context.`,
      },
      {
        type: "cloze",
        prompt: `Fill the blank: ${safeJapanese || safeTitle} → ${(safeTranslation || safeTitle).replace(/\b([A-Za-z][A-Za-z']*)\b/, "____")}`,
        choices: [safeTranslation || safeTitle, safeGrammar || safeTheme, safeTitle].filter(Boolean),
        answer: safeTranslation || safeTitle,
        explanation: safeGrammar || `Practice the ${safeTheme} expression with a recall-style prompt.`,
      },
      {
        type: "matching",
        prompt: `Which study cue matches this line: ${safeTitle}?`,
        choices: [safeGrammar || safeTheme, safeTranslation || safeTitle, safeTitle].filter(Boolean),
        answer: safeGrammar || safeTheme,
        explanation: safeGrammar || `Match the phrase to the ${safeTheme} scene.`,
      },
      {
        type: "short-answer",
        prompt: `Translate the scene line: ${safeJapanese || safeTitle}`,
        choices: [],
        answer: safeTranslation || safeTitle,
        explanation: safeGrammar || `Practice the ${safeTheme} expression in a short answer.`,
      },
    ],
    scenes: buildSceneBlueprint(safeTheme, safeTitle, safeJapanese, safeTranslation, safeGrammar),
    popCultureNotes: buildPopCultureNotes(safeTitle, safeTheme),
    kanjiBreakdowns: buildKanjiBreakdowns([], safeTitle, safeTheme, []),
  };
}

export function filterLessonCatalog(lessons, query = "", theme = "", difficulty = "") {
  const normalizedQuery = String(query ?? "").trim().toLowerCase();
  const normalizedTheme = String(theme ?? "").trim().toLowerCase();
  const normalizedDifficulty = String(difficulty ?? "").trim().toLowerCase();
  return (Array.isArray(lessons) ? lessons : []).filter((lesson) => {
    const lessonText = [
      lesson.title,
      lesson.theme,
      lesson.difficulty,
      lesson.japanese,
      lesson.translation,
      lesson.grammar,
      ...(Array.isArray(lesson.vocab) ? lesson.vocab.flatMap((item) => [item.word, item.kana, item.meaning]) : []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (normalizedTheme && !String(lesson.theme ?? "").toLowerCase().includes(normalizedTheme)) return false;
    if (normalizedDifficulty && !String(lesson.difficulty ?? "").toLowerCase().includes(normalizedDifficulty)) return false;
    if (normalizedQuery && !lessonText.includes(normalizedQuery)) return false;
    return true;
  });
}

export function filterModerationActions(actions, filters = {}) {
  const normalizedQuery = String(filters.query ?? "").trim().toLowerCase();
  const normalizedStatus = String(filters.status ?? "").trim().toLowerCase();
  const normalizedType = String(filters.itemType ?? "").trim().toLowerCase();
  const normalizedReviewer = String(filters.reviewer ?? "").trim().toLowerCase();
  return (Array.isArray(actions) ? actions : []).filter((action) => {
    const haystack = [
      action.itemType,
      action.itemId,
      action.status,
      action.decisionReason,
      action.reviewedBy,
      action.notes,
      action.source,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (normalizedType && !String(action.itemType ?? "").toLowerCase().includes(normalizedType)) return false;
    if (normalizedStatus && !String(action.status ?? "").toLowerCase().includes(normalizedStatus)) return false;
    if (normalizedReviewer && !String(action.reviewedBy ?? "").toLowerCase().includes(normalizedReviewer)) return false;
    if (normalizedQuery && !haystack.includes(normalizedQuery)) return false;
    return true;
  });
}

export function findNextLessonId(lessons, completedLessonIds = [], activeLessonId = "") {
  const list = Array.isArray(lessons) ? lessons : [];
  const completed = new Set(Array.isArray(completedLessonIds) ? completedLessonIds : []);
  const active = String(activeLessonId ?? "").trim();
  const incomplete = list.find((lesson) => !completed.has(lesson.id));
  if (incomplete) return incomplete.id;
  return active || (list[0]?.id ?? "");
}

export function buildLessonProgressChecklist(lesson, progress = {}, kanjiReviews = [], savedWords = [], savedKanji = []) {
  const safeLesson = lesson ?? {};
  const completedLessons = new Set(Array.isArray(progress.completedLessons) ? progress.completedLessons : []);
  const completedExercises = new Set(Array.isArray(progress.completedExercises) ? progress.completedExercises : []);
  const lessonNotes = progress.lessonNotes && typeof progress.lessonNotes === "object" ? progress.lessonNotes : {};
  const lessonExercises = Array.isArray(safeLesson.exercises) ? safeLesson.exercises : [];
  const lessonVocab = Array.isArray(safeLesson.vocab) ? safeLesson.vocab : [];
  const lessonKanji = Array.isArray(safeLesson.kanji) ? safeLesson.kanji : [];
  const exerciseCount = lessonExercises.length;
  const completedExerciseCount = lessonExercises.filter((exercise, index) => completedExercises.has(exercise.id ?? `${safeLesson.id}-exercise-${index + 1}`)).length;
  const noteText = String(lessonNotes?.[safeLesson.id] ?? "").trim();
  const savedWordCount = lessonVocab.filter((item) =>
    Array.isArray(savedWords)
      ? savedWords.some((saved) => String(saved?.term ?? "").trim() === String(item.word ?? item.term ?? "").trim())
      : false
  ).length;
  const savedKanjiCount = lessonKanji.filter((character) =>
    Array.isArray(savedKanji)
      ? savedKanji.some((saved) => String(saved?.character ?? "").trim() === String(character ?? "").trim())
      : false
  ).length;
  const reviewedKanjiCount = Array.isArray(kanjiReviews)
    ? kanjiReviews.filter((entry) => lessonKanji.includes(entry.character)).length
    : 0;

  return [
    {
      key: "complete-lesson",
      label: "Complete lesson",
      detail: safeLesson.title || "Mark the lesson as finished to lock in the scene.",
      complete: completedLessons.has(safeLesson.id),
    },
    {
      key: "finish-exercises",
      label: "Finish exercises",
      detail: `${completedExerciseCount}/${exerciseCount || 1} lesson exercises completed.`,
      complete: exerciseCount > 0 ? completedExerciseCount >= exerciseCount : true,
    },
    {
      key: "save-vocab",
      label: "Save a vocab item",
      detail: savedWordCount > 0 ? `${savedWordCount}/${lessonVocab.length} vocab items saved.` : "Bookmark a word from this lesson.",
      complete: savedWordCount > 0 || lessonVocab.length === 0,
    },
    {
      key: "save-kanji",
      label: "Save a kanji",
      detail: savedKanjiCount > 0 ? `${savedKanjiCount}/${lessonKanji.length} kanji saved.` : "Bookmark a kanji from this lesson.",
      complete: savedKanjiCount > 0 || lessonKanji.length === 0,
    },
    {
      key: "review-kanji",
      label: "Review kanji",
      detail: reviewedKanjiCount > 0 ? `${reviewedKanjiCount} lesson kanji already have review cards.` : "Open the kanji drill to rehearse the scene characters.",
      complete: reviewedKanjiCount > 0 || lessonKanji.length === 0,
    },
    {
      key: "write-note",
      label: "Write a note",
      detail: noteText ? noteText : "Capture a reminder, translation trick, or grammar cue for this lesson.",
      complete: Boolean(noteText),
    },
  ];
}

export function buildLessonDialogueLines(title, japanese, translation, theme) {
  const safeTitle = String(title ?? "Lesson").trim() || "Lesson";
  const safeJapanese = String(japanese ?? "").trim();
  const safeTranslation = String(translation ?? "").trim();
  const safeTheme = String(theme ?? "custom").trim() || "custom";

  return [
    { speaker: "Narration", text: `${safeTitle} (${safeTheme})` },
    { speaker: "Speaker A", text: safeJapanese || safeTranslation || `${safeTitle} begins.` },
    {
      speaker: "Speaker B",
      text: safeTranslation
        ? `${safeTranslation} — ${safeTheme} context.`
        : `Use this ${safeTheme} line to practice the scene.`,
    },
  ];
}

export function buildRoleplayFollowUp(scenario, learnerLine) {
  const scripts = {
    restaurant: {
      system: "You are at a ramen shop.",
      reply: "かしこまりました。スープはあっさりでよろしいですか？",
      coaching: "Good. A polite request fits this setting.",
    },
    travel: {
      system: "You are asking for directions at a station.",
      reply: "はい、まっすぐ行って左です。",
      coaching: "Good. Directions should stay short and clear.",
    },
    anime: {
      system: "You are in an anime-style training scene.",
      reply: "いい気合いだ。次の一手を見せてくれ。",
      coaching: "Good. Strong tone works for anime-style roleplay.",
    },
  };
  const script = scripts[String(scenario ?? "restaurant")] ?? scripts.restaurant;
  const reply = String(learnerLine ?? "").trim();
  return [
    { speaker: "System", text: script.system },
    { speaker: "You", text: reply || "..." },
    { speaker: "Server", text: script.reply },
    { speaker: "Tutor", text: script.coaching },
  ];
}

export function evaluateSpeakingSubmission(sentence, prompt = "") {
  const raw = String(sentence ?? "").trim();
  const transcript = normalizeSentence(raw || "ラーメンをください");
  const reference = String(prompt ?? "").trim() || "ラーメンをください";
  const issues = [];

  if (!raw) issues.push("Say a sentence before checking it.");
  if (transcript.length < 6) issues.push("Use a slightly longer sentence.");
  if (/[A-Za-z]/.test(transcript)) issues.push("Remove romaji from the spoken Japanese.");
  if (!/[。！？]$/.test(raw)) issues.push("End the sentence cleanly.");
  if (!/(は|が|を|に|で|と|ください|です|ます)/.test(transcript)) issues.push("Include a basic particle or polite ending.");

  const score = Math.max(40, 100 - issues.length * 14);
  const correction = `Natural correction: ${transcript}`;
  const suggestion = raw === reference ? "Your sentence already matches the model response." : `Try: ${reference}`;

  return {
    score,
    issues,
    transcript,
    correction,
    suggestion,
    reference,
  };
}

export function evaluateListeningAnswer(correctAnswer, selectedAnswer, prompt = "") {
  const expected = String(correctAnswer ?? "").trim().toLowerCase();
  const chosen = String(selectedAnswer ?? "").trim().toLowerCase();
  const listeningPrompt = String(prompt ?? "").trim();
  if (!expected) {
    return "Listening prompt unavailable. Replay the line and try again.";
  }
  if (chosen && chosen === expected) {
    return listeningPrompt
      ? `Correct. The prompt asked about ${listeningPrompt}.`
      : "Correct. You matched the listening prompt.";
  }
  return listeningPrompt
    ? `Not quite. The prompt asked about ${listeningPrompt}. Try replaying the line.`
    : "Not quite. Replay the line and listen for the key detail.";
}

export function evaluateWritingSubmission(sentence) {
  const raw = String(sentence ?? "").trim();
  const text = normalizeSentence(raw || "ラーメンをください");
  const issues = [];

  if (!raw) issues.push("Write a sentence before checking it.");
  if (text.length < 8) issues.push("Use a slightly longer sentence.");
  if (!/[。！？]$/.test(raw)) issues.push("Add a Japanese period at the end.");
  if (!/(は|が|を|に|で|と)/.test(text)) issues.push("Include at least one basic particle.");
  if (!/(です|ます|ください)/.test(text)) issues.push("Try a polite ending such as です, ます, or ください.");
  if (/[A-Za-z]/.test(text)) issues.push("Remove romaji from the Japanese answer.");

  const score = Math.max(40, 100 - issues.length * 12);
  const suggestions = [];
  if (!/(です|ます|ください)/.test(text)) suggestions.push("Make the sentence polite.");
  if (!/[。！？]$/.test(raw)) suggestions.push("End with 。");
  if (!/(は|が|を|に|で|と)/.test(text)) suggestions.push("Add a particle to connect the phrase.");

  return {
    score,
    issues,
    correction: `Natural correction: ${text}`,
    suggestions,
    normalized: text,
  };
}

function normalizeExerciseAnswer(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[。、！？・,.!?]/g, "");
}

export function evaluateLessonExercise(exercise = {}, submission = {}) {
  const type = String(exercise.type ?? "multiple-choice").trim().toLowerCase();
  const answer = String(exercise.answer ?? "").trim();
  const selected = String(submission.selected ?? submission.answer ?? submission.input ?? "").trim();
  const prompt = String(exercise.prompt ?? "").trim();
  const explanation = String(exercise.explanation ?? "").trim();
  const choices = Array.isArray(exercise.choices) ? exercise.choices : [];

  if (!answer) {
    return {
      correct: false,
      score: 0,
      feedback: prompt ? `Exercise unavailable: ${prompt}` : "Exercise unavailable.",
      explanation,
      selected,
      answer,
      choices,
    };
  }

  const normalizedAnswer = normalizeExerciseAnswer(answer);
  const normalizedSelected = normalizeExerciseAnswer(selected);
  const isMultipleChoice = type.includes("multiple") || type.includes("choice") || type.includes("matching");
  const isTextInput = type.includes("translation") || type.includes("short") || type.includes("cloze") || type.includes("ordering");
  const correct = isMultipleChoice
    ? selected === answer || normalizedSelected === normalizedAnswer
    : isTextInput
      ? normalizedSelected === normalizedAnswer || selected === answer
      : normalizedSelected === normalizedAnswer || selected === answer;

  const score = correct ? 100 : 50;
  const feedback = correct
    ? explanation ? `Correct. ${explanation}` : "Correct."
    : explanation
      ? `Not quite. ${explanation}`
      : `Not quite. The expected answer is ${answer}.`;

  return {
    correct,
    score,
    feedback,
    explanation,
    prompt,
    selected,
    answer,
    choices,
  };
}

export function buildLessonDraft(title, theme) {
  const normalizedTheme = String(theme ?? "custom").trim().toLowerCase() || "custom";
  const normalizedTitle = String(title ?? "New Lesson").trim() || "New Lesson";

  const templates = {
    anime: {
      japanese: "今日は新しい必殺技を練習します。",
      romaji: "Kyou wa atarashii hissatsuwaza o renshuu shimasu.",
      translation: "Today we are practicing a new special move.",
      grammar: "Use dictionary form with ます and the object particle を to keep the scene energetic.",
      vocab: [
        { word: "新しい", kana: "あたらしい", meaning: "new" },
        { word: "必殺技", kana: "ひっさつわざ", meaning: "special move" },
        { word: "練習", kana: "れんしゅう", meaning: "practice" },
      ],
      kanji: ["新", "技", "練"],
    },
    food: {
      japanese: "おすすめのラーメンをください。",
      romaji: "Osusume no raamen o kudasai.",
      translation: "Please give me your recommended ramen.",
      grammar: "Use の to connect the recommendation and をください for a polite request.",
      vocab: [
        { word: "おすすめ", kana: "おすすめ", meaning: "recommendation" },
        { word: "ラーメン", kana: "ラーメン", meaning: "ramen" },
        { word: "ください", kana: "ください", meaning: "please give me" },
      ],
      kanji: ["食", "味", "店"],
    },
    travel: {
      japanese: "切符売り場はどこですか。",
      romaji: "Kippu uriba wa doko desu ka.",
      translation: "Where is the ticket counter?",
      grammar: "Use は for the topic and ですか for a polite question.",
      vocab: [
        { word: "切符", kana: "きっぷ", meaning: "ticket" },
        { word: "売り場", kana: "うりば", meaning: "counter / booth" },
        { word: "どこ", kana: "どこ", meaning: "where" },
      ],
      kanji: ["切", "場", "問"],
    },
    history: {
      japanese: "武士は言葉より行動で示します。",
      romaji: "Bushi wa kotoba yori koudou de shimeshimasu.",
      translation: "Samurai show through actions rather than words.",
      grammar: "Use より for comparison and ます for a polite narration style.",
      vocab: [
        { word: "武士", kana: "ぶし", meaning: "samurai / warrior" },
        { word: "行動", kana: "こうどう", meaning: "action" },
        { word: "示します", kana: "しめします", meaning: "show / indicate" },
      ],
      kanji: ["武", "行", "示"],
    },
    manga: {
      japanese: "次のコマで主人公が答えを見つけます。",
      romaji: "Tsugi no koma de shujinkou ga kotae o mitsukemasu.",
      translation: "In the next panel, the protagonist finds the answer.",
      grammar: "Use 次の to point to the next panel and が for the subject that acts.",
      vocab: [
        { word: "次の", kana: "つぎの", meaning: "next" },
        { word: "コマ", kana: "こま", meaning: "panel" },
        { word: "主人公", kana: "しゅじんこう", meaning: "protagonist" },
      ],
      kanji: ["次", "主", "公"],
    },
    daily: {
      japanese: "朝ごはんのあとで駅まで歩きます。",
      romaji: "Asagohan no ato de eki made arukimasu.",
      translation: "After breakfast, I walk to the station.",
      grammar: "Use のあとで for sequencing and まで for the endpoint of movement.",
      vocab: [
        { word: "朝ごはん", kana: "あさごはん", meaning: "breakfast" },
        { word: "駅", kana: "えき", meaning: "station" },
        { word: "歩きます", kana: "あるきます", meaning: "walk" },
      ],
      kanji: ["朝", "駅", "歩"],
    },
    school: {
      japanese: "授業の前に宿題を確認します。",
      romaji: "Jugyou no mae ni shukudai o kakunin shimasu.",
      translation: "Before class, I check the homework.",
      grammar: "Use の前に to place one action before another and を for the direct object.",
      vocab: [
        { word: "授業", kana: "じゅぎょう", meaning: "class / lesson" },
        { word: "宿題", kana: "しゅくだい", meaning: "homework" },
        { word: "確認します", kana: "かくにんします", meaning: "check / confirm" },
      ],
      kanji: ["授", "業", "宿"],
    },
    workplace: {
      japanese: "会議の資料を午後までにまとめます。",
      romaji: "Kaigi no shiryou o gogo made ni matomemasu.",
      translation: "I will organize the meeting materials by this afternoon.",
      grammar: "Use までに for a deadline and を for the object being organized.",
      vocab: [
        { word: "会議", kana: "かいぎ", meaning: "meeting" },
        { word: "資料", kana: "しりょう", meaning: "materials / documents" },
        { word: "まとめます", kana: "まとめます", meaning: "organize / summarize" },
      ],
      kanji: ["会", "資", "料"],
    },
    etiquette: {
      japanese: "お手数ですが、もう一度お願いします。",
      romaji: "Otesuu desu ga, mou ichido onegaishimasu.",
      translation: "Sorry for the trouble, but please once more.",
      grammar: "Use お手数ですが to soften a request and もう一度 for 'one more time.'",
      vocab: [
        { word: "お手数ですが", kana: "おてすうですが", meaning: "sorry for the trouble, but..." },
        { word: "もう一度", kana: "もういちど", meaning: "once more" },
        { word: "お願いします", kana: "おねがいします", meaning: "please" },
      ],
      kanji: ["手", "度", "願"],
    },
  };

  const key = normalizedTheme.includes("anime")
    ? "anime"
    : normalizedTheme.includes("manga")
      ? "manga"
    : normalizedTheme.includes("food")
      ? "food"
    : normalizedTheme.includes("travel")
      ? "travel"
    : normalizedTheme.includes("daily")
      ? "daily"
    : normalizedTheme.includes("school")
      ? "school"
    : normalizedTheme.includes("work")
      ? "workplace"
    : normalizedTheme.includes("etiquette") || normalizedTheme.includes("polite")
      ? "etiquette"
    : normalizedTheme.includes("history") || normalizedTheme.includes("samurai")
      ? "history"
      : "travel";
  const template = templates[key];
  const activities = buildLessonStudyMaterials(template.japanese, template.translation, template.grammar, normalizedTitle, normalizedTheme);
  const scenes = buildSceneBlueprint(normalizedTheme, normalizedTitle, template.japanese, template.translation, template.grammar);
  const popCultureNotes = buildPopCultureNotes(normalizedTitle, normalizedTheme);
  const kanjiBreakdowns = buildKanjiBreakdowns(template.kanji, normalizedTitle, normalizedTheme, template.vocab);
  return {
    id: `lesson-${String(normalizedTitle).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "new"}`,
    title: normalizedTitle,
    theme: normalizedTheme,
    difficulty: key === "history" || key === "workplace" || key === "school" ? "N4" : "N5",
    japanese: template.japanese,
    romaji: template.romaji,
    translation: template.translation,
    grammar: template.grammar,
    vocab: template.vocab,
    kanji: template.kanji,
    dialogueLines: buildLessonDialogueLines(normalizedTitle, template.japanese, template.translation, normalizedTheme),
    grammarPoints: activities.grammarPoints,
    exercises: activities.exercises,
    scenes,
    popCultureNotes,
    kanjiBreakdowns,
  };
}

export function buildLessonPack(title, theme, count = 3) {
  const normalizedTitle = String(title ?? "New Lesson").trim() || "New Lesson";
  const normalizedTheme = String(theme ?? "travel").trim().toLowerCase() || "travel";
  const size = Math.max(1, Math.min(6, Number(count) || 3));
  const key = normalizedTheme.includes("anime")
    ? "anime"
    : normalizedTheme.includes("manga")
      ? "manga"
    : normalizedTheme.includes("food")
      ? "food"
    : normalizedTheme.includes("travel")
      ? "travel"
    : normalizedTheme.includes("daily")
      ? "daily"
    : normalizedTheme.includes("school")
      ? "school"
    : normalizedTheme.includes("work")
      ? "workplace"
    : normalizedTheme.includes("etiquette") || normalizedTheme.includes("polite")
      ? "etiquette"
    : normalizedTheme.includes("history") || normalizedTheme.includes("samurai")
      ? "history"
      : "travel";

  const variants = {
    anime: [
      { suffix: "Opening Scene", japanese: "今日は新しい必殺技を練習します。", romaji: "Kyou wa atarashii hissatsuwaza o renshuu shimasu.", translation: "Today we are practicing a new special move.", grammar: "Use dictionary form with ます and the object particle を to keep the scene energetic." },
      { suffix: "Training Scene", japanese: "主人公は仲間と一緒に準備します。", romaji: "Shujinkou wa nakama to issho ni junbi shimasu.", translation: "The protagonist prepares together with their friends.", grammar: "Use と一緒に to describe doing something together." },
      { suffix: "Rival Encounter", japanese: "次の試合で勝ちます。", romaji: "Tsugi no shiai de kachimasu.", translation: "We will win the next match.", grammar: "Use 次の to mark the next event and で to show the setting." },
    ],
    manga: [
      { suffix: "First Panel", japanese: "次のコマで主人公が答えを見つけます。", romaji: "Tsugi no koma de shujinkou ga kotae o mitsukemasu.", translation: "In the next panel, the protagonist finds the answer.", grammar: "Use 次の to point to the next panel and が for the subject that acts." },
      { suffix: "Dialogue Bubble", japanese: "このセリフは静かですが強いです。", romaji: "Kono serifu wa shizuka desu ga tsuyoi desu.", translation: "This line is quiet, but it is strong.", grammar: "Use が to contrast two ideas in a short manga-like sentence." },
      { suffix: "Reveal Page", japanese: "最後のページで秘密が明らかになります。", romaji: "Saigo no peeji de himitsu ga akiraka ni narimasu.", translation: "The secret becomes clear on the last page.", grammar: "Use になります for a change of state in a scene description." },
    ],
    food: [
      { suffix: "Ordering", japanese: "おすすめのラーメンをください。", romaji: "Osusume no raamen o kudasai.", translation: "Please give me your recommended ramen.", grammar: "Use の to connect the recommendation and をください for a polite request." },
      { suffix: "Side Dish", japanese: "餃子も一つお願いします。", romaji: "Gyouza mo hitotsu onegaishimasu.", translation: "One serving of gyoza too, please.", grammar: "Use も to add an item and 一つ for a counter-based request." },
      { suffix: "Drink Choice", japanese: "お茶は冷たいほうがいいです。", romaji: "Ocha wa tsumetai hou ga ii desu.", translation: "Tea is better cold.", grammar: "Use ほうがいいです to express a recommendation." },
    ],
    travel: [
      { suffix: "Ticket Counter", japanese: "切符売り場はどこですか。", romaji: "Kippu uriba wa doko desu ka.", translation: "Where is the ticket counter?", grammar: "Use は for the topic and ですか for a polite question." },
      { suffix: "Platform Check", japanese: "この電車は何番線ですか。", romaji: "Kono densha wa nanbansen desu ka.", translation: "Which platform is this train from?", grammar: "Use この and 何番線 for location questions at a station." },
      { suffix: "Exit Direction", japanese: "出口までまっすぐ行ってください。", romaji: "Deguchi made massugu itte kudasai.", translation: "Please go straight to the exit.", grammar: "Use まで to show a destination and てください for directions." },
    ],
    daily: [
      { suffix: "Morning Routine", japanese: "朝ごはんのあとで駅まで歩きます。", romaji: "Asagohan no ato de eki made arukimasu.", translation: "After breakfast, I walk to the station.", grammar: "Use のあとで for sequencing and まで for the endpoint of movement." },
      { suffix: "Evening Errand", japanese: "夕方にスーパーで買い物をします。", romaji: "Yuugata ni suupaa de kaimono o shimasu.", translation: "In the evening, I shop at the supermarket.", grammar: "Use に for time and で for the location of the activity." },
      { suffix: "Weekend Walk", japanese: "週末は公園でゆっくりします。", romaji: "Shuumatsu wa kouen de yukkuri shimasu.", translation: "On weekends, I relax at the park.", grammar: "Use は to set the topic and で for the place where the action happens." },
    ],
    school: [
      { suffix: "Before Class", japanese: "授業の前に宿題を確認します。", romaji: "Jugyou no mae ni shukudai o kakunin shimasu.", translation: "Before class, I check the homework.", grammar: "Use の前に to place one action before another and を for the direct object." },
      { suffix: "Club Meeting", japanese: "放課後に図書室で勉強します。", romaji: "Houkago ni toshoshitsu de benkyou shimasu.", translation: "After school, I study in the library.", grammar: "Use に for time and で for the place of study." },
      { suffix: "Teacher Question", japanese: "先生にもう一度聞いてもいいですか。", romaji: "Sensei ni mou ichido kiite mo ii desu ka.", translation: "May I ask the teacher once more?", grammar: "Use てもいいですか to ask for permission politely." },
    ],
    workplace: [
      { suffix: "Meeting Notes", japanese: "会議の資料を午後までにまとめます。", romaji: "Kaigi no shiryou o gogo made ni matomemasu.", translation: "I will organize the meeting materials by this afternoon.", grammar: "Use までに for a deadline and を for the object being organized." },
      { suffix: "Email Draft", japanese: "先ほどの件を確認して返信します。", romaji: "Sakihodo no ken o kakunin shite henshin shimasu.", translation: "I will check the earlier matter and reply.", grammar: "Use て form to link actions in a work setting." },
      { suffix: "Shift Handover", japanese: "次の担当者に状況を伝えます。", romaji: "Tsugi no tantousha ni joukyou o tsutaemasu.", translation: "I will tell the next person in charge about the situation.", grammar: "Use に for the recipient and を for the item being shared." },
    ],
    etiquette: [
      { suffix: "Polite Request", japanese: "お手数ですが、もう一度お願いします。", romaji: "Otesuu desu ga, mou ichido onegaishimasu.", translation: "Sorry for the trouble, but please once more.", grammar: "Use お手数ですが to soften a request and もう一度 for 'one more time.'" },
      { suffix: "Soft Apology", japanese: "申し訳ありませんが、少し待ってください。", romaji: "Moushiwake arimasen ga, sukoshi matte kudasai.", translation: "I’m sorry, but please wait a moment.", grammar: "Use 申し訳ありませんが to begin a polite refusal or delay." },
      { suffix: "Gratitude", japanese: "いつもありがとうございます。", romaji: "Itsumo arigatou gozaimasu.", translation: "Thank you as always.", grammar: "Use いつも to express consistent appreciation in a polite tone." },
    ],
    history: [
      { suffix: "Resolve", japanese: "武士は言葉より行動で示します。", romaji: "Bushi wa kotoba yori koudou de shimeshimasu.", translation: "Samurai show through actions rather than words.", grammar: "Use より for comparison and ます for a polite narration style." },
      { suffix: "Festival Speech", japanese: "昔の町では祭りが人々をつなぎました。", romaji: "Mukashi no machi de wa matsuri ga hitobito o tsunagimashita.", translation: "In old towns, festivals connected people.", grammar: "Use では to set a historical context and が for the subject." },
      { suffix: "Castle View", japanese: "城から町全体が見えます。", romaji: "Shiro kara machi zentai ga miemasu.", translation: "The whole town can be seen from the castle.", grammar: "Use から to mark the starting point of a view or movement." },
    ],
  };
  const packVariants = variants[key] ?? variants.travel;
  const lessons = [];

  for (let index = 0; index < size; index += 1) {
    const variant = packVariants[index % packVariants.length];
    const lessonTitle = `${normalizedTitle}: ${variant.suffix}`;
    const lesson = buildLessonDraft(lessonTitle, normalizedTheme);
    const activities = buildLessonStudyMaterials(
      variant.japanese,
      variant.translation,
      variant.grammar,
      lessonTitle,
      normalizedTheme
    );
    const scenes = buildSceneBlueprint(normalizedTheme, lessonTitle, variant.japanese, variant.translation, variant.grammar);
    const popCultureNotes = buildPopCultureNotes(lessonTitle, normalizedTheme);
    const kanjiBreakdowns = buildKanjiBreakdowns(lesson.kanji, lessonTitle, normalizedTheme, lesson.vocab);
    lessons.push({
      ...lesson,
      id: `${lesson.id}-${String(index + 1).padStart(2, "0")}`,
      title: lessonTitle,
      japanese: variant.japanese,
      romaji: variant.romaji,
      translation: variant.translation,
      grammar: variant.grammar,
      dialogueLines: buildLessonDialogueLines(lessonTitle, variant.japanese, variant.translation, normalizedTheme),
      grammarPoints: activities.grammarPoints,
      exercises: activities.exercises,
      scenes,
      popCultureNotes,
      kanjiBreakdowns,
    });
  }

  return lessons;
}

export function buildRoleplayTranscript(scenario) {
  const scripts = {
    restaurant: [
      { speaker: "System", text: "You are ordering at a ramen shop." },
      { speaker: "You", text: "ラーメンをください。" },
      { speaker: "Server", text: "はい。スープはあっさりですか、こってりですか？" },
      { speaker: "You", text: "あっさりでお願いします。" },
    ],
    travel: [
      { speaker: "System", text: "You are asking for directions at a station." },
      { speaker: "You", text: "切符売り場はどこですか。" },
      { speaker: "Staff", text: "まっすぐ行って左です。" },
      { speaker: "You", text: "ありがとうございます。" },
    ],
    anime: [
      { speaker: "System", text: "You are in an anime-style scene before training." },
      { speaker: "You", text: "今日は負けない。" },
      { speaker: "Rival", text: "その気持ち、見せてもらうよ。" },
      { speaker: "You", text: "行くぞ。" },
    ],
  };
  return scripts[scenario] ?? scripts.restaurant;
}

export function sm2Next(review, grade) {
  const q = Number(grade);
  let interval = Number(review.interval_days || 1);
  let repetitions = Number(review.repetitions || 0);
  let ease = Number(review.ease || 2.5);
  let mistakes = Number(review.mistakes || 0);

  if (q < 3) {
    repetitions = 0;
    interval = 1;
    mistakes += 1;
    ease = Math.max(1.3, ease - 0.2);
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.max(1, Math.round(interval * ease));
    repetitions += 1;
    ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  }

  return {
    interval_days: interval,
    repetitions,
    ease,
    mistakes,
    due: new Date(Date.now() + interval * 86400000).toISOString(),
  };
}
