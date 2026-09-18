import { createClient } from 'npm:@supabase/supabase-js@2.43.4'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const TABLES = [
  'residents',
  'households',
  'incidents',
  'beneficiaries',
  'assistance_programs',
  'survey_responses',
]

const BUCKET = 'system-backups'

async function exportTable(tableName: string) {
  const { data, error } = await supabase.from(tableName).select('*')
  if (error) throw new Error(`Failed to fetch ${tableName}: ${error.message}`)
  return data ?? []
}

async function ensureBucket() {
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets()
  if (listErr) throw new Error(`Failed to list buckets: ${listErr.message}`)

  const exists = buckets.some(bucket => bucket.name === BUCKET)
  if (!exists) {
    const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
      public: false,
      allowedMimeTypes: ['application/json'],
      fileSizeLimit: '10MB',
    })
    if (createErr) throw new Error(`Failed to create bucket: ${createErr.message}`)
  }
}

Deno.serve(async (_req) => {
  try {
    await ensureBucket()

    const exportData = {} as Record<string, unknown>
    for (const tableName of TABLES) {
      exportData[tableName] = await exportTable(tableName)
    }

    const exportedAt = new Date().toISOString()
    const payload = {
      system: 'PROTECT Barangay Analytics System',
      barangay: 'Barangay San Joaquin, Basco, Batanes',
      exportedAt,
      version: '1.0',
      tables: exportData,
    }

    const filename = `protect-backup-${new Date().toISOString().slice(0, 10)}.json`
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })

    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(filename, blob, {
      upsert: true,
      contentType: 'application/json',
    })

    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`)

    return new Response(JSON.stringify({ ok: true, bucket: BUCKET, file: filename, exportedAt }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
