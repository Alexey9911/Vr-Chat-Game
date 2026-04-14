import type { AppProps } from 'next/app'
import '../styles/globals.css'
import '../styles/admin.css'
import '../styles/audioButton.css'

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}
