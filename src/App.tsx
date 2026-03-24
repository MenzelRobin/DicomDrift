import { useAppStore } from './stores/useAppStore'
import { Landing } from './components/Landing'

export default function App() {
  const phase = useAppStore((s) => s.phase)

  return (
    <>
      {phase === 'landing' && <Landing />}
      {phase === 'processing' && <div>Processing...</div>}
      {phase === 'viewing' && <div>Viewer</div>}
    </>
  )
}
