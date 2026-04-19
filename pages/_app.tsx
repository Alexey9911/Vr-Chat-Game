import type { AppProps } from 'next/app'
import { Leva } from 'leva'
import '../styles/globals.css'
import '../styles/admin.css'
import '../styles/audioButton.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      {/* Leva forced hidden — colour / tonemap controls now live inside
          the in-game Settings modal (Video section). Flip to
          `<Leva collapsed />` if you need the floating debug panel. */}
      <Leva hidden />
      <Component {...pageProps} />
    </>
  )
}
