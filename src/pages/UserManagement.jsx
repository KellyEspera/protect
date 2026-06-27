import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { supabase } from '../lib/supabase'
import { ROLE_LABELS } from '../lib/permissions'
import { SectionCard, Badge, Modal } from '../components/ui/index'
import { Edit2, ShieldCheck } from 'lucide-react'

const ROLES = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))

const ROLE_BADGE = {
  admin:    'red',
  officer:  'teal',
  brgy_sec: 'blue',
  tanod:    'gold',
  viewer:   'gray',
}

export default function UserManagement() {
  const qc = useQueryClient()
  const [editUser, setEditUser] = useState(null)   // { id, full_name, role }

  // Load all profiles
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['user-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  // Update a user's name + role
  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, full_name, role }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name, role })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('User updated!')
      qc.invalidateQueries(['user-profiles'])
      setEditUser(null)
    },
    onError: (e) => toast.error(e.message),
  })

  const handleEditSubmit = (e) => {
    e.preventDefault()
    updateRoleMutation.mutate(editUser)
  }

  return (
    <div>
      <SectionCard
        title="System Users"
        subtitle={`${users.length} registered user${users.length !== 1 ? 's' : ''}`}
      >
        {isLoading ? (
          <p className="text-center text-gray-400 py-6 text-sm">Loading...</p>
        ) : users.length === 0 ? (
          <p className="text-center text-gray-400 py-6 text-sm">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-teal-light flex items-center justify-center text-teal text-xs font-bold flex-shrink-0">
                          {(u.full_name || '?')[0].toUpperCase()}
                        </div>
                        <span className="font-medium">{u.full_name || <span className="text-gray-400 italic">No name</span>}</span>
                      </div>
                    </td>
                    <td>
                      <Badge variant={ROLE_BADGE[u.role] || 'gray'}>
                        {ROLE_LABELS[u.role] || u.role}
                      </Badge>
                    </td>
                    <td className="text-xs text-gray-400">
                      {new Date(u.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost px-2 py-1 text-xs flex items-center gap-1"
                        onClick={() => setEditUser({ id: u.id, full_name: u.full_name || '', role: u.role })}
                      >
                        <Edit2 size={11} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Role guide */}
      <SectionCard title="Role Access Guide" subtitle="What each role can access in the system">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { role: 'admin',    pages: 'All pages — full system access' },
            { role: 'officer',  pages: 'All pages — full system access' },
            { role: 'brgy_sec', pages: 'All pages — full system access' },
            { role: 'tanod',    pages: 'Dashboard, Crime Hotspot Map, Crime & Incident' },
            { role: 'viewer',   pages: 'Most pages — no QR Verification or DILG Reports' },
          ].map(({ role, pages }) => (
            <div key={role} className="flex gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
              <ShieldCheck size={16} className="text-teal flex-shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant={ROLE_BADGE[role] || 'gray'}>{ROLE_LABELS[role]}</Badge>
                </div>
                <p className="text-[11px] text-gray-500">{pages}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Edit Role Modal */}
      {editUser && (
        <Modal open={true} onClose={() => setEditUser(null)} title="Edit User">
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="form-label">Full Name</label>
              <input
                className="form-input mt-1"
                value={editUser.full_name}
                onChange={e => setEditUser({ ...editUser, full_name: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Role</label>
              <select
                className="form-select mt-1"
                value={editUser.role}
                onChange={e => setEditUser({ ...editUser, role: e.target.value })}
              >
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="btn btn-primary flex-1"
                disabled={updateRoleMutation.isPending}
              >
                {updateRoleMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditUser(null)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
