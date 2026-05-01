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

