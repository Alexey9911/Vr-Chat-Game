import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="es">
      <Head>
        {/* Favicon removed per user request — using browser default (empty) for now.
            `data:,` short-circuits the browser's automatic /favicon.ico request so we
            don't get a 404 spam in the console. */}
        <link rel="icon" href="data:," />
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
