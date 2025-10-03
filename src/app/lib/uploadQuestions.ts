import { db } from "./firebase"
import { doc, setDoc } from "firebase/firestore"
import { questionsIT } from "./questionsIT"
import { questionsEnglish } from "./questionsEnglish"

// 🔹 Hàm upload chung
const uploadCollection = async (collectionName: string, data: any) => {
  for (const level in data) {
    const categories = data[level]
    for (const category in categories) {
      const questions = categories[category]

      // Tạo document id: level-category
      const docRef = doc(db, collectionName, `${level}-${category}`)
      await setDoc(docRef, {
        level,
        category,
        questions
      })
      console.log(`✅ Uploaded ${collectionName} - ${level}/${category}`)
    }
  }
}

// 🔹 Hàm thực thi
export const uploadQuestions = async () => {
  try {
    await uploadCollection("questionsIT", questionsIT)
    await uploadCollection("questionsEnglish", questionsEnglish)
    console.log("🎉 All questions uploaded successfully!")
  } catch (error) {
    console.error("❌ Error uploading:", error)
  }
}
