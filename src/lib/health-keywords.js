// Cheap multilingual health-keyword prefilter for the VOICE step only. Leaf
// module, no imports.
//
// A pre-recorded voice memo goes out before the reply model runs, so the
// reply model's medical handoff marker can't stop it. The intent classifier's
// medical_question signal is the main check; this catches what it misses
// ("I have a herniated disc, how do I start?" classified warm_intent 0.9
// with no signal). A match only skips the voice memo: the message falls
// through to the text reply, where the marker check runs. It never blocks
// the text reply.
//
// Deliberately broad: a false positive costs one voice memo (the lead still
// gets a text reply); a miss can send a canned memo to a medical question.

const TERMS = [
  // English
  "pain", "painful", "injury", "injuries", "injured", "hurt", "hurts", "hurting",
  "pregnant", "pregnancy", "breastfeeding", "breast feeding", "nursing",
  "medication", "medications", "meds", "medicine", "prescription",
  "surgery", "surgeries", "operation", "condition", "diagnosed", "diagnosis",
  "doctor", "physio", "physical therapy", "therapist",
  "anxiety", "depression", "depressed", "adhd", "eating disorder",
  "disc", "herniated", "knee", "knees", "back", "shoulder", "hip", "spine",
  "diabetes", "diabetic", "blood pressure", "heart", "asthma", "arthritis",
  "cancer", "chemo", "thyroid", "pcos", "postpartum", "allergy", "allergic",
  // Spanish
  "dolor", "dolores", "embarazada", "embarazo", "lactancia", "amamantando",
  "lesión", "lesion", "lesionado", "lesionada", "medicamento", "medicamentos",
  "medicina", "cirugía", "cirugia", "operación", "operacion", "médico", "medico",
  "doctora", "ansiedad", "depresión", "depresion", "rodilla", "espalda",
  "hernia", "diabetes", "embarazadas", "enfermedad", "diagnosticado", "diagnosticada",
  // Portuguese
  "dor", "dores", "grávida", "gravida", "gravidez", "amamentando", "amamentação",
  "amamentacao", "lesão", "lesao", "machucado", "remédio", "remedio", "remédios",
  "medicação", "medicacao", "cirurgia", "joelho", "costas", "ansiedade",
  "depressão", "depressao", "doença", "doenca",
];

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-word match, Unicode-aware (so "dolor" doesn't match inside
// "dolorosa" and "back" doesn't match inside "feedback").
const HEALTH_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${TERMS.map(escapeRe).join("|")})(?![\\p{L}\\p{N}])`,
  "iu"
);

/**
 * @param {string} text - the lead's message
 * @returns {boolean} true when the message mentions a health term
 */
export function mentionsHealth(text) {
  return HEALTH_RE.test(String(text ?? ""));
}
