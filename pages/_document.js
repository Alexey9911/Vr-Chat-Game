import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="es">
      <Head>
        <link rel="icon" type="image/png" href="/favicon/eDKaxFdg_400x400.png" />
        <link rel="apple-touch-icon" href="/favicon/eDKaxFdg_400x400.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Orbitron:wght@500;700&family=Plus+Jakarta+Sans:wght@400;500;600&family=Space+Grotesk:wght@400;500&family=Tektur:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
