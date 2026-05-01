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
    return buildRoleplayTranscript(scenario).map((line) => `${line.speaker}: ${line.text}`).join("\n");
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
        type: "translation",
        prompt: `Translate the scene line: ${safeJapanese || safeTitle}`,
        choices: [],
        answer: safeTranslation || safeTitle,
        explanation: safeGrammar || `Practice the ${safeTheme} expression in a short answer.`,
      },
    ],
  };
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
  const isMultipleChoice = type.includes("multiple") || type.includes("choice");
  const correct = isMultipleChoice
    ? selected === answer || normalizedSelected === normalizedAnswer
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
    grammarPoints: activities.grammarPoints,
    exercises: activities.exercises,
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
    const lesson = buildLessonDraft(`${normalizedTitle}: ${variant.suffix}`, normalizedTheme);
    const activities = buildLessonStudyMaterials(
      variant.japanese,
      variant.translation,
      variant.grammar,
      `${normalizedTitle}: ${variant.suffix}`,
      normalizedTheme
    );
    lessons.push({
      ...lesson,
      id: `${lesson.id}-${String(index + 1).padStart(2, "0")}`,
      title: `${normalizedTitle}: ${variant.suffix}`,
      japanese: variant.japanese,
      romaji: variant.romaji,
      translation: variant.translation,
      grammar: variant.grammar,
      grammarPoints: activities.grammarPoints,
      exercises: activities.exercises,
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
