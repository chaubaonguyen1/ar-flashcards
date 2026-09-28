import type { Deck } from "@flashcards/shared";

export const DECK: Deck = {
  id: "starter",
  title: "Starter Words",
  cards: [
    { id: "apple", word: "Apple", phonetic: "/ˈæp.əl/", meaningVi: "quả táo", example: "I eat an apple every day.", distractors: ["Orange", "Ball"] },
    { id: "tree", word: "Tree", phonetic: "/triː/", meaningVi: "cái cây", example: "The bird is in the tree.", distractors: ["Flower", "Grass"] },
    { id: "house", word: "House", phonetic: "/haʊs/", meaningVi: "ngôi nhà", example: "My house has a red roof.", distractors: ["School", "Tent"] },
    { id: "car", word: "Car", phonetic: "/kɑːr/", meaningVi: "xe ô tô", example: "Dad drives a blue car.", distractors: ["Bus", "Bike"] },
    { id: "fish", word: "Fish", phonetic: "/fɪʃ/", meaningVi: "con cá", example: "The fish swims in the water.", distractors: ["Bird", "Frog"] },
    { id: "sun", word: "Sun", phonetic: "/sʌn/", meaningVi: "mặt trời", example: "The sun is hot today.", distractors: ["Moon", "Star"] },
  ],
};
