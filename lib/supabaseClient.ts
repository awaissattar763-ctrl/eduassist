import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://flbbfwlyaunxjnvjqoek.supabase.co"
const supabaseKey = "sb_publishable_ZbiqBjftXIUQEuCLAQQtNg_g2q6ULje"

export const supabase = createClient(supabaseUrl, supabaseKey)
