import NeedsForm from '../components/NeedsForm'

// Standalone public page at /resident-needs — wraps the shared NeedsForm
// in a full-screen gradient background.
export default function ResidentNeedsForm() {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0D9E8C 0%, #1A3A5C 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <NeedsForm />
    </div>
  )
}
