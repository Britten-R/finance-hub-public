// Facts about your life that the weekly coach uses. These are made-up examples; edit freely.
export const profile = {
  school: "Example University",
  mealPlan: {
    swipesPerWeek: 10,
    diningDollarsPerSemester: 300, // prepaid dining dollars, already paid for
    note: "Dining hall meals and dining dollars are already paid for, so using them instead of paying with the card saves real money.",
  },
  habits: [
    "Often buys coffee on campus between classes.",
    "Picks up late-night snacks; the goal is a few nights a week at most.",
  ],
  // Matches the example budget in mock-data.ts.
  money: {
    income: "Part-time job, about the same each month.",
    goal: "Stay within the monthly budget and add a little to savings each month.",
    rules: [
      "Eat out about once a week; use the meal plan otherwise.",
      "Keep subscriptions to the ones actually used each month.",
      "Travel and transport: about $100 a month.",
    ],
  },
};
