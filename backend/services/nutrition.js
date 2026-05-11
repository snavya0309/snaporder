const db = {
  'chicken biryani':     { calories: 680, macros: { carbs: 72, protein: 38, fat: 22 } },
  'mutton biryani':      { calories: 740, macros: { carbs: 68, protein: 44, fat: 28 } },
  'veg biryani':         { calories: 480, macros: { carbs: 82, protein: 12, fat: 14 } },
  'margherita pizza':    { calories: 520, macros: { carbs: 58, protein: 22, fat: 18 } },
  'butter chicken':      { calories: 490, macros: { carbs: 18, protein: 42, fat: 28 } },
  'paneer tikka':        { calories: 350, macros: { carbs: 12, protein: 24, fat: 22 } },
  'masala dosa':         { calories: 415, macros: { carbs: 62, protein: 9,  fat: 14 } },
  'idli sambar':         { calories: 260, macros: { carbs: 44, protein: 10, fat: 4  } },
  'greek salad':         { calories: 210, macros: { carbs: 14, protein: 8,  fat: 12 } },
  'dal makhani':         { calories: 370, macros: { carbs: 42, protein: 16, fat: 14 } },
  'chole bhature':       { calories: 690, macros: { carbs: 88, protein: 18, fat: 28 } },
  'pav bhaji':           { calories: 440, macros: { carbs: 58, protein: 10, fat: 18 } },
  'samosa':              { calories: 260, macros: { carbs: 28, protein: 5,  fat: 14 } },
  'gulab jamun':         { calories: 380, macros: { carbs: 62, protein: 6,  fat: 12 } },
}

export async function enrichWithNutrition(dishName) {
  const key = dishName.toLowerCase().trim()
  if (db[key]) return db[key]
  const fuzzyKey = Object.keys(db).find(k => key.includes(k) || k.includes(key))
  if (fuzzyKey) return db[fuzzyKey]
  return { calories: null, macros: null }
}
