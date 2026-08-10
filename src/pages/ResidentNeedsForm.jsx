import NeedsForm from '../components/NeedsForm'

// Standalone public page at /resident-needs — wraps the shared NeedsForm
// in a full-screen gradient background.
export default function ResidentNeedsForm() {
  return (
    <div className="public-announcements-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 16px' }}>
      <NeedsForm />
    </div>
  )
}
