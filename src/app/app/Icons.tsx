// Landing ikonkalari — emoji o'rniga chizma belgilar.
// Emoji har qurilmada har xil chiziladi (Android, iPhone, Windows) va
// sahifa uslubiga tushmaydi; bu yerdagilar esa hamma joyda bir xil.

export type IcoName =
  | "play" | "book" | "target" | "chat" | "trophy" | "chart"
  | "check" | "arrow" | "phone" | "send" | "home" | "user";

const PATHS: Record<IcoName, React.ReactNode> = {
  play: <path d="M8 5.2v13.6L19 12 8 5.2Z" fill="currentColor" stroke="none" />,
  book: (
    <>
      <path d="M12 6.6C10.5 5.1 8.4 4.5 4.6 4.6v13c3.8-.1 5.9.5 7.4 2 1.5-1.5 3.6-2.1 7.4-2v-13c-3.8-.1-5.9.5-7.4 2Z" />
      <path d="M12 6.6v13" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  chat: (
    <>
      <path d="M20.5 12.2c0 4-3.8 7.2-8.5 7.2-1 0-2-.15-2.9-.42L4.2 20.4l1.5-3.7A6.9 6.9 0 0 1 3.5 12.2C3.5 8.2 7.3 5 12 5s8.5 3.2 8.5 7.2Z" />
      <path d="M8.8 11.8h6.4M8.8 14.6h4" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4.5h10v4.2a5 5 0 0 1-10 0V4.5Z" />
      <path d="M7 6H4.6v1.4A3.2 3.2 0 0 0 7.4 10.6M17 6h2.4v1.4a3.2 3.2 0 0 1-2.8 3.2" />
      <path d="M12 13.7v3.6M8.8 19.8h6.4" />
    </>
  ),
  chart: (
    <>
      <path d="M4.5 19.5h15" />
      <path d="M7.5 16.5v-5M12 16.5v-9M16.5 16.5v-3" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5 10-11" />,
  arrow: <path d="M4.5 12h14m-5-5.5L19 12l-5.5 5.5" />,
  phone: (
    <path d="M7.6 3.7c.5-.15 1 .1 1.2.55l1.35 3a1.1 1.1 0 0 1-.3 1.3l-1.2 1a12 12 0 0 0 5.8 5.8l1-1.2a1.1 1.1 0 0 1 1.3-.3l3 1.35c.45.2.7.7.55 1.2l-.7 2.4a1.2 1.2 0 0 1-1.3.85C10.9 18.9 5.1 13.1 4.35 5.7a1.2 1.2 0 0 1 .85-1.3l2.4-.7Z" />
  ),
  send: <path d="M20.8 3.6 2.9 10.4c-.7.26-.68 1.26.03 1.5l4.5 1.5 1.7 5.1c.22.68 1.1.83 1.53.26l2.3-3.05 4.5 3.3c.5.37 1.22.1 1.36-.5l3.1-13.5c.15-.66-.5-1.2-1.12-.96Z" />,
  home: (
    <>
      <path d="m3.5 10.5 8.5-7 8.5 7" />
      <path d="M5.6 9.6V20h12.8V9.6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.4" r="3.6" />
      <path d="M5.2 20c.9-3.4 3.6-5.2 6.8-5.2s5.9 1.8 6.8 5.2" />
    </>
  ),
};

export function Ico({ name, className }: { name: IcoName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
