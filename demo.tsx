import { Skiper19 } from "@/components/ui/svg-follow-scroll";
import { SiteHeader } from "@/components/ui/site-header";
import { useLayoutEffect, useState } from "react";
import type { Language } from "@/lib/site-content";

export default function DemoOne() {
  const [language, setLanguage] = useState<Language>("en");
  useLayoutEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return <>
    <SiteHeader language={language} onLanguageChange={setLanguage} />
    <main id="main-content" tabIndex={-1} className="outline-none">
      <Skiper19 language={language} />
    </main>
  </>;
}
