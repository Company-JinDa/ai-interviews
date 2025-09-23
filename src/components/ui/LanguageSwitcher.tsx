"use client";

import { HStack, Button } from "@chakra-ui/react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const search = searchParams ? `?${searchParams.toString()}` : "";

  const currentLocale = pathname.startsWith("/vi") ? "vi" : "en";

  const switchTo = (locale: string) => {
    const pathWithoutLocale = pathname.replace(/^\/(en|vi)(\/|$)/, "/");
    const newPath = `/${locale}${pathWithoutLocale === "/" ? "" : pathWithoutLocale}${search}`;
    router.push(newPath);
  };

  return (
    <HStack spacing={2}>
      <Button size="sm" variant={currentLocale === "en" ? "solid" : "outline"} onClick={() => switchTo("en")}>
        EN
      </Button>
      <Button size="sm" variant={currentLocale === "vi" ? "solid" : "outline"} onClick={() => switchTo("vi")}>
        VI
      </Button>
    </HStack>
  );
}
