export const state = {
  version: 'v3.35.3',
  recipes: [],
  draftRecipes: [],
  ingredients: [],
  rootItems: [],
  products: [],
  categories: [],
  preferences: null,
  userPrefs: {},
  settings: {},
  currentPlan: null,
  shoppingList: [],
  isCachedHydrated: false,
  isCloudHydrated: false
};

export const getState = () => state;
