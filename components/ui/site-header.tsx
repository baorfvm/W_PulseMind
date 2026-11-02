import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PULSEMIND_PATHS } from "@/lib/pulsemind-logo";
import { SITE_CONTENT, type Language } from "@/lib/site-content";

export function SiteHeader({ language, onLanguageChange }: { language: Language; onLanguageChange: (language: Language) => void }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const header = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const content = SITE_CONTENT[language];

  useEffect(() => {
    let previousY = Math.max(0, window.scrollY);
    let travel = 0;
    let isHidden = false;
    let frame = 0;

    const update = () => {
      frame = 0;
      // Clamp elastic overscroll so the header stays visible at either edge.
      const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const y = Math.min(maxY, Math.max(0, window.scrollY));
      const delta = y - previousY;
      previousY = y;
      if (delta === 0) return;

      travel = Math.sign(delta) === Math.sign(travel) ? travel + delta : delta;
      let nextHidden = isHidden;
      if (y <= 16) {
        nextHidden = false;
        travel = 0;
      } else if (travel >= 12) {
        setOpen(false);
        nextHidden = y > (header.current?.offsetHeight ?? 80);
      } else if (travel <= -8) {
        nextHidden = false;
      }
      if (nextHidden !== isHidden) {
        isHidden = nextHidden;
        setHidden(nextHidden);
      }
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) { setOpen(false); menuButton.current?.focus(); }
    };
    const desktop = window.matchMedia("(min-width: 1280px)");
    const onDesktop = () => { if (desktop.matches) setOpen(false); };
    document.addEventListener("keydown", close);
    desktop.addEventListener("change", onDesktop);
    return () => { document.removeEventListener("keydown", close); desktop.removeEventListener("change", onDesktop); };
  }, [open]);

  const links = (mobile: boolean) => content.navigation.map((label, index) => (
    <a
      key={index} href="#" onClick={(event) => { event.preventDefault(); setOpen(false); }}
      className={mobile
        ? "block border-b border-black/8 py-4 text-base font-bold text-[#3D3836] transition-colors hover:text-[#F41626] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F41626]"
        : "whitespace-nowrap py-3 text-[16px] leading-6 font-bold text-[#3D3836] transition-colors hover:text-[#F41626] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F41626]"}
    >{label}</a>
  ));

  return (
    <header ref={header} data-hidden={hidden} inert={hidden} className="site-header sticky top-0 z-50 bg-white">
      <a href="#main-content" className="absolute left-6 top-2 -translate-y-24 rounded bg-[#F41626] px-4 py-3 text-sm font-bold text-white focus:translate-y-0">
        {language === "en" ? "Skip to content" : "Đến nội dung"}
      </a>
      <div className="site-header-inner mx-auto grid h-full grid-cols-[1fr_auto] items-center gap-3 px-4 min-[375px]:px-6 sm:px-10">
        <a href="#top" aria-label={language === "en" ? "PulseMind home" : "Trang chủ PulseMind"} onClick={() => setOpen(false)} className="site-header-logo w-[120px] shrink-0 justify-self-start rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F41626] min-[375px]:w-[154px] sm:w-[180px] xl:w-[188px]">
          <svg viewBox="14 154 972 183" className="block h-auto w-full" aria-hidden="true">
            {PULSEMIND_PATHS.map((path, index) => <path key={index} {...path} fill={[12, 14, 16].includes(index) ? "#F41626" : "#E5E1DC"} />)}
          </svg>
        </a>
        <nav aria-label={language === "en" ? "Main navigation" : "Điều hướng chính"} className="hidden items-center gap-7 xl:flex">{links(false)}</nav>
        <div className="flex items-center gap-3 justify-self-end">
          <button
            type="button" onClick={() => onLanguageChange(language === "en" ? "vi" : "en")}
            aria-label={language === "en" ? "Switch to Vietnamese" : "Chuyển sang tiếng Anh"}
            className="flex h-11 w-[86px] shrink-0 items-center justify-center whitespace-nowrap rounded-[4px] border border-[#D2C9C7] bg-[#DE0C16] px-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#C10B15] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F41626] xl:w-[104px] xl:text-base"
          >
            EN / VI
          </button>
          <button ref={menuButton} type="button" aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? (language === "en" ? "Close menu" : "Đóng menu") : (language === "en" ? "Open menu" : "Mở menu")}
            onClick={() => setOpen((value) => !value)} className="flex size-11 items-center justify-center rounded text-[#3D3836] hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F41626] xl:hidden">
            {open ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
      </div>
      <nav id="mobile-navigation" hidden={!open} aria-label={language === "en" ? "Mobile navigation" : "Điều hướng di động"} className="absolute inset-x-0 top-full border-t border-black/5 bg-white px-6 pb-6 shadow-lg sm:px-10 xl:hidden">{links(true)}</nav>
    </header>
  );
}
