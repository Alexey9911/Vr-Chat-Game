import type { AppProps } from 'next/app'
import { Leva } from 'leva'
import '../styles/globals.css'
import '../styles/admin.css'
import '../styles/audioButton.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      {/* Leva forced hidden in production. Flip `hidden` to false to debug. */}
      <Leva hidden />
      <Component {...pageProps} />
    </>
  )
}
