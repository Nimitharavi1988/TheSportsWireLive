import { describe, it, expect } from "vitest";
import { instagramPhotoRoom, topicInstagramPhotoCap, TOPIC_IG_PHOTO_PER_DAY } from "./topicInstagramCap";

describe("topic Instagram photo cap", () => {
  it("defaults to a small daily number and reads the override, 0 included", () => {
    expect(topicInstagramPhotoCap(undefined)).toBe(TOPIC_IG_PHOTO_PER_DAY);
    expect(topicInstagramPhotoCap("")).toBe(TOPIC_IG_PHOTO_PER_DAY);
    expect(topicInstagramPhotoCap("abc")).toBe(TOPIC_IG_PHOTO_PER_DAY);
    expect(topicInstagramPhotoCap("-2")).toBe(TOPIC_IG_PHOTO_PER_DAY);
    expect(topicInstagramPhotoCap("0")).toBe(0);
    expect(topicInstagramPhotoCap(" 5 ")).toBe(5);
  });
  it("leaves the rest of the budget, never below zero", () => {
    expect(instagramPhotoRoom(0, 3)).toBe(3);
    expect(instagramPhotoRoom(2, 3)).toBe(1);
    expect(instagramPhotoRoom(3, 3)).toBe(0);
    expect(instagramPhotoRoom(9, 3)).toBe(0);
    expect(instagramPhotoRoom(0, 0)).toBe(0);
  });
});

import { mainInstagramPhotoCap, MAIN_IG_PHOTO_PER_DAY } from "./topicInstagramCap";
describe("main Instagram photo cap", () => {
  it("defaults to 8 and reads the override, 0 included", () => {
    expect(MAIN_IG_PHOTO_PER_DAY).toBe(8);
    expect(mainInstagramPhotoCap(undefined)).toBe(8);
    expect(mainInstagramPhotoCap("abc")).toBe(8);
    expect(mainInstagramPhotoCap("0")).toBe(0);
    expect(mainInstagramPhotoCap("12")).toBe(12);
  });
});
