import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { supabase } from '../lib/supabase'
import { mockResidents } from '../lib/mockData'
import { SectionCard, Badge, Modal, Loader, EmptyState } from '../components/ui/index'
import { Plus, Search, Eye, Edit2, Download, FileSpreadsheet } from 'lucide-react'
import { exportResidentsToPDF, exportResidentsToExcel } from '../lib/exportUtils'
import { sanitizeResidentForm } from '../lib/sanitize'

const PUROKS = ['Purok 1', 'Purok 2', 'Purok 3', 'Purok 4', 'Purok 5']
const CIVIL = ['Single', 'Married', 'Widowed', 'Separated', 'Annulled']
const EDU = ['Elementary', 'High School', 'Senior High School', 'College', 'Vocational', 'Post-Graduate', 'None']

const emptyForm = {
  resident_no: '', first_name: '', last_name: '', middle_name: '', date_of_birth: '',
  sex: 'Male', civil_status: 'Single', purok: 'Purok 1', monthly_income: '',
  occupation: '', educational_attainment: 'High School', contact_number: '',
  is_household_head: false, is_pwd: false, pwd_type: '', is_solo_parent: false,
  is_senior_citizen: false, is_voter: false,
}

export default function Residents() {
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const qc = useQueryClient()

  const { data: residents = mockResidents, isLoading } = useQuery({
    queryKey: ['residents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('residents_with_age')
        .select('*')
        .order('resident_no')
      if (error || !data?.length) return mockResidents
      return data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editId) {
        const { error } = await supabase.from('residents').update(payload).eq('id', editId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('residents').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success(editId ? 'Resident updated!' : 'Resident added!')
      qc.invalidateQueries(['residents'])
      setModalOpen(false)
      setForm(emptyForm)
      setEditId(null)
    },
    onError: (err) => toast.error(err.message),
  })

  const handleEdit = (r) => {
    setForm({ ...r })
    setEditId(r.id)
    setModalOpen(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.resident_no) form.resident_no = `RES-${String(residents.length + 1).padStart(4, '0')}`
    const sanitized = sanitizeResidentForm(form)
    saveMutation.mutate(sanitized)
  }

  const filtered = residents.filter(r =>
    `${r.first_name} ${r.last_name} ${r.resident_no} ${r.purok}`
      .toLowerCase().includes(search.toLowerCase())
  )

  const statusBadge = (r) => {
    if (r.is_senior_citizen) return <Badge variant="blue">Senior</Badge>
    if (r.is_pwd) return <Badge variant="gold">PWD</Badge>
    if (r.is_solo_parent) return <Badge variant="teal">Solo Parent</Badge>
    return null
  }

  return (
    <div>
      <SectionCard
        title="Household Profiling Dashboard"
        subtitle={`${residents.length} residents registered`}
        action={
          <div className="flex gap-2">
            <button className="btn btn-ghost flex items-center gap-1.5 text-xs" onClick={() => exportResidentsToPDF(residents)}>
              <Download size={13} /> PDF
            </button>
            <button className="btn btn-ghost flex items-center gap-1.5 text-xs" onClick={() => exportResidentsToExcel(residents)}>
              <FileSpreadsheet size={13} /> Excel
            </button>
            <button className="btn btn-primary flex items-center gap-2" onClick={() => { setForm(emptyForm); setEditId(null); setModalOpen(true) }}>
              <Plus size={14} /> Add Resident
            </button>
          </div>
        }
      >
        <div className="relative mb-4 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="form-input pl-8"
            placeholder="Search name, ID, or purok..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? <Loader /> : filtered.length === 0 ? <EmptyState message="No residents found" /> : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Res. ID</th><th>Name</th><th>Purok</th><th>Age</th>
                  <th>Sex</th><th>Civil Status</th><th>HH Head</th><th>Category</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td><span className="font-mono text-[11px] text-teal">{r.resident_no}</span></td>
                    <td><strong>{r.first_name} {r.last_name}</strong></td>
                    <td>{r.purok}</td>
                    <td>{r.age ?? Math.floor((Date.now() - new Date(r.date_of_birth)) / 31557600000)}</td>
                    <td>{r.sex}</td>
                    <td>{r.civil_status}</td>
                    <td>{r.is_household_head ? <Badge variant="teal">Yes</Badge> : <Badge variant="gray">No</Badge>}</td>
                    <td>{statusBadge(r)}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost px-2 py-1 text-xs" title="View"><Eye size={13} /></button>
                        <button className="btn btn-ghost px-2 py-1 text-xs" title="Edit" onClick={() => handleEdit(r)}><Edit2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Resident' : 'Add New Resident'}>
        <form onSubmit={handleSubmit} className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">First Name *</label>
              <input className="form-input mt-1" required value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} />
            </div>
            <div>
              <label className="form-label">Last Name *</label>
              <input className="form-input mt-1" required value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} />
            </div>
            <div>
              <label className="form-label">Middle Name</label>
              <input className="form-input mt-1" value={form.middle_name} onChange={e => setForm({...form, middle_name: e.target.value})} />
            </div>
            <div>
              <label className="form-label">Date of Birth *</label>
              <input type="date" className="form-input mt-1" required value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} />
            </div>
            <div>
              <label className="form-label">Sex *</label>
              <select className="form-select mt-1" value={form.sex} onChange={e => setForm({...form, sex: e.target.value})}>
                <option>Male</option><option>Female</option>
              </select>
            </div>
            <div>
              <label className="form-label">Civil Status</label>
              <select className="form-select mt-1" value={form.civil_status} onChange={e => setForm({...form, civil_status: e.target.value})}>
                {CIVIL.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Purok *</label>
              <select className="form-select mt-1" value={form.purok} onChange={e => setForm({...form, purok: e.target.value})}>
                {PUROKS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Monthly Income (₱)</label>
              <input type="number" className="form-input mt-1" value={form.monthly_income} onChange={e => setForm({...form, monthly_income: e.target.value})} />
            </div>
            <div>
              <label className="form-label">Occupation</label>
              <input className="form-input mt-1" value={form.occupation} onChange={e => setForm({...form, occupation: e.target.value})} />
            </div>
            <div>
              <label className="form-label">Contact Number</label>
              <input className="form-input mt-1" value={form.contact_number} onChange={e => setForm({...form, contact_number: e.target.value})} />
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="form-label mb-2">Special Categories</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['is_household_head', 'Household Head'],
                ['is_voter', 'Registered Voter'],
                ['is_pwd', 'Person with Disability (PWD)'],
                ['is_solo_parent', 'Solo Parent'],
                ['is_senior_citizen', 'Senior Citizen (60+)'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form[key]} onChange={e => setForm({...form, [key]: e.target.checked})} className="rounded" />
                  {label}
                </label>
              ))}
            </div>
            {form.is_pwd && (
              <div className="mt-2">
                <label className="form-label">Disability Type</label>
                <select className="form-select mt-1" value={form.pwd_type} onChange={e => setForm({...form, pwd_type: e.target.value})}>
                  <option>Physical</option><option>Visual</option><option>Hearing</option><option>Intellectual</option><option>Psychosocial</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn btn-primary flex-1" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : editId ? 'Update Record' : 'Save Resident'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}