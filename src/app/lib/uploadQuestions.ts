// app/lib/uploadQuestions.ts
import { db } from "@/app/lib/firebase"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { questionsIT } from "./questionsIT"
import { questionsEnglish } from "./questionsEnglish"

/**
 * Upload all questions into a single collection "questions".
 * Document id = `${category}_${level}_${role}` (spaces replaced by underscores)
 * Use setDoc so re-running will overwrite/update documents.
 */
export async function uploadQuestions() {
  const all = [...questionsIT, ...questionsEnglish]

  for (const item of all) {
    const id = `${item.category}_${item.level}_${item.role}`.replace(/\s+/g, "_")
    const ref = doc(db, "questions", id)
    await setDoc(ref, {
      category: item.category,
      level: item.level,
      role: item.role,
      questions: item.questions,
      updatedAt: serverTimestamp()
    })
    console.log("Uploaded:", id)
  }

  console.log("All questions uploaded.")
}
