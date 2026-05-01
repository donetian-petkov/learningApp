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
  };

  const key = normalizedTheme.includes("anime")
    ? "anime"
    : normalizedTheme.includes("food")
      ? "food"
      : normalizedTheme.includes("travel")
        ? "travel"
        : normalizedTheme.includes("history") || normalizedTheme.includes("samurai")
          ? "history"
          : "travel";
  const template = templates[key];
  return {
    id: `lesson-${String(normalizedTitle).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "new"}`,
    title: normalizedTitle,
    theme: normalizedTheme,
    difficulty: key === "history" ? "N4" : "N5",
    japanese: template.japanese,
    romaji: template.romaji,
    translation: template.translation,
    grammar: template.grammar,
    vocab: template.vocab,
    kanji: template.kanji,
  };
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
