"use client"
import { createContext, useContext, useState, ReactNode, useEffect } from "react"

type Lang = "en" | "vi"

interface LangContextType {
  lang: Lang
  toggleLang: () => void
}

const LangContext = createContext<LangContextType | undefined>(undefined)

export const LangProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>("en")

  // 🔹 Khi component mount, đọc từ localStorage
  useEffect(() => {
    const savedLang = localStorage.getItem("lang") as Lang | null
    if (savedLang) {
      setLang(savedLang)
    }
  }, [])

  const toggleLang = () => {
    setLang((prev) => {
      const newLang = prev === "en" ? "vi" : "en"
      localStorage.setItem("lang", newLang) // 🔹 Lưu vào localStorage
      return newLang
    })
  }

  return (
    <LangContext.Provider value={{ lang, toggleLang }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => {
  const context = useContext(LangContext)
  if (!context) throw new Error("useLang must be used within LangProvider")
  return context
}
