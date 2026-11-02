export type Language = "en" | "vi";

export const SITE_CONTENT = {
  en: {
    navigation: ["Why we started", "Our approach", "Progress", "FAQ", "Our team"],
    follow: "Follow the pulse",
    subtitle: "A little movement. A pulse of possibility.",
    scroll: "Scroll to bring it to life",
  },
  vi: {
    navigation: ["Vì sao bắt đầu", "Cách tiếp cận", "Tiến trình", "Câu hỏi", "Đội ngũ"],
    follow: "Theo nhịp đập",
    subtitle: "Một chuyển động nhỏ. Mở ra những khả năng mới.",
    scroll: "Cuộn để đánh thức nhịp đập",
  },
} as const;
