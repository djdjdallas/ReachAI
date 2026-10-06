import { describe, it, expect } from "vitest";
import { mentionsHealth } from "./health-keywords";

describe("mentionsHealth (voice-step prefilter)", () => {
  it.each([
    "I have a herniated disc, how do I start?",
    "my knee hurts when I squat",
    "is it ok if im pregnant",
    "can i do this while breastfeeding",
    "I'm on meds for my blood pressure",
    "had surgery last year",
    "I was diagnosed with PCOS",
    "my doctor said no running",
    "will it help my anxiety",
    "bad lower back",
    "tengo dolor en la rodilla",
    "estoy embarazada",
    "tuve una lesión",
    "tomo medicamentos",
    "estou grávida",
    "tenho dor nas costas",
    "MY KNEE",
  ])("matches %j", (t) => {
    expect(mentionsHealth(t)).toBe(true);
  });

  it.each([
    "how many days a week do we train",
    "what's included",
    "do you do payment plans",
    "send me the link",
    "love the feedback you gave",
    "dolorosa no es una palabra en la lista",
    "",
  ])("does not match %j", (t) => {
    expect(mentionsHealth(t)).toBe(false);
  });
});
