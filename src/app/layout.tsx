import { Provider } from "@/components/ui/provider"
import { LangProvider } from "@/app/context/LangContext/page"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Provider>
          <LangProvider>
          {children}
          </LangProvider>
        </Provider>
      </body>
    </html>
  )
}
