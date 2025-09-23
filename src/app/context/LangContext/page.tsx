"use client"
import { createContext, useContext, useState, ReactNode } from "react"

type Lang = "en" | "vi"

interface LangContextType {
  lang: Lang
  toggleLang: () => void
}

const LangContext = createContext<LangContextType | undefined>(undefined)

export const LangProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>("en")

  const toggleLang = () => {
    setLang((prev) => (prev === "en" ? "vi" : "en"))
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
