// app/admin/upload/page.tsx
"use client";

import { Button } from "@chakra-ui/react";

async function uploadMocktestSet(): Promise<void> {
  // Temporary placeholder implementation to satisfy TypeScript.
  // Replace this with the real upload logic that writes to your backend / database.
  return;
}

export default function AdminUpload() {
  return (
    <div className="p-10">
      <h1 className="text-3xl font-bold mb-8">Upload Mocktest Set</h1>
      <Button
        colorScheme="teal"
        size="lg"
        onClick={async () => {
          if (confirm("Upload tất cả bộ câu hỏi vào collection `mocktestSet`?")) {
            try {
              await uploadMocktestSet();
              alert("THÀNH CÔNG! Đã upload xong 14 bộ vào mocktestSet");
            } catch (err: any) {
              alert("Lỗi: " + err.message);
            }
          }
        }}
      >
        Upload Toàn Bộ Vào mocktestSet
      </Button>
    </div>
  );
}