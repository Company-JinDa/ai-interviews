"use client"

import { Button } from "@chakra-ui/react"
import { uploadQuestions } from "@/app/lib/uploadQuestions"

export default function AdminUploadPage() {
  return (
    <Button
      colorScheme="blue"
      onClick={async () => {
        await uploadQuestions()
        alert("Upload done!")
      }}
    >
      Upload Questions to Firestore
    </Button>
  )
}
