import "./globals.css";

export const metadata = {
  title: "The Sports Wire Live",
  description: "Trending football and cricket news, updated automatically.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="site-header__inner">
            <div className="site-header__logo">The Sports Wire Live</div>
            <div className="site-header__tag">Football · World Cup · Cricket</div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}